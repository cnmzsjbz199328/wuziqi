import { describe, expect, it } from "vitest";
import { BOARD_SIZE } from "../../shared/protocol";
import { aiPick, applyMove, initialState, opponentOf } from "./singlePlayer";

const noEvents = { eventId: 1 };

describe("initialState", () => {
	it("defaults to player=black, turn=black, empty board", () => {
		const s = initialState();
		expect(s.playerStone).toBe("black");
		expect(s.aiStone).toBe("white");
		expect(s.turn).toBe("black");
		expect(s.board.flat().every((c) => c === null)).toBe(true);
	});

	it("respects requested player stone", () => {
		const s = initialState("white");
		expect(s.playerStone).toBe("white");
		expect(s.aiStone).toBe("black");
	});
});

describe("applyMove", () => {
	it("places a stone and advances the turn", () => {
		const s = initialState();
		const next = applyMove(s, 7, 7, noEvents);
		expect(next.board[7][7]).toBe("black");
		expect(next.turn).toBe("white");
		expect(next.lastMove).toEqual({ row: 7, col: 7 });
		expect(next.moveCount).toBe(1);
		expect(next.lastEvent).toBeNull();
	});

	it("is a no-op on an occupied cell (returns same reference)", () => {
		const s = applyMove(initialState(), 7, 7, noEvents);
		const again = applyMove(s, 7, 7, noEvents);
		expect(again).toBe(s);
	});

	it("does not mutate the previous board array", () => {
		const s = initialState();
		applyMove(s, 7, 7, noEvents);
		expect(s.board[7][7]).toBeNull();
	});

	it("fires a player-scoring ClearEvent on player's 5-in-a-row", () => {
		// Build a state where black has 4 in a row and it's black's turn.
		let s = initialState();
		// pre-seed black at (0,0)-(0,3) by alternating, then deleting white ghosts
		for (let i = 0; i < 4; i++) {
			s = applyMove(s, 0, i, noEvents); // black
			s = applyMove(s, BOARD_SIZE - 1, i, noEvents); // white (out of the way)
		}
		// black to move, completes 5 at (0,4)
		const next = applyMove(s, 0, 4, { eventId: 42, rng: () => 0 });
		expect(next.lastEvent?.id).toBe(42);
		expect(next.lastEvent?.by).toBe("black");
		expect(next.lastEvent?.clearedSelf).toBe(5);
		expect(next.lastEvent?.playerScoreDelta).toBe(1); // 5 - 4
		// All 5 black stones removed
		for (let i = 0; i < 5; i++) expect(next.board[0][i]).toBeNull();
		// Same number of opponent (white) stones randomly removed
		expect(next.lastEvent?.removedFromOpponents.white).toBe(4); // only 4 whites exist
	});

	it("ClearEvent.playerScoreDelta is 0 when the AI triggers the clear", () => {
		let s = initialState("black"); // player=black, ai=white
		// We'll fake: white has 4 in a row, it's white's turn, white plays the 5th.
		// Easiest: manually push to white via alternating.
		const moves: Array<[number, number]> = [
			[5, 5], [1, 1], // B,W
			[5, 6], [1, 2], // B,W
			[5, 7], [1, 3], // B,W
			[5, 8], [1, 4], // B,W
			[6, 0], [1, 0], // B,W completes 5 at row 1
		];
		for (const [r, c] of moves) {
			s = applyMove(s, r, c, { eventId: s.moveCount + 1, rng: () => 0 });
		}
		expect(s.lastEvent?.by).toBe("white");
		expect(s.lastEvent?.playerScoreDelta).toBe(0);
	});
});

describe("aiPick", () => {
	it("picks center on an empty board (when it's the AI's turn)", () => {
		const s = initialState("white"); // ai=black, opens at center
		const pick = aiPick(s);
		expect(pick).toEqual({ row: 7, col: 7 });
	});

	it("returns a legal in-bounds cell", () => {
		let s = initialState();
		s = applyMove(s, 7, 7, noEvents);
		const pick = aiPick(s);
		expect(pick.row).toBeGreaterThanOrEqual(0);
		expect(pick.row).toBeLessThan(BOARD_SIZE);
		expect(s.board[pick.row][pick.col]).toBeNull();
	});
});

describe("opponentOf", () => {
	it("swaps black and white", () => {
		expect(opponentOf("black")).toBe("white");
		expect(opponentOf("white")).toBe("black");
	});
});
