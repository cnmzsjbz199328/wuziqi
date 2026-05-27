import { Hono } from "hono";
import userRoutes from "./routes/user";

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

app.route("/api/user", userRoutes);

export default app;
