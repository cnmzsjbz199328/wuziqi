import { Hono } from "hono";
import {
	ClaimRequestSchema,
	ClaimResponseSchema,
	RenameRequestSchema,
} from "../../shared/protocol";
import { claim, rename } from "../kv/users";

const app = new Hono<{ Bindings: Env }>();

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
	const response = ClaimResponseSchema.parse({
		username: result.record.username,
		token: result.record.token,
	});
	return c.json(response);
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
	const response = ClaimResponseSchema.parse({
		username: result.record.username,
		token: result.record.token,
	});
	return c.json(response);
});

export default app;
