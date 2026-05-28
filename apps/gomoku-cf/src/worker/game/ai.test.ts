import { describe, expect, it } from "vitest";
import { BOARD_SIZE, type Board } from "../../shared/protocol";
import { randomMove, smartMove } from "./ai";
import { createBoard } from "./board";

function withStones(stones: Array<[number, number, string]>): Board {
	const b = createBoard();
	for (const [r, c, s] of stones) b[r][c] = s;
	return b;
}

const CENTER = Math.floor((BOARD_SIZE - 1) / 2); // 7

describe("randomMove", () => {
	it("picks an empty cell on an empty board", () => {
		const [r, c] = randomMove(createBoard(), () => 0)!;
		expect(r).toBe(0);
		expect(c).toBe(0);
	});

	it("returns null on a full board", () => {
		const b = createBoard().map((row) => row.map((): string => "black"));
		expect(randomMove(b)).toBe(null);
	});

	it("never picks an occupied cell", () => {
		const b = withStones([[0, 0, "black"]]);
		// rng=0 → first empty; with (0,0) taken, first empty is (0,1).
		const move = randomMove(b, () => 0)!;
		expect(b[move[0]][move[1]]).toBe(null);
		expect(move).toEqual([0, 1]);
	});
});

describe("smartMove", () => {
	it("plays near the center on an empty board", () => {
		const [r, c] = smartMove(createBoard(), "black", "white");
		expect(r).toBe(CENTER);
		expect(c).toBe(CENTER);
	});

	it("completes its own 5-in-a-row when possible", () => {
		// 4 in a row at row 7 cols 0-3, AI is black; (7,4) completes it.
		const b = withStones([
			[7, 0, "black"],
			[7, 1, "black"],
			[7, 2, "black"],
			[7, 3, "black"],
		]);
		const move = smartMove(b, "black", "white");
		expect(move).toEqual([7, 4]);
	});

	it("completes a 5-in-a-row by filling a gap in the middle", () => {
		// X X _ X X — placing at (7,2) gives 5 through-going.
		const b = withStones([
			[7, 0, "black"],
			[7, 1, "black"],
			[7, 3, "black"],
			[7, 4, "black"],
		]);
		const move = smartMove(b, "black", "white");
		expect(move).toEqual([7, 2]);
	});

	it("blocks opponent's about-to-win 5-in-a-row", () => {
		// White has 4 in a row at row 5 cols 0-3, black must block at (5,4).
		const b = withStones([
			[5, 0, "white"],
			[5, 1, "white"],
			[5, 2, "white"],
			[5, 3, "white"],
		]);
		const move = smartMove(b, "black", "white");
		// AI should block at one of the endpoints; (5,4) is reachable, (5,-1) is not.
		expect(move).toEqual([5, 4]);
	});

	it("prefers completing own 5-in-a-row over blocking opponent's 4", () => {
		// Both sides have 4-in-a-row open at the next cell.
		// Black at row 3 cols 0-3 — completing at (3,4) wins immediately.
		// White at row 10 cols 0-3 — blocking at (10,4) prevents white winning next turn.
		// The "complete-5" reward is much bigger than "block-4", so AI completes its own.
		const b = withStones([
			[3, 0, "black"],
			[3, 1, "black"],
			[3, 2, "black"],
			[3, 3, "black"],
			[10, 0, "white"],
			[10, 1, "white"],
			[10, 2, "white"],
			[10, 3, "white"],
		]);
		const move = smartMove(b, "black", "white");
		expect(move).toEqual([3, 4]);
	});

	it("returns a legal (empty) cell even in cluttered positions", () => {
		const b = withStones([
			[7, 7, "black"],
			[7, 8, "white"],
			[8, 7, "white"],
			[8, 8, "black"],
		]);
		const [r, c] = smartMove(b, "black", "white");
		expect(b[r][c]).toBe(null);
	});
});
