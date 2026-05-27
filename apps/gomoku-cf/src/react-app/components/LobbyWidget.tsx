import { useCallback, useEffect, useState } from "react";
import type { RoomSummary } from "../../shared/protocol";
import { ApiError, api } from "../lib/api";

interface Props {
	currentRoom: string;
	onJoinRoom: (code: string) => void;
}

export function LobbyWidget({ currentRoom, onJoinRoom }: Props) {
	const [rooms, setRooms] = useState<RoomSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		setError(null);
		try {
			const res = await api.listRooms();
			setRooms(res.rooms);
		} catch (e) {
			setError(e instanceof ApiError ? e.code : "load_failed");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		refresh();
		// Live refresh every 10s while the tab is visible. KV has a ~60s
		// consistency window, so polling faster wouldn't help.
		const id = window.setInterval(() => {
			if (document.visibilityState === "visible") refresh();
		}, 10_000);
		return () => window.clearInterval(id);
	}, [refresh]);

	const others = rooms.filter((r) => r.code !== currentRoom);

	return (
		<section className="bg-stone-800/40 border border-stone-700 rounded-lg p-3 space-y-2">
			<div className="flex items-center justify-between">
				<h3 className="text-stone-400 text-xs uppercase tracking-wider">
					公开房间
				</h3>
				<button
					type="button"
					onClick={refresh}
					disabled={loading}
					className="text-stone-500 hover:text-stone-300 text-xs disabled:opacity-50"
					title="刷新"
				>
					↻
				</button>
			</div>
			{error ? (
				<p className="text-red-400 text-xs">列表加载失败</p>
			) : loading ? (
				<p className="text-stone-500 text-xs">加载中…</p>
			) : others.length === 0 ? (
				<p className="text-stone-500 text-xs">
					{rooms.length === 0
						? "暂无公开房间"
						: "只有你创建的公开房间"}
				</p>
			) : (
				<ul className="space-y-1">
					{others.map((r) => (
						<li key={r.code}>
							<button
								type="button"
								onClick={() => onJoinRoom(r.code)}
								className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-stone-900/60 hover:bg-stone-700/60 border border-stone-700 text-left transition-colors"
							>
								<div className="min-w-0 flex-1">
									<div className="font-mono tracking-widest text-stone-100 text-sm">
										{r.code}
									</div>
									<div className="text-stone-500 text-xs truncate">
										{r.players.join(" · ")}
									</div>
								</div>
								<span className="text-stone-400 text-xs tabular-nums shrink-0">
									{r.playerCount}人
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
