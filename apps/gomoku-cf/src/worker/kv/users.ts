// User KV adapter.
//
// Key shape:           user:<username>
// Stored value (JSON): UserRecord (see below).
//
// Note on consistency: Workers KV is eventually consistent (~60s) and
// allows 1 write/second per key. For our case (a single user updating
// their own score) that's fine — a player can't generate more than one
// score-write per second by playing. The remaining race is two
// simultaneous claims of the same name from different clients: KV's
// read-then-write inside `claim` is not atomic, so it's possible (and
// rare) that both succeed and the later write wins. We accept this.

import type { UserRecord } from "./types";

const PREFIX = "user:";
const keyFor = (username: string) => `${PREFIX}${username}`;

/** 64 random bytes → 128 hex chars, matches TokenSchema in protocol.ts. */
export function generateToken(): string {
	const bytes = new Uint8Array(64);
	crypto.getRandomValues(bytes);
	let hex = "";
	for (const b of bytes) hex += b.toString(16).padStart(2, "0");
	return hex;
}

/**
 * Constant-time string compare. Tokens never go anywhere that an attacker
 * can time, but better habit than not.
 */
function constantTimeEq(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export async function getUser(
	kv: KVNamespace,
	username: string
): Promise<UserRecord | null> {
	return (await kv.get<UserRecord>(keyFor(username), "json")) ?? null;
}

export type ClaimResult =
	| { ok: true; record: UserRecord }
	| { ok: false; reason: "taken" };

/**
 * First-claim-wins username registration.
 *
 * - Username doesn't exist → create record with a fresh token.
 * - Username exists and `providedToken` matches → return the existing
 *   record unchanged (idempotent — useful for "I cleared my cookies but
 *   I still know my token"; in practice rare).
 * - Otherwise → "taken".
 */
export async function claim(
	kv: KVNamespace,
	username: string,
	providedToken?: string
): Promise<ClaimResult> {
	const existing = await getUser(kv, username);
	if (existing) {
		if (providedToken && constantTimeEq(existing.token, providedToken)) {
			return { ok: true, record: existing };
		}
		return { ok: false, reason: "taken" };
	}
	const record: UserRecord = {
		username,
		token: generateToken(),
		score: 0,
		gamesPlayed: 0,
		createdAt: Date.now(),
	};
	await kv.put(keyFor(username), JSON.stringify(record));
	return { ok: true, record };
}

export type RenameResult =
	| { ok: true; record: UserRecord }
	| { ok: false; reason: "unauthorized" | "new_name_taken" };

/**
 * Rename keeps the same token, score, and gamesPlayed. Old key is deleted
 * after the new key is written, so a reader during the brief window
 * between the put and the delete may see both — we accept this as a
 * trade for the simplicity of not needing a transaction.
 */
export async function rename(
	kv: KVNamespace,
	username: string,
	token: string,
	newName: string
): Promise<RenameResult> {
	const current = await getUser(kv, username);
	if (!current || !constantTimeEq(current.token, token)) {
		return { ok: false, reason: "unauthorized" };
	}
	if (newName === username) {
		return { ok: true, record: current };
	}
	const collision = await getUser(kv, newName);
	if (collision) return { ok: false, reason: "new_name_taken" };

	const renamed: UserRecord = { ...current, username: newName };
	await kv.put(keyFor(newName), JSON.stringify(renamed));
	await kv.delete(keyFor(username));
	return { ok: true, record: renamed };
}
