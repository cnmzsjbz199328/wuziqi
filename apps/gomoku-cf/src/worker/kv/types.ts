// Internal storage shape — what we actually persist in KV.
// The wire shape (what clients see) is defined in src/shared/protocol.ts;
// this is a superset (token is never sent down to the user list / leaderboard).

export interface UserRecord {
	username: string;
	token: string;
	score: number;
	gamesPlayed: number;
	createdAt: number;
}
