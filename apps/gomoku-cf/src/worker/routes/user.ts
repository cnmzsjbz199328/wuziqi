import { Hono } from "hono";
import {
	ClaimRequestSchema,
	ClaimResponseSchema,
} from "../../shared/protocol";
import type { UserRecord } from "../kv/types";
import { claim } from "../kv/users";

const app = new Hono<{ Bindings: Env }>();

function claimResponse(record: UserRecord) {
	return ClaimResponseSchema.parse({
		username: record.username,
		token: record.token,
		score: record.score,
		gamesPlayed: record.gamesPlayed,
	});
}

app.post("/claim", async (c) => {
	const body = await c.req.json().catch(() => null);
	const parsed = ClaimRequestSchema.safeParse(body);
	if (!parsed.success) {
		return c.json(
			{ error: "invalid_request", details: parsed.error.format() },
			400
		);
	}
	const result = await claim(
		c.env.KV,
		parsed.data.username,
		parsed.data.token
	);
	if (!result.ok) {
		return c.json({ error: "taken" }, 409);
	}
	return c.json(claimResponse(result.record));
});

export default app;
