import { z } from "zod";

// ---------- Domain primitives ----------

export const BOARD_SIZE = 15;
export const WIN_COUNT = 5;
export const MAX_HUMANS_PER_ROOM = 4;
export const BOT_USERNAME = "Bot";

// A cell holds a player identifier (a username) or null when empty. The
// engine is marker-agnostic — any non-empty string is a valid stone — so
// the same functions drive both the bot and human players.
export const CellSchema = z.string().min(1).nullable();
export type Cell = z.infer<typeof CellSchema>;

export const BoardSchema = z.array(z.array(CellSchema));
export type Board = z.infer<typeof BoardSchema>;

// Rooms only ever sit in "waiting" (no humans yet) or "playing". There is
// no auto-end state — a 5-in-a-row is a scoring event, not a game over.
export const GameStatusSchema = z.enum(["waiting", "playing"]);
export type GameStatus = z.infer<typeof GameStatusSchema>;

// 1-16 chars, ASCII letters/digits/underscore only. CJK was considered but
// dropped — round-tripping non-ASCII through URL paths, KV keys, and shell
// scripts adds bugs without enough product value to justify it.
export const UsernameSchema = z
	.string()
	.min(1)
	.max(16)
	.regex(/^[a-zA-Z0-9_]+$/, "用户名只能含字母、数字、下划线");

// 64-char hex token issued at claim time.
export const TokenSchema = z.string().length(128).regex(/^[a-f0-9]+$/);

// 6-char base32 (Crockford minus 0/O/1/I/L, plus letters).
export const RoomCodeSchema = z.string().length(6).regex(/^[A-HJ-NP-Z2-9]+$/);

// Up to 5 seats per room (4 humans + 1 bot); each seat gets a distinct
// color drawn from this palette. The bot always sits last and gets the
// final slot (amber).
export const PlayerColorSchema = z.enum([
	"black",
	"white",
	"red",
	"blue",
	"amber",
]);
export type PlayerColor = z.infer<typeof PlayerColorSchema>;

export const RoomVisibilitySchema = z.enum(["public", "private"]);
export type RoomVisibility = z.infer<typeof RoomVisibilitySchema>;

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
	score: z.number().int().nonnegative(),
	gamesPlayed: z.number().int().nonnegative(),
});
export type ClaimResponse = z.infer<typeof ClaimResponseSchema>;

export const CreateRoomRequestSchema = z.object({
	username: UsernameSchema,
	token: TokenSchema,
	visibility: RoomVisibilitySchema,
});
export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;

export const CreateRoomResponseSchema = z.object({
	roomCode: RoomCodeSchema,
	visibility: RoomVisibilitySchema,
});
export type CreateRoomResponse = z.infer<typeof CreateRoomResponseSchema>;

// Public lobby view — only includes public rooms; visibility is omitted
// because every entry in the list is by definition public.
export const RoomSummarySchema = z.object({
	code: RoomCodeSchema,
	status: GameStatusSchema,
	playerCount: z.number().int().min(0).max(MAX_HUMANS_PER_ROOM + 1),
	players: z.array(UsernameSchema),
});
export type RoomSummary = z.infer<typeof RoomSummarySchema>;

export const ListRoomsResponseSchema = z.object({
	rooms: z.array(RoomSummarySchema),
});
export type ListRoomsResponse = z.infer<typeof ListRoomsResponseSchema>;

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

// Any seated player can ask the room to start a fresh round once the
// previous one finished. Resets the board and per-room scores.
export const ClientRestartSchema = z.object({
	type: z.literal("restart"),
});

export const ClientMessageSchema = z.discriminatedUnion("type", [
	ClientJoinSchema,
	ClientPlaceSchema,
	ClientResignSchema,
	ClientRestartSchema,
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ---------- WebSocket messages: server → client ----------

export const RoomPlayerSchema = z.object({
	username: UsernameSchema,
	color: PlayerColorSchema,
	isBot: z.boolean(),
	connected: z.boolean(),
	score: z.number().int().nonnegative(),
});
export type RoomPlayer = z.infer<typeof RoomPlayerSchema>;

export const ServerStateSchema = z.object({
	type: z.literal("state"),
	board: BoardSchema,
	players: z.array(RoomPlayerSchema),
	// Username of the player whose turn it is; null when status != "playing".
	turn: UsernameSchema.nullable(),
	status: GameStatusSchema,
	visibility: RoomVisibilitySchema,
});

export const ServerMoveSchema = z.object({
	type: z.literal("move"),
	row: z.number().int(),
	col: z.number().int(),
	by: UsernameSchema,
});

// Sent right after a move that triggered the 5-in-a-row clear+disrupt rule.
// The state message that follows carries the post-clear board. The optional
// poem rides along with any clear that awarded points — the client surfaces
// it briefly in the page header (room-scoped: broadcast is per-DO).
export const ServerClearSchema = z.object({
	type: z.literal("clear"),
	by: UsernameSchema,
	clearedSelf: z.number().int().nonnegative(),
	// username → number-of-stones-removed for every other player on board.
	removedFromOpponents: z.record(UsernameSchema, z.number().int().nonnegative()),
	pointsAwarded: z.number().int().nonnegative(),
	poem: PoemSchema.optional(),
});

// Sent when a player's turn auto-advances because they didn't move
// within the per-turn deadline. Broadcast to the whole room so the
// UI can surface "X 超时跳过" without inferring it from the state diff.
export const ServerTimeoutSchema = z.object({
	type: z.literal("timeout"),
	username: UsernameSchema,
});

export const ServerErrorSchema = z.object({
	type: z.literal("error"),
	code: z.string(),
	message: z.string(),
});

export const ServerMessageSchema = z.discriminatedUnion("type", [
	ServerStateSchema,
	ServerMoveSchema,
	ServerClearSchema,
	ServerTimeoutSchema,
	ServerErrorSchema,
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
