// Random nickname generator for the "one-click start" path.
//
// Format: Player_<6 base32 chars>. Namespace 32^6 ≈ 1 billion, so collisions
// against a small leaderboard are effectively zero. Total length 13 fits
// well under the 16-char username limit. ASCII only — see the username
// schema comment for why we dropped non-ASCII.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // base32, no 0/O/1/I/L

export function randomName(): string {
	let suffix = "";
	const bytes = new Uint8Array(6);
	crypto.getRandomValues(bytes);
	for (const b of bytes) suffix += ALPHABET[b % ALPHABET.length];
	return `Player_${suffix}`;
}
