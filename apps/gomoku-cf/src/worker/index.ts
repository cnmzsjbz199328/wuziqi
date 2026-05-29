import { Hono } from "hono";
import roomRoutes from "./routes/room";

export { GameRoom } from "./do/GameRoom";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/ping", (c) =>
	c.json({ ok: true, now: new Date().toISOString() })
);

app.get("/api/_bindings", (c) =>
	c.json({
		kv: typeof c.env.KV?.get === "function",
		gameRoom: typeof c.env.GAME_ROOM?.idFromName === "function",
		assets: typeof c.env.ASSETS?.fetch === "function",
	})
);

// `GET /api/room` lists public rooms (lobby), `POST /api/room` creates
// one, `GET /api/room/:code/ws` upgrades to the room's WebSocket.
app.route("/api/room", roomRoutes);

export default app;
