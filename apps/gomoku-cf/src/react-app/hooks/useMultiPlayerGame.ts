import { useCallback, useEffect, useRef, useState } from "react";
import {
	BOARD_SIZE,
	ServerMessageSchema,
	WIN_COUNT,
	type Board,
	type GameStatus,
	type Poem,
	type RoomPlayer,
	type RoomVisibility,
	type ServerMessage,
} from "../../shared/protocol";
import type { Seat } from "./useRoomSeat";

export type ConnectionStatus =
	| "connecting"
	| "open"
	| "closed"
	| "error";

export interface ClearEvent {
	id: number;
	by: string;
	clearedSelf: number;
	removedFromOpponents: Record<string, number>;
	pointsAwarded: number;
	/** Server attaches a random Tang quatrain whenever pointsAwarded > 0. */
	poem: Poem | null;
	/** Cells that were part of the winning run (row, col) — useful so the
	 * client can highlight them before the post-clear board is applied.
	 */
	winningPositions?: { row: number; col: number }[];
}

export interface RoomState {
	board: Board;
	players: RoomPlayer[];
	turn: string | null;
	status: GameStatus;
	visibility: RoomVisibility;
	lastMove: { row: number; col: number; by: string } | null;
}

export interface TimeoutEvent {
	id: number;
	username: string;
}

/** A failed seat attempt (e.g. the chosen name is taken in this room). */
export interface SeatRejection {
	id: number;
	code: string;
	message: string;
}

interface Options {
	roomCode: string;
	/**
	 * The room-scoped seat, or null for spectator mode. Every socket opens
	 * as a spectator; when a seat is present the hook sends an in-band
	 * `join` to claim/reclaim it. place/restart are gated on having a seat.
	 */
	seat: Seat | null;
}

// Reconnect schedule: try fast on the first blip (mobile WS drops are
// frequent and usually transient), then double the delay on each
// successive failure to avoid hammering during a real outage. Reset to
// the base delay every time a connection successfully opens.
const RECONNECT_BASE_MS = 300;
const RECONNECT_MAX_MS = 5000;
// Error codes that mean "your seat attempt was refused" rather than a
// transient gameplay error — surfaced separately so the UI can re-prompt.
const SEAT_REJECT_CODES = new Set([
	"name_taken",
	"room_full",
	"username_reserved",
]);

type ServerStateMessage = Extract<ServerMessage, { type: "state" }>;

function roomStateFromServer(
	msg: ServerStateMessage,
	lastMove: RoomState["lastMove"]
): RoomState {
	return {
		board: msg.board,
		players: msg.players,
		turn: msg.turn,
		status: msg.status,
		visibility: msg.visibility,
		lastMove,
	};
}

function applyMoveToBoard(
	board: Board,
	move: NonNullable<RoomState["lastMove"]>
): Board {
	if (board[move.row]?.[move.col] === move.by) return board;
	const next = board.map((row) => row.slice());
	if (next[move.row]?.[move.col] === null) next[move.row][move.col] = move.by;
	return next;
}

function findWinningPositions(
	board: Board,
	marker: string
): { row: number; col: number }[] {
	const dirs = [
		[0, 1],
		[1, 0],
		[1, 1],
		[1, -1],
	] as const;
	const seen = new Set<number>();
	const positions: { row: number; col: number }[] = [];

	for (let r = 0; r < BOARD_SIZE; r++) {
		for (let c = 0; c < BOARD_SIZE; c++) {
			if (board[r]?.[c] !== marker) continue;
			for (const [dr, dc] of dirs) {
				const prevR = r - dr;
				const prevC = c - dc;
				if (board[prevR]?.[prevC] === marker) continue;

				let run = 0;
				while (board[r + run * dr]?.[c + run * dc] === marker) run++;
				if (run < WIN_COUNT) continue;

				for (let i = 0; i < run; i++) {
					const row = r + i * dr;
					const col = c + i * dc;
					const key = row * BOARD_SIZE + col;
					if (seen.has(key)) continue;
					seen.add(key);
					positions.push({ row, col });
				}
			}
		}
	}

	return positions;
}

export function useMultiPlayerGame({ roomCode, seat }: Options) {
	const [connection, setConnection] = useState<ConnectionStatus>("connecting");
	const [state, setState] = useState<RoomState | null>(null);
	const [lastClear, setLastClear] = useState<ClearEvent | null>(null);
	const [lastTimeout, setLastTimeout] = useState<TimeoutEvent | null>(null);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [seatRejection, setSeatRejection] = useState<SeatRejection | null>(null);

	const wsRef = useRef<WebSocket | null>(null);
	const reconnectTimerRef = useRef<number | null>(null);
	const connectRef = useRef<() => void>(() => undefined);
	const eventIdRef = useRef(0);
	const stateRef = useRef<RoomState | null>(null);
	// Keep the latest lastMove sticky across server `state` messages — the
	// state payload doesn't include it, but the preceding `move` message
	// did. Stored in a ref so a new state push doesn't blow it away.
	const lastMoveRef = useRef<RoomState["lastMove"]>(null);
	// When a clear occurs we delay applying the immediately-following
	// `state` update so the client can highlight the winning stones first.
	const queuedStateRef = useRef<ServerStateMessage | null>(null);
	const clearBufferDeadlineRef = useRef<number | null>(null);
	const applyQueuedStateTimerRef = useRef<number | null>(null);
	const cancelledRef = useRef(false);
	// Backoff state for the reconnect schedule — see RECONNECT_*_MS above.
	const reconnectDelayRef = useRef(RECONNECT_BASE_MS);
	// Latest seat, read inside ws.onopen (a closure created at connect time).
	const seatRef = useRef<Seat | null>(seat);

	useEffect(() => {
		seatRef.current = seat;
	}, [seat]);

	const commitState = useCallback((next: RoomState) => {
		stateRef.current = next;
		setState(next);
	}, []);

	const commitServerState = useCallback(
		(msg: ServerStateMessage) => {
			commitState(roomStateFromServer(msg, lastMoveRef.current));
		},
		[commitState]
	);

	const sendJoin = useCallback(() => {
		const s = seatRef.current;
		const ws = wsRef.current;
		if (!s || !ws || ws.readyState !== WebSocket.OPEN) return;
		ws.send(
			JSON.stringify({ type: "join", username: s.username, token: s.token })
		);
	}, []);

	const connect = useCallback(() => {
		cancelledRef.current = false;
		const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
		// No credentials in the URL — the socket always opens as a
		// spectator and seating is negotiated in-band via `join`.
		const url = `${proto}//${window.location.host}/api/room/${roomCode}/ws`;
		const ws = new WebSocket(url);
		wsRef.current = ws;

		ws.onopen = () => {
			setConnection("open");
			setErrorMsg(null);
			// Successful connect resets the backoff so the next blip
			// reconnects fast again.
			reconnectDelayRef.current = RECONNECT_BASE_MS;
			// Reclaim (or take) our seat if we have one.
			sendJoin();
		};

		ws.onmessage = (ev) => {
			let parsed: ServerMessage;
			try {
				const raw = JSON.parse(ev.data);
				parsed = ServerMessageSchema.parse(raw);
			} catch {
				// Skip messages we can't validate. Errors here usually mean
				// the protocol drifted; surface in dev console only.
				return;
			}
			switch (parsed.type) {
				case "state": {
					// If a recent clear told us to delay applying the post-clear
					// board (so the winning line can be shown first), buffer the
					// incoming state and apply it after the animation window.
					const deadline = clearBufferDeadlineRef.current;
					if (deadline && Date.now() < deadline) {
						queuedStateRef.current = parsed;
						const toWait = Math.max(0, deadline - Date.now());
						if (applyQueuedStateTimerRef.current !== null) {
							window.clearTimeout(applyQueuedStateTimerRef.current);
						}
						applyQueuedStateTimerRef.current = window.setTimeout(() => {
							const q = queuedStateRef.current;
							if (q) {
								commitServerState(q);
								queuedStateRef.current = null;
								clearBufferDeadlineRef.current = null;
							}
							applyQueuedStateTimerRef.current = null;
						}, toWait);
					} else {
						commitServerState(parsed);
					}
					break;
				}
				case "move":
					lastMoveRef.current = {
						row: parsed.row,
						col: parsed.col,
						by: parsed.by,
					};
					setState((s) => {
						if (!s || !lastMoveRef.current) return s;
						const next = {
							...s,
							board: applyMoveToBoard(s.board, lastMoveRef.current),
							lastMove: lastMoveRef.current,
						};
						stateRef.current = next;
						return next;
					});
					break;
				case "clear": {
					// Attempt to reconstruct the board at clear-time so we can
					// identify the winning positions to highlight. The server
					// sends `move` then `clear` before the post-clear `state`, so
					// stateRef already includes the just-played stone from the
					// preceding `move` message.
					const winningPositions: { row: number; col: number }[] = [];
					try {
						const current = stateRef.current;
						if (current) {
							winningPositions.push(
								...findWinningPositions(current.board, parsed.by)
							);
						}
					} catch {
						// Best-effort only; fall back to no explicit positions.
					}
					setLastClear({
						id: ++eventIdRef.current,
						by: parsed.by,
						clearedSelf: parsed.clearedSelf,
						removedFromOpponents: parsed.removedFromOpponents,
						pointsAwarded: parsed.pointsAwarded,
						poem: parsed.poem ?? null,
						winningPositions: winningPositions.length > 0 ? winningPositions : undefined,
					});
					// Buffer the next incoming `state` for the same duration that
					// the board exit animation uses so the winning stones remain
					// visible during the effect.
					clearBufferDeadlineRef.current = Date.now() + 2200;
					break;
				}
				case "timeout":
					setLastTimeout({
						id: ++eventIdRef.current,
						username: parsed.username,
					});
					break;
				case "error":
					if (SEAT_REJECT_CODES.has(parsed.code)) {
						setSeatRejection({
							id: ++eventIdRef.current,
							code: parsed.code,
							message: parsed.message,
						});
					} else {
						setErrorMsg(parsed.message);
					}
					break;
			}
		};

		ws.onclose = () => {
			setConnection("closed");
			wsRef.current = null;
			if (cancelledRef.current) return;
			const delay = reconnectDelayRef.current;
			reconnectDelayRef.current = Math.min(delay * 2, RECONNECT_MAX_MS);
			reconnectTimerRef.current = window.setTimeout(
				() => connectRef.current(),
				delay
			);
		};

		ws.onerror = () => {
			setConnection("error");
		};
	}, [commitServerState, roomCode, sendJoin]);

	useEffect(() => {
		connectRef.current = connect;
	}, [connect]);

	useEffect(() => {
		connect();
		return () => {
			cancelledRef.current = true;
			if (reconnectTimerRef.current !== null) {
				window.clearTimeout(reconnectTimerRef.current);
				reconnectTimerRef.current = null;
			}
			if (applyQueuedStateTimerRef.current !== null) {
				window.clearTimeout(applyQueuedStateTimerRef.current);
				applyQueuedStateTimerRef.current = null;
			}
			wsRef.current?.close();
			wsRef.current = null;
		};
	}, [connect]);

	// Send `join` when a seat appears while the socket is already open
	// (i.e. the user just picked a name). Connecting-then-seated is handled
	// by ws.onopen; this covers the open-then-seated order.
	useEffect(() => {
		if (connection === "open" && seat) sendJoin();
	}, [connection, seat, sendJoin]);

	const isSpectator = !seat;

	const place = useCallback(
		(row: number, col: number) => {
			if (!seat) return; // UI surfaces the sign-in prompt; just no-op here.
			const ws = wsRef.current;
			if (!ws || ws.readyState !== WebSocket.OPEN) return;
			ws.send(JSON.stringify({ type: "place", row, col }));
		},
		[seat]
	);

	const restart = useCallback(() => {
		if (!seat) return;
		const ws = wsRef.current;
		if (!ws || ws.readyState !== WebSocket.OPEN) return;
		ws.send(JSON.stringify({ type: "restart" }));
	}, [seat]);

	// Give up the current seat (stay connected as a spectator). The caller
	// is responsible for clearing its local seat afterwards.
	const leaveSeat = useCallback(() => {
		const ws = wsRef.current;
		if (!ws || ws.readyState !== WebSocket.OPEN) return;
		ws.send(JSON.stringify({ type: "resign" }));
	}, []);

	// Also drop lastMove on restart so the new round opens with a clean
	// indicator rather than the previous round's final dot.
	useEffect(() => {
		if (state?.status === "playing" || state?.status === "waiting") {
			if (lastMoveRef.current && state.board[lastMoveRef.current.row]?.[lastMoveRef.current.col] === null) {
				lastMoveRef.current = null;
			}
		}
	}, [state?.status, state?.board]);

	const isMyTurn = !!seat && state?.turn === seat.username;

	return {
		connection,
		state,
		isMyTurn,
		isSpectator,
		lastClear,
		lastTimeout,
		errorMsg,
		seatRejection,
		place,
		restart,
		leaveSeat,
	};
}
