import { useEffect, useState } from "react";
import type { Poem } from "../../shared/protocol";

const TYPE_INTERVAL_MS = 90;

interface Props {
	event: {
		id: number;
		winner: string | null;
		finalScores: Record<string, number>;
		poem: Poem | null;
	};
	me: string;
	onRestart: () => void;
	onLeave: () => void;
}

/**
 * Full-screen overlay shown when a round ends. Plays the poem
 * character-by-character via JS rather than CSS width-tweening because
 * CJK glyphs are variable-width and the legacy `steps(40, end)` trick
 * either chopped long poems or finished short ones too fast.
 */
export function EndScreen({ event, me, onRestart, onLeave }: Props) {
	const poemText = event.poem?.text ?? "";
	const [visible, setVisible] = useState(0);

	useEffect(() => {
		setVisible(0);
		if (!poemText) return;
		const id = window.setInterval(() => {
			setVisible((v) => {
				if (v >= poemText.length) {
					window.clearInterval(id);
					return v;
				}
				return v + 1;
			});
		}, TYPE_INTERVAL_MS);
		return () => window.clearInterval(id);
	}, [event.id, poemText]);

	const done = visible >= poemText.length;
	const iWon = event.winner === me;

	return (
		<div className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-sm flex items-center justify-center px-4">
			<div className="bg-stone-900 border border-stone-700 rounded-xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl">
				<div className="text-center space-y-1">
					<h2
						className={`text-2xl font-bold ${
							iWon ? "text-emerald-400" : "text-stone-200"
						}`}
					>
						{iWon
							? "你赢了"
							: event.winner
							? `${event.winner} 获胜`
							: "本轮结束"}
					</h2>
					<p className="text-stone-400 text-sm">先达到 5 分者胜</p>
				</div>

				{event.poem && (
					<div className="bg-stone-800/80 border border-stone-700 rounded-lg p-5 text-center">
						<p className="text-amber-100 text-lg leading-relaxed whitespace-pre-line min-h-[3.5rem]">
							{poemText.slice(0, visible)}
							{!done && <span className="poem-caret text-amber-300" />}
						</p>
						{event.poem.author && done && (
							<p className="text-stone-400 text-xs mt-3">
								— {event.poem.author}
							</p>
						)}
					</div>
				)}

				<div>
					<h3 className="text-stone-400 text-xs uppercase tracking-wider mb-2">
						最终得分
					</h3>
					<ul className="space-y-1">
						{Object.entries(event.finalScores)
							.sort(([, a], [, b]) => b - a)
							.map(([name, score]) => (
								<li
									key={name}
									className="flex justify-between text-sm border-b border-stone-800 py-1 last:border-0"
								>
									<span
										className={
											name === event.winner
												? "text-amber-300 font-medium"
												: name === me
												? "text-emerald-300"
												: "text-stone-200"
										}
									>
										{name}
									</span>
									<span className="text-amber-300 tabular-nums">{score}</span>
								</li>
							))}
					</ul>
				</div>

				<div className="grid grid-cols-2 gap-3">
					<button
						type="button"
						onClick={onLeave}
						className="bg-stone-700 hover:bg-stone-600 text-stone-100 px-4 py-2.5 rounded transition-colors"
					>
						换房间
					</button>
					<button
						type="button"
						onClick={onRestart}
						className="bg-emerald-700 hover:bg-emerald-600 text-stone-50 px-4 py-2.5 rounded transition-colors"
					>
						再来一局
					</button>
				</div>
			</div>
		</div>
	);
}
