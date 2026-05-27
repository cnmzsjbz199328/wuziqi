import {
	BOARD_SIZE,
	WIN_COUNT,
	type Board,
	type Cell,
} from "../../shared/protocol";

export type Rng = () => number; // [0, 1) — same contract as Math.random
export const defaultRng: Rng = Math.random;

/** A 15×15 empty board. */
export function createBoard(): Board {
	return Array.from({ length: BOARD_SIZE }, () =>
		Array.from({ length: BOARD_SIZE }, (): Cell => null)
	);
}

/** Deep-clone a board so callers never mutate the input. */
function cloneBoard(board: Board): Board {
	return board.map((row) => row.slice());
}

export function inBounds(row: number, col: number): boolean {
	return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export type PlaceResult =
	| { ok: true; board: Board }
	| { ok: false; reason: "out_of_bounds" | "occupied" };

/**
 * Place a marker (a player identifier — either a username, or one of the
 * legacy "black"/"white" tags used by single-player mode), returning a new
 * board. The input board is untouched.
 */
export function placeStone(
	board: Board,
	row: number,
	col: number,
	marker: string
): PlaceResult {
	if (!inBounds(row, col)) return { ok: false, reason: "out_of_bounds" };
	if (board[row][col] !== null) return { ok: false, reason: "occupied" };
	const next = cloneBoard(board);
	next[row][col] = marker;
	return { ok: true, board: next };
}

const DIRECTIONS = [
	[0, 1], // horizontal
	[1, 0], // vertical
	[1, 1], // main diagonal
	[1, -1], // anti diagonal
] as const;

/**
 * True if `marker` has any run of WIN_COUNT or more in a row anywhere
 * (horizontal, vertical, or either diagonal).
 */
export function hasFiveInARow(board: Board, marker: string): boolean {
	for (let r = 0; r < BOARD_SIZE; r++) {
		for (let c = 0; c < BOARD_SIZE; c++) {
			if (board[r][c] !== marker) continue;
			for (const [dr, dc] of DIRECTIONS) {
				if (runStartsHere(board, r, c, dr, dc, marker)) return true;
			}
		}
	}
	return false;
}

/**
 * True if (r, c) is the start of a WIN_COUNT-long run of `marker` in
 * direction (dr, dc). "Start" means the cell behind it (r - dr, c - dc) is
 * NOT `marker` (off-board counts as not-marker), so each run is counted
 * exactly once.
 */
function runStartsHere(
	board: Board,
	r: number,
	c: number,
	dr: number,
	dc: number,
	marker: string
): boolean {
	const pr = r - dr;
	const pc = c - dc;
	if (inBounds(pr, pc) && board[pr][pc] === marker) return false;
	for (let i = 0; i < WIN_COUNT; i++) {
		const nr = r + i * dr;
		const nc = c + i * dc;
		if (!inBounds(nr, nc) || board[nr][nc] !== marker) return false;
	}
	return true;
}

export interface ClearResult {
	board: Board;
	/** Number of `marker` cells removed (cells that were part of any 5+ run). */
	clearedSelf: number;
	/**
	 * Per opposing identifier on board at clear time, how many of their
	 * stones were randomly removed. Multi-player rooms expect one entry
	 * per non-winning player; single-player legacy code expects one
	 * entry under the opposing stone color.
	 */
	removedFromOpponents: Record<string, number>;
}

/**
 * The signature non-standard rule:
 * 1. Collect every cell of `marker` that belongs to at least one 5-in-a-row.
 *    (Overlapping/extended runs are de-duplicated.)
 * 2. Remove all those cells.
 * 3. For each opposing marker present on the board, randomly remove
 *    `clearedSelf` of their stones (or all of them if they have fewer).
 *
 * Pure: returns a new board, leaves the input alone.
 */
export function clearWinningLines(
	board: Board,
	marker: string,
	rng: Rng = defaultRng
): ClearResult {
	const toClear = new Set<number>(); // packed (r * BOARD_SIZE + c)

	for (let r = 0; r < BOARD_SIZE; r++) {
		for (let c = 0; c < BOARD_SIZE; c++) {
			if (board[r][c] !== marker) continue;
			for (const [dr, dc] of DIRECTIONS) {
				let i = 0;
				while (
					inBounds(r + i * dr, c + i * dc) &&
					board[r + i * dr][c + i * dc] === marker
				) {
					i++;
				}
				if (i >= WIN_COUNT) {
					for (let k = 0; k < i; k++) {
						toClear.add((r + k * dr) * BOARD_SIZE + (c + k * dc));
					}
				}
			}
		}
	}

	const next = cloneBoard(board);
	for (const packed of toClear) {
		const r = Math.floor(packed / BOARD_SIZE);
		const c = packed % BOARD_SIZE;
		next[r][c] = null;
	}
	const clearedSelf = toClear.size;

	const removedFromOpponents: Record<string, number> = {};
	if (clearedSelf > 0) {
		const opponents = collectOpponents(next, marker);
		for (const opp of opponents) {
			const positions: number[] = [];
			for (let r = 0; r < BOARD_SIZE; r++) {
				for (let c = 0; c < BOARD_SIZE; c++) {
					if (next[r][c] === opp) positions.push(r * BOARD_SIZE + c);
				}
			}
			const removeCount = Math.min(clearedSelf, positions.length);
			for (let i = 0; i < removeCount; i++) {
				const idx = Math.floor(rng() * positions.length);
				const packed = positions[idx];
				positions[idx] = positions[positions.length - 1];
				positions.pop();
				next[Math.floor(packed / BOARD_SIZE)][packed % BOARD_SIZE] = null;
			}
			removedFromOpponents[opp] = removeCount;
		}
	}

	return { board: next, clearedSelf, removedFromOpponents };
}

function collectOpponents(board: Board, self: string): string[] {
	const seen = new Set<string>();
	for (let r = 0; r < BOARD_SIZE; r++) {
		for (let c = 0; c < BOARD_SIZE; c++) {
			const cell = board[r][c];
			if (cell !== null && cell !== self) seen.add(cell);
		}
	}
	return [...seen];
}

/**
 * Score awarded for one clear event.
 *
 * Original Java rule: `totalRemoved - 4`.
 * A single 5-in-a-row → 1 point; a 6-long run → 2; a double-line fork that
 * unions to 8 unique stones → 4; etc. We clamp at 0 so "no clear" is never
 * negative, even though clearWinningLines only invokes scoring when
 * clearedSelf > 0 anyway.
 */
export function scoreForClear(clearedSelf: number): number {
	return Math.max(0, clearedSelf - 4);
}

export function isBoardEmpty(board: Board): boolean {
	for (const row of board) {
		for (const cell of row) {
			if (cell !== null) return false;
		}
	}
	return true;
}

/** Count of empty cells — useful for "board full" guards. */
export function emptyCellCount(board: Board): number {
	let n = 0;
	for (const row of board) {
		for (const cell of row) {
			if (cell === null) n++;
		}
	}
	return n;
}
