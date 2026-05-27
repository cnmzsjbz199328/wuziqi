import { Hono } from "hono";
import {
	ClaimRequestSchema,
	ClaimResponseSchema,
	RenameRequestSchema,
	ScoreRequestSchema,
	UserStatsSchema,
} from "../../shared/protocol";
import type { UserRecord } from "../kv/types";
import { claim, rename, updateScore } from "../kv/users";

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

app.post("/rename", async (c) => {
	const body = await c.req.json().catch(() => null);
	const parsed = RenameRequestSchema.safeParse(body);
	if (!parsed.success) {
		return c.json(
			{ error: "invalid_request", details: parsed.error.format() },
			400
		);
	}
	const { username, token, newName } = parsed.data;
	const result = await rename(c.env.KV, username, token, newName);
	if (!result.ok) {
		const status = result.reason === "unauthorized" ? 401 : 409;
		return c.json({ error: result.reason }, status);
	}
	return c.json(claimResponse(result.record));
});

app.post("/score", async (c) => {
	const body = await c.req.json().catch(() => null);
	const parsed = ScoreRequestSchema.safeParse(body);
	if (!parsed.success) {
		return c.json(
			{ error: "invalid_request", details: parsed.error.format() },
			400
		);
	}
	const { username, token, delta } = parsed.data;
	const result = await updateScore(c.env.KV, username, token, delta);
	if (!result.ok) {
		return c.json({ error: "unauthorized" }, 401);
	}
	return c.json(
		UserStatsSchema.parse({
			username: result.record.username,
			score: result.record.score,
			gamesPlayed: result.record.gamesPlayed,
		})
	);
});

export default app;
