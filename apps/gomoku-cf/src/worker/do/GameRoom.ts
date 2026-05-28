// GameRoom — one Durable Object per game room.
//
// State machine:
//   - Storage holds: meta, board, players[], status. Bot is always
//     players[0]; humans are appended in join order. The bot is created
//     in the same `init` call that seats the room creator, so a room
//     never exists without a bot.
//   - Turn order = humans (in join order) then bot, recomputed each tick.
//     Disconnected humans are skipped so play continues when someone
//     drops; their seat is held for reconnect.
//   - WebSockets use the Hibernation API: ctx.acceptWebSocket(server)
//     attaches { username } so the DO can resume identifying which
//     socket belongs to whom after wake-up without an in-memory map.
//
// Auth is done by the DO itself (not the Worker): the WS upgrade URL
// carries ?username=X&token=Y, which we validate against KV before
// accepting. The browser WebSocket API can't send custom headers, so
// query params are the only option; the URL travels over TLS but is
// visible in access logs — acceptable for a casual game.

import { DurableObject } from "cloudflare:workers";
import {
	BOT_USERNAME,
	MAX_HUMANS_PER_ROOM,
	type Board,
	type GameStatus,
	type PlayerColor,
	type RoomPlayer,
	type RoomVisibility,
	type ServerMessage,
} from "../../shared/protocol";
import { smartMove } from "../game/ai";
import {
	clearWinningLines,
	createBoard,
	hasFiveInARow,
	placeStone,
	scoreForClear,
} from "../game/board";
import { getUser } from "../kv/users";
import {
	removePublicRoom,
	upsertPublicRoom,
	type RoomIndexEntry,
} from "../kv/rooms";
import { pickRandomPoem } from "../poems";

// Palette order = seat order. Bot always takes the last slot (amber);
// humans grab the next free color from the front.
const HUMAN_COLORS: PlayerColor[] = ["black", "white", "red", "blue"];
const BOT_COLOR: PlayerColor = "amber";

// Bot's "thinking" delay before its alarm-driven move lands. Long
// enough that the previous move + any clear-and-disrupt animation has
// time to register visually before stones start moving again.
const BOT_THINK_MS = 1500;

// Connected-human turn budget. Only enforced when 2+ humans are in
// the room (see rescheduleAlarm) — solo-human-vs-bot rooms have no
// per-turn deadline since there's nobody else waiting.
const TURN_TIMEOUT_MS = 3 * 60_000;

// A room with no connected humans is destroyed after 5 minutes idle.
// A reconnect during the window cancels the GC and resumes play.
const ROOM_GC_MS = 5 * 60_000;

type AlarmReason = "bot_move" | "turn_timeout" | "room_gc";

interface StoredMeta {
	code: string;
	visibility: RoomVisibility;
	createdAt: number;
}

interface StoredPlayer {
	username: string;
	color: PlayerColor;
	isBot: boolean;
	joinedAt: number;
	score: number; // accumulated in this room only
}

/**
 * Identifies the human (or lack thereof) behind a hibernating WebSocket.
 *   - `username: string`  → seated player; can send place/restart, counts
 *     toward connectedUsernames() so the room stays warm and the bot
 *     keeps ticking against them.
 *   - `username: null`    → spectator; receives state/move/clear/end
 *     broadcasts but place/restart are rejected with a "spectator"
 *     error. Does NOT keep the room alive (room_gc still fires).
 */
interface WsAttachment {
	username: string | null;
}

export class GameRoom extends DurableObject<Env> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname.endsWith("/init") && request.method === "POST") {
			return await this.handleInit(request);
		}
		if (url.pathname.endsWith("/ws")) {
			return await this.handleWsUpgrade(request);
		}
		if (url.pathname.endsWith("/meta") && request.method === "GET") {
			return await this.handleMeta();
		}

		return new Response("Not found", { status: 404 });
	}

	// ---------- init ----------

	private async handleInit(request: Request): Promise<Response> {
		const existing = await this.storage().get<StoredMeta>("meta");
		if (existing) {
			return new Response(JSON.stringify({ error: "already_initialized" }), {
				status: 409,
				headers: { "content-type": "application/json" },
			});
		}
		const body = (await request.json().catch(() => null)) as
			| { code?: string; visibility?: RoomVisibility; creator?: string }
			| null;
		if (
			!body?.code ||
			(body.visibility !== "public" && body.visibility !== "private") ||
			!body.creator
		) {
			return new Response(JSON.stringify({ error: "invalid_init" }), {
				status: 400,
				headers: { "content-type": "application/json" },
			});
		}
		const meta: StoredMeta = {
			code: body.code,
			visibility: body.visibility,
			createdAt: Date.now(),
		};
		const players: StoredPlayer[] = [
			{
				username: BOT_USERNAME,
				color: BOT_COLOR,
				isBot: true,
				joinedAt: Date.now(),
				score: 0,
			},
		];
		await this.storage().put({
			meta,
			players,
			board: createBoard(),
			status: "waiting" as GameStatus,
		});
		// Creator is seated lazily on their WS upgrade; only meta+bot
		// land here. This keeps init idempotent on the creator side
		// (they'll connect right after) and avoids a "ghost" seat if the
		// browser never finishes the join.
		if (meta.visibility === "public") {
			await this.publishLobbyEntry();
		}
		return new Response(JSON.stringify({ ok: true }), {
			headers: { "content-type": "application/json" },
		});
	}

	private async handleMeta(): Promise<Response> {
		const meta = await this.storage().get<StoredMeta>("meta");
		if (!meta) {
			return new Response(JSON.stringify({ error: "not_found" }), {
				status: 404,
				headers: { "content-type": "application/json" },
			});
		}
		const players = (await this.storage().get<StoredPlayer[]>("players")) ?? [];
		const status =
			(await this.storage().get<GameStatus>("status")) ?? "waiting";
		return new Response(
			JSON.stringify({
				code: meta.code,
				visibility: meta.visibility,
				status,
				playerCount: players.length,
				players: players.map((p) => p.username),
			}),
			{ headers: { "content-type": "application/json" } }
		);
	}

	// ---------- WS upgrade ----------

	private async handleWsUpgrade(request: Request): Promise<Response> {
		if (request.headers.get("Upgrade") !== "websocket") {
			return new Response("Expected WebSocket", { status: 400 });
		}
		const url = new URL(request.url);
		const username = url.searchParams.get("username");
		const token = url.searchParams.get("token");

		const meta = await this.storage().get<StoredMeta>("meta");
		if (!meta) {
			return new Response("Room not found", { status: 404 });
		}

		// Two flavours of WS:
		//   - Both creds present → authenticated seat. Validate token,
		//     ensureSeat (might 409 on a full room), broadcast updated
		//     state and reschedule the alarm since the connect can flip
		//     the room out of room_gc territory.
		//   - Neither present     → spectator. Accept the socket, push
		//     current state. Spectators don't keep the room warm and
		//     can't send place/restart (rejected in webSocketMessage).
		//   - Exactly one present → malformed; refuse so it doesn't
		//     silently degrade.
		let attachedUsername: string | null = null;
		if (username || token) {
			if (!username || !token) {
				return new Response("Missing credentials", { status: 400 });
			}
			const user = await getUser(this.env.KV, username);
			if (!user || user.token !== token) {
				return new Response("Unauthorized", { status: 401 });
			}
			const seatResult = await this.ensureSeat(username);
			if (!seatResult.ok) {
				return new Response(seatResult.reason, { status: 409 });
			}
			attachedUsername = username;
		}

		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);
		server.serializeAttachment({
			username: attachedUsername,
		} satisfies WsAttachment);
		this.ctx.acceptWebSocket(server);

		// First state push happens after acceptWebSocket so this socket
		// is included in the broadcast.
		if (attachedUsername) {
			await this.maybeStartPlaying();
		}
		await this.broadcastState();
		if (attachedUsername) {
			await this.rescheduleAlarm();
		}

		return new Response(null, { status: 101, webSocket: client });
	}

	private async ensureSeat(
		username: string
	): Promise<{ ok: true } | { ok: false; reason: string }> {
		if (username === BOT_USERNAME) {
			return { ok: false, reason: "username_reserved" };
		}
		const players =
			(await this.storage().get<StoredPlayer[]>("players")) ?? [];
		if (players.some((p) => p.username === username)) {
			return { ok: true }; // already seated, reconnect
		}
		const humans = players.filter((p) => !p.isBot);
		if (humans.length >= MAX_HUMANS_PER_ROOM) {
			return { ok: false, reason: "room_full" };
		}
		const usedColors = new Set(humans.map((p) => p.color));
		const color = HUMAN_COLORS.find((c) => !usedColors.has(c));
		if (!color) {
			return { ok: false, reason: "no_color_available" };
		}
		players.push({
			username,
			color,
			isBot: false,
			joinedAt: Date.now(),
			score: 0,
		});
		await this.storage().put("players", players);
		await this.publishLobbyEntryIfPublic();
		return { ok: true };
	}

	// ---------- game lifecycle ----------

	private async maybeStartPlaying(): Promise<void> {
		const status =
			(await this.storage().get<GameStatus>("status")) ?? "waiting";
		if (status !== "waiting") return;
		const players =
			(await this.storage().get<StoredPlayer[]>("players")) ?? [];
		const humans = players.filter((p) => !p.isBot);
		if (humans.length === 0) return;
		await this.storage().put("status", "playing" as GameStatus);
		// First turn = first-joined human.
		await this.storage().put("turn", humans[0].username);
	}

	private async turnOrder(): Promise<string[]> {
		const players =
			(await this.storage().get<StoredPlayer[]>("players")) ?? [];
		const connected = this.connectedUsernames();
		const humansInOrder = players
			.filter((p) => !p.isBot)
			.sort((a, b) => a.joinedAt - b.joinedAt)
			.filter((p) => connected.has(p.username))
			.map((p) => p.username);
		// Bot is always eligible; placed last in the cycle.
		return [...humansInOrder, BOT_USERNAME];
	}

	private async advanceTurn(): Promise<string | null> {
		const order = await this.turnOrder();
		if (order.length === 0) {
			await this.storage().put("turn", null);
			return null;
		}
		const current = (await this.storage().get<string>("turn")) ?? order[0];
		const idx = order.indexOf(current);
		const next = order[(idx === -1 ? -1 : idx + 1) % order.length];
		await this.storage().put("turn", next);
		return next;
	}

	private async handlePlace(
		username: string,
		row: number,
		col: number
	): Promise<void> {
		const status =
			(await this.storage().get<GameStatus>("status")) ?? "waiting";
		if (status !== "playing") {
			this.sendErrorTo(username, "not_playing", "Game is not in play");
			return;
		}
		const turn = (await this.storage().get<string>("turn")) ?? null;
		if (turn !== username) {
			this.sendErrorTo(username, "not_your_turn", "Not your turn");
			return;
		}
		const board =
			(await this.storage().get<Board>("board")) ?? createBoard();
		const placed = placeStone(board, row, col, username);
		if (!placed.ok) {
			this.sendErrorTo(username, placed.reason, `Cannot place: ${placed.reason}`);
			return;
		}
		let nextBoard = placed.board;

		this.broadcast({ type: "move", row, col, by: username });

		if (hasFiveInARow(nextBoard, username)) {
			const result = clearWinningLines(nextBoard, username);
			nextBoard = result.board;
			const pointsAwarded = scoreForClear(result.clearedSelf);
			if (pointsAwarded > 0) {
				await this.bumpPlayerScore(username, pointsAwarded);
			}
			// Per-game scoring (no cumulative cross-room total). Each scoring
			// clear carries a random poem; the client surfaces it briefly in
			// the page header. Per-room scores keep counting up — only a
			// manual ClientRestart resets them.
			this.broadcast({
				type: "clear",
				by: username,
				clearedSelf: result.clearedSelf,
				removedFromOpponents: result.removedFromOpponents,
				pointsAwarded,
				poem: pointsAwarded > 0 ? pickRandomPoem() : undefined,
			});
		}

		await this.storage().put("board", nextBoard);
		await this.advanceTurn();
		await this.broadcastState();
		await this.rescheduleAlarm();
	}

	private async restartRound(): Promise<void> {
		const players =
			(await this.storage().get<StoredPlayer[]>("players")) ?? [];
		const reset = players.map((p) => ({ ...p, score: 0 }));
		await this.storage().put({
			players: reset,
			board: createBoard(),
			status: "waiting" as GameStatus,
			turn: null,
		});
		await this.maybeStartPlaying();
		await this.broadcastState();
		await this.publishLobbyEntryIfPublic();
		await this.rescheduleAlarm();
	}

	/**
	 * Decide what (if anything) the single alarm slot should be doing
	 * next, given the current turn, status, and connection set:
	 *   - Bot's turn → bot_move @ +1500ms (smartMove plays via alarm handler)
	 *   - Connected human's turn AND ≥2 humans in room → turn_timeout @
	 *     +3min (auto-skip if idle). Solo-human rooms skip the deadline
	 *     entirely — the only other actor is the bot, which doesn't mind
	 *     waiting, so there's nobody to be "fair" to.
	 *   - No connected humans → room_gc @ +5min (destroy if still empty)
	 *   - Anything else (status != playing, etc.) → no alarm
	 * Called after every state mutation that could shift this decision.
	 */
	private async rescheduleAlarm(): Promise<void> {
		const status =
			(await this.storage().get<GameStatus>("status")) ?? "waiting";
		const connectedHumanCount = this.countConnectedHumans();

		if (connectedHumanCount === 0) {
			await this.storage().put("alarm_reason", "room_gc" satisfies AlarmReason);
			await this.ctx.storage.setAlarm(Date.now() + ROOM_GC_MS);
			return;
		}

		if (status !== "playing") {
			await this.storage().delete("alarm_reason");
			await this.ctx.storage.deleteAlarm();
			return;
		}

		const turn = (await this.storage().get<string>("turn")) ?? null;
		if (turn === BOT_USERNAME) {
			await this.storage().put("alarm_reason", "bot_move" satisfies AlarmReason);
			await this.ctx.storage.setAlarm(Date.now() + BOT_THINK_MS);
			return;
		}
		if (turn && connectedHumanCount >= 2) {
			await this.storage().put(
				"alarm_reason",
				"turn_timeout" satisfies AlarmReason
			);
			await this.ctx.storage.setAlarm(Date.now() + TURN_TIMEOUT_MS);
			return;
		}
		// Solo-human-on-their-turn: no deadline. Clear any stale alarm.
		await this.storage().delete("alarm_reason");
		await this.ctx.storage.deleteAlarm();
	}

	private hasAnyConnectedHuman(): boolean {
		return this.countConnectedHumans() > 0;
	}

	private countConnectedHumans(): number {
		const connected = this.connectedUsernames();
		let n = 0;
		for (const u of connected) {
			if (u !== BOT_USERNAME) n++;
		}
		return n;
	}

	async alarm(): Promise<void> {
		const reason =
			(await this.storage().get<AlarmReason>("alarm_reason")) ?? null;
		await this.storage().delete("alarm_reason");

		if (reason === "room_gc") {
			// Confirm the precondition still holds — a reconnect could have
			// raced the alarm — and if so, tear the room down.
			if (this.hasAnyConnectedHuman()) {
				await this.rescheduleAlarm();
				return;
			}
			await this.destroy();
			return;
		}

		if (reason === "bot_move") {
			const status =
				(await this.storage().get<GameStatus>("status")) ?? "waiting";
			const turn = (await this.storage().get<string>("turn")) ?? null;
			if (status !== "playing" || turn !== BOT_USERNAME) return;
			if (!this.hasAnyConnectedHuman()) {
				// Don't tick against an empty room — reschedule will set GC.
				await this.rescheduleAlarm();
				return;
			}
			const board =
				(await this.storage().get<Board>("board")) ?? createBoard();
			const players =
				(await this.storage().get<StoredPlayer[]>("players")) ?? [];
			const opponents = players
				.filter((p) => p.username !== BOT_USERNAME)
				.map((p) => p.username);
			const [row, col] = smartMove(board, BOT_USERNAME, opponents);
			await this.handlePlace(BOT_USERNAME, row, col);
			return;
		}

		if (reason === "turn_timeout") {
			const status =
				(await this.storage().get<GameStatus>("status")) ?? "waiting";
			const turn = (await this.storage().get<string>("turn")) ?? null;
			if (status !== "playing" || !turn || turn === BOT_USERNAME) return;
			// The timed-out player keeps their seat — they can rejoin and
			// play next time their turn comes around. Just notify and skip.
			this.broadcast({ type: "timeout", username: turn });
			await this.advanceTurn();
			await this.broadcastState();
			await this.rescheduleAlarm();
			return;
		}
	}

	private async bumpPlayerScore(
		username: string,
		delta: number
	): Promise<number> {
		const players =
			(await this.storage().get<StoredPlayer[]>("players")) ?? [];
		const idx = players.findIndex((p) => p.username === username);
		if (idx === -1) return 0;
		const newScore = players[idx].score + delta;
		players[idx] = { ...players[idx], score: newScore };
		await this.storage().put("players", players);
		return newScore;
	}

	// ---------- broadcasts ----------

	private async broadcastState(): Promise<void> {
		const meta = await this.storage().get<StoredMeta>("meta");
		if (!meta) return;
		const board =
			(await this.storage().get<Board>("board")) ?? createBoard();
		const players =
			(await this.storage().get<StoredPlayer[]>("players")) ?? [];
		const status =
			(await this.storage().get<GameStatus>("status")) ?? "waiting";
		const turn = (await this.storage().get<string>("turn")) ?? null;
		const connected = this.connectedUsernames();

		const publicPlayers: RoomPlayer[] = players.map((p) => ({
			username: p.username,
			color: p.color,
			isBot: p.isBot,
			// Bot is always "connected" — there's no socket but the AI is always reachable.
			connected: p.isBot ? true : connected.has(p.username),
			score: p.score,
		}));

		this.broadcast({
			type: "state",
			board,
			players: publicPlayers,
			turn,
			status,
			visibility: meta.visibility,
		});
	}

	private broadcast(msg: ServerMessage): void {
		const payload = JSON.stringify(msg);
		for (const ws of this.ctx.getWebSockets()) {
			try {
				ws.send(payload);
			} catch {
				// Socket may be mid-close; ignore.
			}
		}
	}

	private sendErrorTo(username: string, code: string, message: string): void {
		const payload = JSON.stringify({
			type: "error",
			code,
			message,
		} satisfies ServerMessage);
		for (const ws of this.ctx.getWebSockets()) {
			const att = ws.deserializeAttachment() as WsAttachment | null;
			if (att?.username !== username) continue;
			try {
				ws.send(payload);
			} catch {
				// ignore
			}
		}
	}

	private connectedUsernames(): Set<string> {
		const out = new Set<string>();
		for (const ws of this.ctx.getWebSockets()) {
			const att = ws.deserializeAttachment() as WsAttachment | null;
			if (att?.username) out.add(att.username);
		}
		return out;
	}

	// ---------- WebSocket hibernation handlers ----------

	async webSocketMessage(
		ws: WebSocket,
		raw: string | ArrayBuffer
	): Promise<void> {
		const att = ws.deserializeAttachment() as WsAttachment | null;
		// Note: spectator sockets have att.username === null and are
		// allowed to stay open — they just can't send action messages.
		// Only a missing attachment (corrupt socket) gets closed.
		if (!att) {
			ws.close(1008, "no_attachment");
			return;
		}
		const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
		let msg: unknown;
		try {
			msg = JSON.parse(text);
		} catch {
			this.sendErrorToWs(ws, "bad_json", "Could not parse message");
			return;
		}
		if (
			typeof msg !== "object" ||
			msg === null ||
			!("type" in msg) ||
			typeof (msg as { type: unknown }).type !== "string"
		) {
			this.sendErrorToWs(ws, "bad_message", "Malformed message");
			return;
		}
		const m = msg as { type: string; row?: number; col?: number };

		// Spectator gating: actions require a seated identity. We tell
		// the client which code to react on so the UI can prompt the
		// guest to sign in instead of silently dropping the move.
		if (m.type === "place" || m.type === "restart" || m.type === "resign") {
			if (!att.username) {
				this.sendErrorToWs(
					ws,
					"spectator_only",
					"请先登记昵称才能下子"
				);
				return;
			}
		}

		if (m.type === "place") {
			if (
				typeof m.row !== "number" ||
				typeof m.col !== "number" ||
				!Number.isInteger(m.row) ||
				!Number.isInteger(m.col)
			) {
				this.sendErrorToWs(ws, "bad_place", "row/col required");
				return;
			}
			await this.handlePlace(att.username!, m.row, m.col);
			return;
		}
		if (m.type === "join") {
			// Identity is already established at upgrade time; treat a
			// late join as a request for a fresh state snapshot.
			await this.broadcastState();
			return;
		}
		if (m.type === "restart") {
			await this.restartRound();
			return;
		}
		if (m.type === "resign") {
			ws.close(1000, "resigned");
			return;
		}
		this.sendErrorToWs(ws, "unknown_type", `Unknown type: ${m.type}`);
	}

	private sendErrorToWs(ws: WebSocket, code: string, message: string): void {
		try {
			ws.send(
				JSON.stringify({ type: "error", code, message } satisfies ServerMessage)
			);
		} catch {
			// ignore — socket may be mid-close
		}
	}

	async webSocketClose(): Promise<void> {
		// Hibernation API closes the socket on its own; broadcast the
		// updated presence so peers see the player flip to disconnected.
		// Reschedule because the disconnect might have flipped us into
		// "no humans" territory (→ room_gc) or away from someone's turn.
		await this.broadcastState();
		await this.publishLobbyEntryIfPublic();
		await this.rescheduleAlarm();
	}

	async webSocketError(): Promise<void> {
		await this.broadcastState();
		await this.publishLobbyEntryIfPublic();
		await this.rescheduleAlarm();
	}

	// ---------- lobby index ----------

	private async publishLobbyEntryIfPublic(): Promise<void> {
		const meta = await this.storage().get<StoredMeta>("meta");
		if (!meta || meta.visibility !== "public") return;
		await this.publishLobbyEntry();
	}

	private async publishLobbyEntry(): Promise<void> {
		const meta = await this.storage().get<StoredMeta>("meta");
		if (!meta) return;
		const players =
			(await this.storage().get<StoredPlayer[]>("players")) ?? [];
		const status =
			(await this.storage().get<GameStatus>("status")) ?? "waiting";
		const entry: RoomIndexEntry = {
			code: meta.code,
			status,
			playerCount: players.length,
			players: players.map((p) => p.username),
			updatedAt: Date.now(),
		};
		try {
			await upsertPublicRoom(this.env.KV, entry);
		} catch {
			// KV write failed — lobby will be stale but the room itself is fine.
		}
	}

	// Convenience accessor matching the SQLite-backed key-value storage API.
	private storage() {
		return this.ctx.storage;
	}

	async destroy(): Promise<void> {
		const meta = await this.storage().get<StoredMeta>("meta");
		if (meta?.visibility === "public") {
			try {
				await removePublicRoom(this.env.KV, meta.code);
			} catch {
				// ignore
			}
		}
		await this.ctx.storage.deleteAll();
	}
}
