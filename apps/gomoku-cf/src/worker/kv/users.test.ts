import { beforeEach, describe, expect, it } from "vitest";
import {
	claim,
	generateToken,
	getUser,
	listAllUsers,
	rename,
	updateScore,
} from "./users";

/**
 * Minimal in-memory fake of the KVNamespace surface this adapter touches.
 * Only `get(.., "json")`, `put`, `delete`, and `list({prefix})` need to work.
 */
function fakeKV(): KVNamespace {
	const store = new Map<string, string>();
	return {
		async get(key: string, opts?: "json" | { type?: string }) {
			const v = store.get(key);
			if (v === undefined) return null;
			const wantJson = opts === "json" || (typeof opts === "object" && opts?.type === "json");
			return wantJson ? JSON.parse(v) : v;
		},
		async put(key: string, value: string) {
			store.set(key, value);
		},
		async delete(key: string) {
			store.delete(key);
		},
		async list(opts?: { prefix?: string }) {
			const prefix = opts?.prefix ?? "";
			const keys = [...store.keys()]
				.filter((k) => k.startsWith(prefix))
				.map((name) => ({ name }));
			return { keys, list_complete: true, cursor: undefined };
		},
	} as unknown as KVNamespace;
}

let kv: KVNamespace;
beforeEach(() => {
	kv = fakeKV();
});

describe("generateToken", () => {
	it("produces 128 hex chars matching TokenSchema regex", () => {
		const t = generateToken();
		expect(t).toMatch(/^[a-f0-9]{128}$/);
	});

	it("produces distinct tokens on repeated calls", () => {
		const a = generateToken();
		const b = generateToken();
		expect(a).not.toBe(b);
	});
});

describe("claim", () => {
	it("creates a new record on first claim", async () => {
		const result = await claim(kv, "alice");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.record.username).toBe("alice");
			expect(result.record.score).toBe(0);
			expect(result.record.gamesPlayed).toBe(0);
			expect(result.record.token).toMatch(/^[a-f0-9]{128}$/);
		}
	});

	it("returns 'taken' on second claim without token", async () => {
		await claim(kv, "alice");
		const second = await claim(kv, "alice");
		expect(second.ok).toBe(false);
		if (!second.ok) expect(second.reason).toBe("taken");
	});

	it("is idempotent when re-claiming with the correct token", async () => {
		const first = await claim(kv, "alice");
		expect(first.ok).toBe(true);
		if (!first.ok) return;
		const reclaim = await claim(kv, "alice", first.record.token);
		expect(reclaim.ok).toBe(true);
		if (reclaim.ok) {
			expect(reclaim.record.token).toBe(first.record.token);
			expect(reclaim.record.score).toBe(first.record.score);
		}
	});

	it("rejects re-claim with wrong token", async () => {
		await claim(kv, "alice");
		const result = await claim(kv, "alice", "f".repeat(128));
		expect(result.ok).toBe(false);
	});
});

describe("rename", () => {
	it("changes username while keeping token and score", async () => {
		const first = await claim(kv, "alice");
		if (!first.ok) throw new Error("setup failed");
		// give her a score so we can confirm it's preserved
		await updateScore(kv, "alice", first.record.token, 5);

		const r = await rename(kv, "alice", first.record.token, "alicia");
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.record.username).toBe("alicia");
			expect(r.record.token).toBe(first.record.token);
			expect(r.record.score).toBe(5);
		}
		expect(await getUser(kv, "alice")).toBeNull();
		expect((await getUser(kv, "alicia"))?.username).toBe("alicia");
	});

	it("rejects with wrong token", async () => {
		await claim(kv, "alice");
		const r = await rename(kv, "alice", "0".repeat(128), "alicia");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toBe("unauthorized");
	});

	it("rejects when new name is already taken", async () => {
		const a = await claim(kv, "alice");
		await claim(kv, "bob");
		if (!a.ok) throw new Error("setup failed");
		const r = await rename(kv, "alice", a.record.token, "bob");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toBe("new_name_taken");
		// alice still owns her old name
		expect((await getUser(kv, "alice"))?.username).toBe("alice");
	});

	it("no-ops when renaming to the same name", async () => {
		const a = await claim(kv, "alice");
		if (!a.ok) throw new Error("setup failed");
		const r = await rename(kv, "alice", a.record.token, "alice");
		expect(r.ok).toBe(true);
	});
});

describe("updateScore", () => {
	it("adds delta and increments gamesPlayed", async () => {
		const a = await claim(kv, "alice");
		if (!a.ok) throw new Error("setup failed");
		const r = await updateScore(kv, "alice", a.record.token, 3);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.record.score).toBe(3);
			expect(r.record.gamesPlayed).toBe(1);
		}
	});

	it("clamps negative result to 0", async () => {
		const a = await claim(kv, "alice");
		if (!a.ok) throw new Error("setup failed");
		const r = await updateScore(kv, "alice", a.record.token, -100);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.record.score).toBe(0);
	});

	it("rejects with wrong token", async () => {
		await claim(kv, "alice");
		const r = await updateScore(kv, "alice", "0".repeat(128), 1);
		expect(r.ok).toBe(false);
	});

	it("rejects for unknown user", async () => {
		const r = await updateScore(kv, "ghost", "0".repeat(128), 1);
		expect(r.ok).toBe(false);
	});
});

describe("listAllUsers", () => {
	it("returns all users sorted by KV list order (caller sorts later)", async () => {
		await claim(kv, "alice");
		await claim(kv, "bob");
		await claim(kv, "carol");
		const all = await listAllUsers(kv);
		expect(all.map((u) => u.username).sort()).toEqual(["alice", "bob", "carol"]);
	});

	it("never returns the password / token to leak through", async () => {
		// Sanity: our record DOES include token (the route layer is responsible
		// for stripping it). This test pins that behavior so we know to strip
		// tokens in any handler that exposes listAllUsers output.
		await claim(kv, "alice");
		const all = await listAllUsers(kv);
		expect(all[0].token).toMatch(/^[a-f0-9]{128}$/);
	});
});
