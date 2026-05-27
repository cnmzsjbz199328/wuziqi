import { z } from "zod";

// ---------- Domain primitives ----------

export const BOARD_SIZE = 15;
export const WIN_COUNT = 5;

export const StoneSchema = z.enum(["black", "white"]);
export type Stone = z.infer<typeof StoneSchema>;

export const CellSchema = z.union([StoneSchema, z.null()]);
export type Cell = z.infer<typeof CellSchema>;

export const BoardSchema = z.array(z.array(CellSchema));
export type Board = z.infer<typeof BoardSchema>;

export const GameStatusSchema = z.enum(["waiting", "playing", "finished"]);
export type GameStatus = z.infer<typeof GameStatusSchema>;

// 3-16 chars, ASCII letters/digits/underscore only. CJK was considered but
// dropped — round-tripping non-ASCII through URL paths, KV keys, and shell
// scripts adds bugs without enough product value to justify it.
export const UsernameSchema = z
	.string()
	.min(3)
	.max(16)
	.regex(/^[a-zA-Z0-9_]+$/, "用户名只能含字母、数字、下划线");

// 64-char hex token issued at claim time.
export const TokenSchema = z.string().length(128).regex(/^[a-f0-9]+$/);

// 6-char base32 (Crockford minus 0/O/1/I/L, plus letters).
export const RoomCodeSchema = z.string().length(6).regex(/^[A-HJ-NP-Z2-9]+$/);

// ---------- REST request/response schemas ----------

export const ClaimRequestSchema = z.object({
	username: UsernameSchema,
	// Optional. When present and matching the stored token, claim is
	// idempotent (returns the same token). When absent or mismatched on
	// an existing username, the server replies 409.
	token: TokenSchema.optional(),
});
export type ClaimRequest = z.infer<typeof ClaimRequestSchema>;

export const ClaimResponseSchema = z.object({
	username: UsernameSchema,
	token: TokenSchema,
});
export type ClaimResponse = z.infer<typeof ClaimResponseSchema>;

export const RenameRequestSchema = z.object({
	username: UsernameSchema,
	token: TokenSchema,
	newName: UsernameSchema,
});
export type RenameRequest = z.infer<typeof RenameRequestSchema>;

export const CreateRoomRequestSchema = z.object({
	username: UsernameSchema,
	token: TokenSchema,
});
export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;

export const CreateRoomResponseSchema = z.object({
	roomCode: RoomCodeSchema,
});
export type CreateRoomResponse = z.infer<typeof CreateRoomResponseSchema>;

export const LeaderboardEntrySchema = z.object({
	username: UsernameSchema,
	score: z.number().int().nonnegative(),
	gamesPlayed: z.number().int().nonnegative(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const PoemSchema = z.object({
	text: z.string(),
	author: z.string().optional(),
});
export type Poem = z.infer<typeof PoemSchema>;

// ---------- WebSocket messages: client → server ----------

export const ClientJoinSchema = z.object({
	type: z.literal("join"),
	username: UsernameSchema,
	token: TokenSchema,
});

export const ClientPlaceSchema = z.object({
	type: z.literal("place"),
	row: z.number().int().min(0).max(BOARD_SIZE - 1),
	col: z.number().int().min(0).max(BOARD_SIZE - 1),
});

export const ClientResignSchema = z.object({
	type: z.literal("resign"),
});

export const ClientMessageSchema = z.discriminatedUnion("type", [
	ClientJoinSchema,
	ClientPlaceSchema,
	ClientResignSchema,
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ---------- WebSocket messages: server → client ----------

export const PublicPlayerSchema = z.object({
	username: UsernameSchema,
	stone: StoneSchema,
});
export type PublicPlayer = z.infer<typeof PublicPlayerSchema>;

export const ServerStateSchema = z.object({
	type: z.literal("state"),
	board: BoardSchema,
	turn: StoneSchema,
	players: z.array(PublicPlayerSchema),
	status: GameStatusSchema,
});

export const ServerMoveSchema = z.object({
	type: z.literal("move"),
	row: z.number().int(),
	col: z.number().int(),
	by: StoneSchema,
});

export const ServerWinSchema = z.object({
	type: z.literal("win"),
	winner: UsernameSchema,
	stone: StoneSchema,
	poem: PoemSchema,
});

export const ServerErrorSchema = z.object({
	type: z.literal("error"),
	code: z.string(),
	message: z.string(),
});

export const ServerMessageSchema = z.discriminatedUnion("type", [
	ServerStateSchema,
	ServerMoveSchema,
	ServerWinSchema,
	ServerErrorSchema,
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
