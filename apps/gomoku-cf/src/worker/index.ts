import { Hono } from "hono";

export { GameRoom } from "./do/GameRoom";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/ping", (c) =>
	c.json({ ok: true, now: new Date().toISOString() })
);

// Quick sanity check that bindings are wired even though they're not yet used.
app.get("/api/_bindings", (c) =>
	c.json({
		kv: typeof c.env.KV?.get === "function",
		gameRoom: typeof c.env.GAME_ROOM?.idFromName === "function",
		assets: typeof c.env.ASSETS?.fetch === "function",
	})
);

export default app;
