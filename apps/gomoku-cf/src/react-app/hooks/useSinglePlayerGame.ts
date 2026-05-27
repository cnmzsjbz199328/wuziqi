import { useCallback, useEffect, useRef, useState } from "react";
import type { Stone } from "../../shared/protocol";
import {
	aiPick,
	applyMove,
	initialState,
	type ClearEvent,
	type GameState,
} from "../lib/singlePlayer";

interface Options {
	playerStone?: Stone;
	/** Delay before the AI move so the player can see their own stone land. */
	aiDelayMs?: number;
	/** Called once per ClearEvent triggered by the player (delta > 0). */
	onPlayerScore?: (delta: number) => void;
}

export function useSinglePlayerGame({
	playerStone = "black",
	aiDelayMs = 500,
	onPlayerScore,
}: Options = {}) {
	const [state, setState] = useState<GameState>(() => initialState(playerStone));
	const eventIdRef = useRef(0);
	const lastFiredEventRef = useRef<ClearEvent | null>(null);

	const nextEventId = useCallback(() => ++eventIdRef.current, []);

	// AI turn — schedule via timeout so the UI can render the player's move first.
	useEffect(() => {
		if (state.turn !== state.aiStone) return;
		const handle = window.setTimeout(() => {
			setState((s) => {
				if (s.turn !== s.aiStone) return s;
				const { row, col } = aiPick(s);
				return applyMove(s, row, col, { eventId: nextEventId() });
			});
		}, aiDelayMs);
		return () => window.clearTimeout(handle);
	}, [state.turn, state.aiStone, aiDelayMs, nextEventId]);

	// Fire onPlayerScore once per qualifying event.
	useEffect(() => {
		const ev = state.lastEvent;
		if (!ev || ev === lastFiredEventRef.current) return;
		lastFiredEventRef.current = ev;
		if (ev.playerScoreDelta > 0 && onPlayerScore) {
			onPlayerScore(ev.playerScoreDelta);
		}
	}, [state.lastEvent, onPlayerScore]);

	const place = useCallback(
		(row: number, col: number) => {
			setState((s) => {
				if (s.turn !== s.playerStone) return s;
				return applyMove(s, row, col, { eventId: nextEventId() });
			});
		},
		[nextEventId]
	);

	const reset = useCallback(() => {
		lastFiredEventRef.current = null;
		setState(initialState(playerStone));
	}, [playerStone]);

	const isPlayerTurn = state.turn === state.playerStone;

	return { state, place, reset, isPlayerTurn };
}
