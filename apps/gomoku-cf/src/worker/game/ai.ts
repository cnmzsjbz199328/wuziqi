import { BOARD_SIZE, type Board } from "../../shared/protocol";
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
 * Longest consecutive run of `marker` that would exist if we hypothetically
 * placed `marker` at (r, c), looking in both directions through (r, c) for
 * each of the 4 axes. (r, c) itself is counted as `marker` for this query.
 *
 * Fixes the Java original's `checkLine` which only counted in one direction.
 */
function maxRunIfPlaced(
	board: Board,
	r: number,
	c: number,
	marker: string
): number {
	let best = 0;
	for (const [dr, dc] of DIRECTIONS) {
		let count = 1;
		for (let i = 1; ; i++) {
			const nr = r + i * dr;
			const nc = c + i * dc;
			if (!inBounds(nr, nc) || board[nr][nc] !== marker) break;
			count++;
		}
		for (let i = 1; ; i++) {
			const nr = r - i * dr;
			const nc = c - i * dc;
			if (!inBounds(nr, nc) || board[nr][nc] !== marker) break;
			count++;
		}
		if (count > best) best = count;
	}
	return best;
}

/**
 * Smart move policy (extended for N-player rooms):
 *   1. If we can complete a 5-in-a-row (which triggers the clear + disrupt
 *      event in this game), prefer that.
 *   2. Otherwise, if *any* opponent would complete a 5-in-a-row by playing
 *      some cell next turn, block the most threatening one.
 *   3. Otherwise, maximize our own longest run (build position), with a tiny
 *      center bias to break ties.
 *
 * `opponents` may be a single string (legacy single-player call site) or an
 * array of opponent identifiers (multi-player). An empty array degrades
 * gracefully to pure offence + center bias.
 *
 * Deterministic given the board (tie breaks always pick the same cell), no
 * RNG needed unless extending to randomized policies later.
 */
export function smartMove(
	board: Board,
	self: string,
	opponents: string | readonly string[]
): [number, number] {
	const opps = typeof opponents === "string" ? [opponents] : opponents;

	let bestScore = -Infinity;
	let bestMove: [number, number] = [Math.floor(CENTER), Math.floor(CENTER)];
	let anyEmpty = false;

	for (let r = 0; r < BOARD_SIZE; r++) {
		for (let c = 0; c < BOARD_SIZE; c++) {
			if (board[r][c] !== null) continue;
			anyEmpty = true;

			const myRun = maxRunIfPlaced(board, r, c, self);
			let worstOppRun = 0;
			for (const opp of opps) {
				const run = maxRunIfPlaced(board, r, c, opp);
				if (run > worstOppRun) worstOppRun = run;
			}

			// Big jumps at the 5-run threshold so completing/blocking dominates.
			const myWeight = myRun >= 5 ? 10_000 : myRun;
			const theirWeight = worstOppRun >= 5 ? 9_000 : worstOppRun - 0.5;

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
