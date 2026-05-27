import { describe, expect, it } from "vitest";
import { BOARD_SIZE, type Board, type Stone } from "../../shared/protocol";
import {
	clearWinningLines,
	createBoard,
	emptyCellCount,
	hasFiveInARow,
	isBoardEmpty,
	placeStone,
	scoreForClear,
} from "./board";

function withStones(stones: Array<[number, number, Stone]>): Board {
	const b = createBoard();
	for (const [r, c, s] of stones) b[r][c] = s;
	return b;
}

function lineOfStones(
	r: number,
	c: number,
	dr: number,
	dc: number,
	count: number,
	stone: Stone
): Array<[number, number, Stone]> {
	const result: Array<[number, number, Stone]> = [];
	for (let i = 0; i < count; i++) result.push([r + i * dr, c + i * dc, stone]);
	return result;
}

// Sequential RNG so removals are deterministic in tests.
function seqRng(values: number[]): () => number {
	let i = 0;
	return () => values[i++ % values.length];
}

describe("createBoard", () => {
	it("creates a 15x15 grid of nulls", () => {
		const b = createBoard();
		expect(b.length).toBe(BOARD_SIZE);
		expect(b[0].length).toBe(BOARD_SIZE);
		expect(b.flat().every((c) => c === null)).toBe(true);
	});
});

describe("placeStone", () => {
	it("places on an empty cell and returns a new board", () => {
		const a = createBoard();
		const r = placeStone(a, 7, 7, "black");
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.board[7][7]).toBe("black");
			// original untouched (immutability)
			expect(a[7][7]).toBe(null);
			// other identity: rows that didn't change should still be the same array refs
			// (board is "shallow clone of rows" — we don't enforce this, but value-equality matters)
			expect(r.board).not.toBe(a);
		}
	});

	it("rejects out-of-bounds", () => {
		const a = createBoard();
		for (const [r, c] of [
			[-1, 0],
			[0, -1],
			[BOARD_SIZE, 0],
			[0, BOARD_SIZE],
		]) {
			const res = placeStone(a, r, c, "black");
			expect(res.ok).toBe(false);
			if (!res.ok) expect(res.reason).toBe("out_of_bounds");
		}
	});

	it("rejects occupied cells regardless of color", () => {
		const a = withStones([[3, 3, "black"]]);
		const sameColor = placeStone(a, 3, 3, "black");
		const otherColor = placeStone(a, 3, 3, "white");
		expect(sameColor.ok).toBe(false);
		expect(otherColor.ok).toBe(false);
		if (!sameColor.ok) expect(sameColor.reason).toBe("occupied");
	});
});

describe("hasFiveInARow", () => {
	it("returns false on empty board", () => {
		expect(hasFiveInARow(createBoard(), "black")).toBe(false);
	});

	it.each([
		["horizontal", 0, 1],
		["vertical", 1, 0],
		["main diagonal", 1, 1],
		["anti diagonal", 1, -1],
	])("detects 5-in-a-row %s", (_label, dr, dc) => {
		const startR = dr < 0 ? 4 : 0;
		const startC = dc < 0 ? 4 : 0;
		const b = withStones(lineOfStones(startR, startC, dr, dc, 5, "black"));
		expect(hasFiveInARow(b, "black")).toBe(true);
		expect(hasFiveInARow(b, "white")).toBe(false);
	});

	it("does not count 4-in-a-row", () => {
		const b = withStones(lineOfStones(7, 0, 0, 1, 4, "black"));
		expect(hasFiveInARow(b, "black")).toBe(false);
	});

	it("does not bridge across a gap", () => {
		const b = withStones([
			[7, 0, "black"],
			[7, 1, "black"],
			[7, 2, "black"],
			// gap at 7,3
			[7, 4, "black"],
			[7, 5, "black"],
		]);
		expect(hasFiveInARow(b, "black")).toBe(false);
	});

	it("does not bridge across an opposing stone", () => {
		const b = withStones([
			[7, 0, "black"],
			[7, 1, "black"],
			[7, 2, "white"],
			[7, 3, "black"],
			[7, 4, "black"],
			[7, 5, "black"],
		]);
		expect(hasFiveInARow(b, "black")).toBe(false);
	});

	it("detects longer runs too", () => {
		const b = withStones(lineOfStones(7, 0, 0, 1, 7, "black"));
		expect(hasFiveInARow(b, "black")).toBe(true);
	});
});

describe("clearWinningLines", () => {
	it("no-op when no 5-in-a-row exists", () => {
		const b = withStones([
			[0, 0, "black"],
			[7, 7, "white"],
		]);
		const r = clearWinningLines(b, "black");
		expect(r.clearedSelf).toBe(0);
		expect(r.removedFromOpponents).toEqual({});
		// immutability
		expect(b[0][0]).toBe("black");
		expect(r.board[0][0]).toBe("black");
	});

	it("clears exactly the 5 stones of a single 5-in-a-row", () => {
		const b = withStones(lineOfStones(7, 0, 0, 1, 5, "black"));
		const r = clearWinningLines(b, "black", seqRng([0]));
		expect(r.clearedSelf).toBe(5);
		expect(scoreForClear(r.clearedSelf)).toBe(1);
		for (let c = 0; c < 5; c++) expect(r.board[7][c]).toBe(null);
	});

	it("a 6-long run clears all 6 (extended run de-duplicated)", () => {
		const b = withStones(lineOfStones(7, 0, 0, 1, 6, "black"));
		const r = clearWinningLines(b, "black");
		expect(r.clearedSelf).toBe(6);
		expect(scoreForClear(r.clearedSelf)).toBe(2);
		for (let c = 0; c < 6; c++) expect(r.board[7][c]).toBe(null);
	});

	it("two perpendicular 5-runs sharing one stone clear all 9 unique cells", () => {
		// horizontal at row 7, cols 0-4 + vertical at col 0, rows 7-11.
		// (7,0) is the shared corner.
		const b = withStones([
			...lineOfStones(7, 0, 0, 1, 5, "black"),
			...lineOfStones(7, 0, 1, 0, 5, "black"),
		]);
		const r = clearWinningLines(b, "black");
		expect(r.clearedSelf).toBe(9); // 5 + 5 - 1 shared
		expect(scoreForClear(r.clearedSelf)).toBe(5);
	});

	it("removes exactly clearedSelf opponent stones when opponent has enough", () => {
		const b = withStones([
			...lineOfStones(7, 0, 0, 1, 5, "black"),
			// 8 white stones available — should remove 5
			[0, 0, "white"],
			[0, 1, "white"],
			[0, 2, "white"],
			[0, 3, "white"],
			[0, 4, "white"],
			[1, 0, "white"],
			[1, 1, "white"],
			[1, 2, "white"],
		]);
		const r = clearWinningLines(b, "black", seqRng([0]));
		expect(r.clearedSelf).toBe(5);
		expect(r.removedFromOpponents.white).toBe(5);
		// count remaining whites: should be 8 - 5 = 3
		let whites = 0;
		for (const row of r.board) for (const cell of row) if (cell === "white") whites++;
		expect(whites).toBe(3);
	});

	it("removes all opponent stones when opponent has fewer than clearedSelf", () => {
		const b = withStones([
			...lineOfStones(7, 0, 0, 1, 5, "black"),
			[0, 0, "white"],
			[0, 1, "white"],
		]);
		const r = clearWinningLines(b, "black", seqRng([0]));
		expect(r.clearedSelf).toBe(5);
		expect(r.removedFromOpponents.white).toBe(2);
		let whites = 0;
		for (const row of r.board) for (const cell of row) if (cell === "white") whites++;
		expect(whites).toBe(0);
	});

	it("does not touch opponent if no clear happened", () => {
		const b = withStones([
			[0, 0, "black"],
			[1, 1, "white"],
			[2, 2, "white"],
		]);
		const r = clearWinningLines(b, "black");
		expect(r.clearedSelf).toBe(0);
		// whites untouched
		expect(r.board[1][1]).toBe("white");
		expect(r.board[2][2]).toBe("white");
	});

	it("is pure: original board reference unchanged after call", () => {
		const b = withStones(lineOfStones(7, 0, 0, 1, 5, "black"));
		const snapshot = b.map((row) => row.slice());
		clearWinningLines(b, "black", seqRng([0]));
		expect(b).toEqual(snapshot);
	});
});

describe("scoreForClear", () => {
	it("returns clearedSelf - 4, clamped to 0", () => {
		expect(scoreForClear(0)).toBe(0);
		expect(scoreForClear(3)).toBe(0);
		expect(scoreForClear(4)).toBe(0);
		expect(scoreForClear(5)).toBe(1);
		expect(scoreForClear(6)).toBe(2);
		expect(scoreForClear(9)).toBe(5);
	});
});

describe("isBoardEmpty / emptyCellCount", () => {
	it("recognises an empty board", () => {
		expect(isBoardEmpty(createBoard())).toBe(true);
		expect(emptyCellCount(createBoard())).toBe(BOARD_SIZE * BOARD_SIZE);
	});

	it("counts non-empty correctly", () => {
		const b = withStones([
			[0, 0, "black"],
			[1, 1, "white"],
		]);
		expect(isBoardEmpty(b)).toBe(false);
		expect(emptyCellCount(b)).toBe(BOARD_SIZE * BOARD_SIZE - 2);
	});
});
