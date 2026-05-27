import type { PlayerColor, RoomPlayer } from "../../shared/protocol";

const COLOR_FILL: Record<PlayerColor, string> = {
	black: "#111",
	white: "#fafaf6",
	red: "#dc2626",
	blue: "#2563eb",
	amber: "#d97706",
};

const COLOR_BORDER: Record<PlayerColor, string> = {
	black: "#000",
	white: "#9a9a8e",
	red: "#7f1d1d",
	blue: "#1e3a8a",
	amber: "#78350f",
};

interface Props {
	players: RoomPlayer[];
	turn: string | null;
	me: string;
}

export function PlayerStrip({ players, turn, me }: Props) {
	return (
		<ul className="flex flex-wrap gap-2">
			{players.map((p) => {
				const active = p.username === turn;
				const isMe = p.username === me;
				return (
					<li
						key={p.username}
						className={`flex items-center gap-2 px-3 py-1.5 rounded border text-sm transition-all ${
							active
								? "bg-stone-700 border-emerald-500 shadow-[0_0_0_1px] shadow-emerald-500/40"
								: "bg-stone-800 border-stone-700"
						} ${!p.connected && !p.isBot ? "opacity-50" : ""}`}
					>
						<span
							aria-hidden
							className="inline-block w-4 h-4 rounded-full shrink-0"
							style={{
								backgroundColor: COLOR_FILL[p.color],
								border: `1.5px solid ${COLOR_BORDER[p.color]}`,
							}}
						/>
						<span
							className={`font-medium ${
								isMe ? "text-emerald-300" : "text-stone-100"
							} max-w-[8rem] truncate`}
							title={p.username}
						>
							{p.username}
							{p.isBot && (
								<span className="ml-1 text-stone-400 font-normal">
									(AI)
								</span>
							)}
						</span>
						<span className="text-amber-300 tabular-nums text-xs">
							{p.score}
						</span>
						{!p.connected && !p.isBot && (
							<span className="text-stone-500 text-xs">离线</span>
						)}
					</li>
				);
			})}
		</ul>
	);
}

export function paletteForPlayers(
	players: RoomPlayer[]
): Record<string, { fill: string; stroke: string }> {
	const map: Record<string, { fill: string; stroke: string }> = {};
	for (const p of players) {
		map[p.username] = {
			fill: COLOR_FILL[p.color],
			stroke: COLOR_BORDER[p.color],
		};
	}
	return map;
}
