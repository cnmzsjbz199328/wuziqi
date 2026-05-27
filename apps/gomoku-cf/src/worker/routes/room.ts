import { Hono } from "hono";
import {
	CreateRoomRequestSchema,
	CreateRoomResponseSchema,
	ListRoomsResponseSchema,
	RoomCodeSchema,
	type RoomSummary,
} from "../../shared/protocol";
import { getUser } from "../kv/users";
import { listPublicRooms } from "../kv/rooms";

const app = new Hono<{ Bindings: Env }>();

// Crockford-ish base32 minus 0/O/1/I/L. 32 chars × 6 = ~1B space, plenty
// for casual use — collisions are vanishingly rare but `init` will
// reject duplicates so we retry on the off-chance.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateRoomCode(): string {
	const bytes = new Uint8Array(6);
	crypto.getRandomValues(bytes);
	let out = "";
	for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
	return out;
}

app.post("/", async (c) => {
	const body = await c.req.json().catch(() => null);
	const parsed = CreateRoomRequestSchema.safeParse(body);
	if (!parsed.success) {
		return c.json(
			{ error: "invalid_request", details: parsed.error.format() },
			400
		);
	}
	const { username, token, visibility } = parsed.data;

	const user = await getUser(c.env.KV, username);
	if (!user || user.token !== token) {
		return c.json({ error: "unauthorized" }, 401);
	}

	// Try a few codes — collision is extraordinarily rare on a
	// ~28-bit space but DOs can be recycled and previously-used codes
	// won't always be free.
	for (let attempt = 0; attempt < 5; attempt++) {
		const code = generateRoomCode();
		const id = c.env.GAME_ROOM.idFromName(code);
		const stub = c.env.GAME_ROOM.get(id);
		const initRes = await stub.fetch("https://do/init", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ code, visibility, creator: username }),
		});
		if (initRes.status === 409) {
			continue; // code already in use, try another
		}
		if (!initRes.ok) {
			const text = await initRes.text();
			return c.json({ error: "init_failed", detail: text }, 500);
		}
		return c.json(
			CreateRoomResponseSchema.parse({ roomCode: code, visibility })
		);
	}
	return c.json({ error: "code_collision" }, 503);
});

app.get("/", async (c) => {
	const rooms = await listPublicRooms(c.env.KV);
	const summaries: RoomSummary[] = rooms.map((r) => ({
		code: r.code,
		status: r.status,
		playerCount: r.playerCount,
		players: r.players,
	}));
	return c.json(ListRoomsResponseSchema.parse({ rooms: summaries }));
});

app.get("/:code", async (c) => {
	const code = c.req.param("code");
	const parsed = RoomCodeSchema.safeParse(code);
	if (!parsed.success) return c.json({ error: "invalid_code" }, 400);
	const id = c.env.GAME_ROOM.idFromName(parsed.data);
	const stub = c.env.GAME_ROOM.get(id);
	const res = await stub.fetch("https://do/meta");
	const body = await res.text();
	return new Response(body, {
		status: res.status,
		headers: { "content-type": "application/json" },
	});
});

app.get("/:code/ws", async (c) => {
	const code = c.req.param("code");
	const parsed = RoomCodeSchema.safeParse(code);
	if (!parsed.success) return c.json({ error: "invalid_code" }, 400);
	const id = c.env.GAME_ROOM.idFromName(parsed.data);
	const stub = c.env.GAME_ROOM.get(id);
	// Forward the upgrade to the DO. Hono's `c.req.raw` carries the
	// original Upgrade header + query params, which the DO needs to
	// validate the username/token pair against KV.
	return stub.fetch(c.req.raw);
});

export default app;
