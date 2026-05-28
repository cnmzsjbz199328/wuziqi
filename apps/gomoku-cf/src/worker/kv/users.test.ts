import { beforeEach, describe, expect, it } from "vitest";
import { claim, generateToken } from "./users";

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
