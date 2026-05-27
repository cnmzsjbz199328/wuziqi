// Pure single-player game state machine: human vs. local AI.
//
// All functions return a new state — never mutate the input. Side effects
// (timers, score uploads) live in the React hook that consumes this module.

import {
	type Board,
	type Stone,
} from "../../shared/protocol";
import {
	clearWinningLines,
	createBoard,
	hasFiveInARow,
	placeStone,
	scoreForClear,
	type Rng,
} from "../../worker/game/board";
import { smartMove } from "../../worker/game/ai";

export interface ClearEvent {
	id: number;
	by: Stone;
	clearedSelf: number;
	removedFromOpponents: Partial<Record<Stone, number>>;
	/** Points awarded to the local player (0 when the AI triggered the clear). */
	playerScoreDelta: number;
}

export interface GameState {
	board: Board;
	turn: Stone;
	playerStone: Stone;
	aiStone: Stone;
	lastMove: { row: number; col: number } | null;
	lastEvent: ClearEvent | null;
	moveCount: number;
}

export function opponentOf(stone: Stone): Stone {
	return stone === "black" ? "white" : "black";
}

export function initialState(playerStone: Stone = "black"): GameState {
	return {
		board: createBoard(),
		turn: "black", // black always opens
		playerStone,
		aiStone: opponentOf(playerStone),
		lastMove: null,
		lastEvent: null,
		moveCount: 0,
	};
}

interface MoveOptions {
	rng?: Rng;
	/** Monotonic id used to dedupe ClearEvent firings in React effects. */
	eventId: number;
}

/**
 * Apply a move by the side whose turn it currently is. Handles the
 * 5-in-a-row clear + disrupt event when triggered. Returns the same
 * state object (referentially equal) if the move is illegal — useful
 * for `useState((s) => applyMove(s, ...))` no-ops.
 */
export function applyMove(
	state: GameState,
	row: number,
	col: number,
	opts: MoveOptions
): GameState {
	const placed = placeStone(state.board, row, col, state.turn);
	if (!placed.ok) return state;

	let board = placed.board;
	let lastEvent = state.lastEvent;

	if (hasFiveInARow(board, state.turn)) {
		const result = clearWinningLines(board, state.turn, opts.rng);
		board = result.board;
		const isPlayer = state.turn === state.playerStone;
		lastEvent = {
			id: opts.eventId,
			by: state.turn,
			clearedSelf: result.clearedSelf,
			removedFromOpponents: result.removedFromOpponents,
			playerScoreDelta: isPlayer ? scoreForClear(result.clearedSelf) : 0,
		};
	}

	return {
		...state,
		board,
		turn: opponentOf(state.turn),
		lastMove: { row, col },
		lastEvent,
		moveCount: state.moveCount + 1,
	};
}

/** Compute the AI's next move from the current state. */
export function aiPick(state: GameState): { row: number; col: number } {
	const [row, col] = smartMove(state.board, state.aiStone, state.playerStone);
	return { row, col };
}
