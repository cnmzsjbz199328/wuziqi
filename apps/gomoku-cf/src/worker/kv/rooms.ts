// Public-rooms KV index.
//
// Key shape:           room_idx:public:<code>
// Stored value (JSON): RoomIndexEntry — the minimum needed to render a
// lobby row without fetching anything from the DO. Updated by the DO
// whenever its public membership changes, so the entry can lag by ~60s
// behind reality (KV consistency window). That's fine for a lobby.
//
// Private rooms intentionally have no index entry — they're only
// reachable by code, so they shouldn't appear anywhere.

import type { GameStatus } from "../../shared/protocol";

const PREFIX = "room_idx:public:";
const keyFor = (code: string) => `${PREFIX}${code}`;

export interface RoomIndexEntry {
	code: string;
	status: GameStatus;
	playerCount: number;
	players: string[];
	updatedAt: number;
}

export async function upsertPublicRoom(
	kv: KVNamespace,
	entry: RoomIndexEntry
): Promise<void> {
	await kv.put(keyFor(entry.code), JSON.stringify(entry));
}

export async function removePublicRoom(
	kv: KVNamespace,
	code: string
): Promise<void> {
	await kv.delete(keyFor(code));
}

export async function listPublicRooms(
	kv: KVNamespace,
	limit = 50
): Promise<RoomIndexEntry[]> {
	const out: RoomIndexEntry[] = [];
	let cursor: string | undefined;
	do {
		const page = await kv.list({ prefix: PREFIX, cursor });
		for (const k of page.keys) {
			const rec = await kv.get<RoomIndexEntry>(k.name, "json");
			if (rec) out.push(rec);
			if (out.length >= limit) return out;
		}
		cursor = page.list_complete ? undefined : page.cursor;
	} while (cursor);
	return out;
}
