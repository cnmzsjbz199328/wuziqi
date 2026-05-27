import { useEffect, useState } from "react";
import type { Poem } from "../../shared/protocol";

const TYPE_INTERVAL_MS = 90;
const HOLD_AFTER_TYPING_MS = 10_000;

interface Props {
	poem: Poem | null;
	onDone: () => void;
}

/**
 * Replaces the page title with a typewritten poem after a clear event,
 * holds it for ~10s once typing completes, then signals onDone so App
 * can swap back to "五子棋". Plays a blinking caret while typing.
 *
 * Each new `poem` prop (compared by reference) resets and replays the
 * animation from scratch — that's how multiple clear events in a row
 * end up overwriting each other smoothly.
 */
export function PoemHeader({ poem, onDone }: Props) {
	const [visible, setVisible] = useState(0);

	useEffect(() => {
		if (!poem) return;
		setVisible(0);
		const text = poem.text;
		const typing = window.setInterval(() => {
			setVisible((v) => {
				if (v >= text.length) {
					window.clearInterval(typing);
					return v;
				}
				return v + 1;
			});
		}, TYPE_INTERVAL_MS);

		// Schedule the dismiss based on full type duration + hold.
		const totalMs = text.length * TYPE_INTERVAL_MS + HOLD_AFTER_TYPING_MS;
		const dismiss = window.setTimeout(onDone, totalMs);

		return () => {
			window.clearInterval(typing);
			window.clearTimeout(dismiss);
		};
	}, [poem, onDone]);

	if (!poem) {
		return <h1 className="text-xl font-bold">五子棋</h1>;
	}

	const done = visible >= poem.text.length;
	return (
		<div className="flex items-baseline gap-3 min-w-0 flex-1">
			<span className="text-amber-100 text-base sm:text-lg leading-tight tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
				{poem.text.slice(0, visible)}
				{!done && <span className="poem-caret text-amber-300" />}
			</span>
			{done && poem.author && (
				<span className="text-stone-500 text-xs whitespace-nowrap hidden sm:inline">
					— {poem.author}
				</span>
			)}
		</div>
	);
}
