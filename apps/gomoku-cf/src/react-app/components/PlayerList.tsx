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

export function PlayerList({ players, turn, me }: Props) {
	return (
		<ul className="space-y-1">
			{players.map((p) => {
				const active = p.username === turn;
				const isMe = p.username === me;
				return (
					<li
						key={p.username}
						className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-sm transition-all ${
							active
								? "bg-stone-700 border-emerald-500"
								: "bg-stone-800/60 border-stone-700"
						} ${!p.connected && !p.isBot ? "opacity-50" : ""}`}
					>
						<span
							aria-hidden
							className="inline-block w-3.5 h-3.5 rounded-full shrink-0"
							style={{
								backgroundColor: COLOR_FILL[p.color],
								border: `1.5px solid ${COLOR_BORDER[p.color]}`,
							}}
						/>
						<span
							className={`font-medium truncate flex-1 min-w-0 ${
								isMe ? "text-emerald-300" : "text-stone-100"
							}`}
							title={p.username}
						>
							{p.username}
							{p.isBot && (
								<span className="ml-1 text-stone-400 font-normal text-xs">
									AI
								</span>
							)}
							{isMe && (
								<span className="ml-1 text-emerald-400/70 font-normal text-xs">
									你
								</span>
							)}
						</span>
						<span className="text-amber-300 tabular-nums text-sm shrink-0">
							{p.score}
						</span>
						{!p.connected && !p.isBot && (
							<span className="text-stone-500 text-xs shrink-0">离线</span>
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
