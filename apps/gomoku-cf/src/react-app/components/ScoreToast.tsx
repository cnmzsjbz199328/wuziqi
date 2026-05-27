import { useEffect, useState } from "react";
import type { ClearEvent } from "../lib/singlePlayer";

interface Props {
	event: ClearEvent | null;
	playerStone: "black" | "white";
}

const DISMISS_MS = 4000;

export function ScoreToast({ event, playerStone }: Props) {
	const [dismissedId, setDismissedId] = useState<number | null>(null);

	useEffect(() => {
		if (!event) return;
		const h = window.setTimeout(() => setDismissedId(event.id), DISMISS_MS);
		return () => window.clearTimeout(h);
	}, [event]);

	if (!event || event.id === dismissedId) return null;

	const byPlayer = event.by === playerStone;
	const opponentLost = Object.values(event.removedFromOpponents).reduce(
		(a, b) => a + (b ?? 0),
		0
	);

	return (
		<div
			role="status"
			className={`fixed top-20 left-1/2 -translate-x-1/2 z-40 px-5 py-3 rounded-lg shadow-lg border text-sm whitespace-pre-line text-center ${
				byPlayer
					? "bg-emerald-900/90 border-emerald-700 text-emerald-100"
					: "bg-red-950/90 border-red-800 text-red-100"
			}`}
		>
			{byPlayer ? (
				<>
					<div className="font-medium">五连!</div>
					<div className="opacity-90">
						清除 {event.clearedSelf} 子,扰乱对手 {opponentLost} 子
					</div>
					<div className="font-medium mt-1">+{event.playerScoreDelta} 分</div>
				</>
			) : (
				<>
					<div className="font-medium">AI 五连</div>
					<div className="opacity-90">你失去 {opponentLost} 子</div>
				</>
			)}
		</div>
	);
}
