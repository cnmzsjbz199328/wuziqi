import { useCallback } from "react";
import { Board } from "../components/Board";
import { ScoreToast } from "../components/ScoreToast";
import type { Identity } from "../hooks/useIdentity";
import { useSinglePlayerGame } from "../hooks/useSinglePlayerGame";
import { api } from "../lib/api";

interface Props {
	identity: Identity;
	score: number;
	onScored: (newScore: number) => void;
	onBack: () => void;
}

export function SinglePlayerPage({ identity, score, onScored, onBack }: Props) {
	const submitScore = useCallback(
		async (delta: number) => {
			try {
				const result = await api.score({
					username: identity.username,
					token: identity.token,
					delta,
				});
				onScored(result.score);
			} catch (e) {
				// Non-fatal: the local game continues. A future milestone could
				// queue these for retry — for now we just log and move on.
				console.warn("score submit failed", e);
			}
		},
		[identity.username, identity.token, onScored]
	);

	const { state, place, reset, isPlayerTurn } = useSinglePlayerGame({
		playerStone: "black",
		onPlayerScore: submitScore,
	});

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-2 flex-wrap">
				<button
					type="button"
					onClick={onBack}
					className="text-stone-400 hover:text-stone-200 text-sm py-1.5"
				>
					← 返回
				</button>
				<div className="flex items-baseline gap-2">
					<span
						className={`text-base font-medium ${
							isPlayerTurn ? "text-emerald-400" : "text-stone-300"
						}`}
					>
						{isPlayerTurn ? "你 (黑)" : "AI (白)"}
					</span>
				</div>
				<div className="flex items-baseline gap-2">
					<span className="text-stone-400 text-sm">积分</span>
					<span className="text-base font-medium text-amber-300 tabular-nums">
						{score}
					</span>
				</div>
				<button
					type="button"
					onClick={reset}
					className="bg-stone-700 hover:bg-stone-600 text-stone-100 text-sm px-3 py-2 rounded transition-colors"
				>
					重开
				</button>
			</div>

			<div className="max-w-md mx-auto">
				<Board
					board={state.board}
					lastMove={state.lastMove}
					disabled={!isPlayerTurn}
					onPlace={place}
				/>
			</div>

			<p className="text-stone-500 text-xs text-center px-2">
				五连成线不会结束游戏 —— 得分,清除己方连线,并随机扰乱对手棋子。
			</p>

			<ScoreToast event={state.lastEvent} playerStone={state.playerStone} />
		</div>
	);
}
