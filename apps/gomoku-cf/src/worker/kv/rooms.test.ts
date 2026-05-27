import { beforeEach, describe, expect, it } from "vitest";
import {
	listPublicRooms,
	removePublicRoom,
	upsertPublicRoom,
	type RoomIndexEntry,
} from "./rooms";

function fakeKV(): KVNamespace {
	const store = new Map<string, string>();
	return {
		async get(key: string, opts?: "json" | { type?: string }) {
			const v = store.get(key);
			if (v === undefined) return null;
			const wantJson =
				opts === "json" || (typeof opts === "object" && opts?.type === "json");
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

function entry(code: string, playerCount: number): RoomIndexEntry {
	return {
		code,
		status: "playing",
		playerCount,
		players: Array.from({ length: playerCount }, (_, i) => `u${i}`),
		updatedAt: 1700000000000,
	};
}

let kv: KVNamespace;

beforeEach(() => {
	kv = fakeKV();
});

describe("public-rooms KV index", () => {
	it("upsert writes a round-trippable entry", async () => {
		await upsertPublicRoom(kv, entry("ABC123", 2));
		const list = await listPublicRooms(kv);
		expect(list).toHaveLength(1);
		expect(list[0].code).toBe("ABC123");
		expect(list[0].playerCount).toBe(2);
		expect(list[0].players).toEqual(["u0", "u1"]);
	});

	it("upsert overwrites the previous entry for the same code", async () => {
		await upsertPublicRoom(kv, entry("ABC123", 1));
		await upsertPublicRoom(kv, entry("ABC123", 3));
		const list = await listPublicRooms(kv);
		expect(list).toHaveLength(1);
		expect(list[0].playerCount).toBe(3);
	});

	it("listPublicRooms returns every entry", async () => {
		await upsertPublicRoom(kv, entry("ABC123", 1));
		await upsertPublicRoom(kv, entry("XYZ789", 2));
		const list = await listPublicRooms(kv);
		expect(new Set(list.map((r) => r.code))).toEqual(
			new Set(["ABC123", "XYZ789"])
		);
	});

	it("removePublicRoom drops the entry", async () => {
		await upsertPublicRoom(kv, entry("ABC123", 1));
		await removePublicRoom(kv, "ABC123");
		const list = await listPublicRooms(kv);
		expect(list).toHaveLength(0);
	});

	it("limit caps the returned count", async () => {
		for (let i = 0; i < 5; i++) {
			await upsertPublicRoom(kv, entry(`CODE${i}`, i));
		}
		const list = await listPublicRooms(kv, 3);
		expect(list).toHaveLength(3);
	});
});
