import { BOARD_SIZE, type Board, type Stone } from "../../shared/protocol";
import { inBounds, defaultRng, type Rng } from "./board";

const DIRECTIONS = [
	[0, 1],
	[1, 0],
	[1, 1],
	[1, -1],
] as const;

const CENTER = (BOARD_SIZE - 1) / 2;

/** Random legal move. Returns null only if the board is completely full. */
export function randomMove(board: Board, rng: Rng = defaultRng): [number, number] | null {
	const empties: Array<[number, number]> = [];
	for (let r = 0; r < BOARD_SIZE; r++) {
		for (let c = 0; c < BOARD_SIZE; c++) {
			if (board[r][c] === null) empties.push([r, c]);
		}
	}
	if (empties.length === 0) return null;
	return empties[Math.floor(rng() * empties.length)];
}

/**
 * Longest consecutive run of `stone` that would exist if we hypothetically
 * placed `stone` at (r, c), looking in both directions through (r, c) for
 * each of the 4 axes. (r, c) itself is counted as `stone` for this query.
 *
 * Fixes the Java original's `checkLine` which only counted in one direction.
 */
function maxRunIfPlaced(
	board: Board,
	r: number,
	c: number,
	stone: Stone
): number {
	let best = 0;
	for (const [dr, dc] of DIRECTIONS) {
		let count = 1;
		for (let i = 1; ; i++) {
			const nr = r + i * dr;
			const nc = c + i * dc;
			if (!inBounds(nr, nc) || board[nr][nc] !== stone) break;
			count++;
		}
		for (let i = 1; ; i++) {
			const nr = r - i * dr;
			const nc = c - i * dc;
			if (!inBounds(nr, nc) || board[nr][nc] !== stone) break;
			count++;
		}
		if (count > best) best = count;
	}
	return best;
}

/**
 * Smart move:
 *   1. If we can complete a 5-in-a-row (which triggers the clear + disrupt
 *      event in this game), prefer that.
 *   2. Otherwise, if the opponent would complete a 5-in-a-row by playing some
 *      cell next turn, block it.
 *   3. Otherwise, maximize our own longest run (build position), with a tiny
 *      center bias to break ties.
 *
 * Cells immediately adjacent to existing stones are scanned first; only if
 * the board is empty do we play the center.
 *
 * Deterministic given the board (tie breaks always pick the same cell), no
 * RNG needed unless extending to randomized policies later.
 */
export function smartMove(
	board: Board,
	self: Stone,
	opponent: Stone
): [number, number] {
	let bestScore = -Infinity;
	let bestMove: [number, number] = [Math.floor(CENTER), Math.floor(CENTER)];
	let anyEmpty = false;

	for (let r = 0; r < BOARD_SIZE; r++) {
		for (let c = 0; c < BOARD_SIZE; c++) {
			if (board[r][c] !== null) continue;
			anyEmpty = true;

			const myRun = maxRunIfPlaced(board, r, c, self);
			const theirRun = maxRunIfPlaced(board, r, c, opponent);

			// Big jumps at the 5-run threshold so completing/blocking dominates.
			const myWeight = myRun >= 5 ? 10_000 : myRun;
			const theirWeight = theirRun >= 5 ? 9_000 : theirRun - 0.5;

			const centerBias =
				-((Math.abs(r - CENTER) + Math.abs(c - CENTER)) * 0.01);

			const score = Math.max(myWeight, theirWeight) + centerBias;

			if (score > bestScore) {
				bestScore = score;
				bestMove = [r, c];
			}
		}
	}

	if (!anyEmpty) {
		// Practically unreachable in this game (board is cleared on 5-run),
		// but keeps the type narrow.
		return bestMove;
	}
	return bestMove;
}
