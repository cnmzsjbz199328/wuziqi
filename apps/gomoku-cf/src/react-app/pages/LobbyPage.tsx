import { useCallback, useEffect, useState } from "react";
import { RoomCodeSchema, type RoomSummary } from "../../shared/protocol";
import type { Identity } from "../hooks/useIdentity";
import { ApiError, api } from "../lib/api";

interface Props {
	identity: Identity;
	onEnterRoom: (code: string) => void;
	onBack: () => void;
}

export function LobbyPage({ identity, onEnterRoom, onBack }: Props) {
	const [rooms, setRooms] = useState<RoomSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [codeInput, setCodeInput] = useState("");

	const refresh = useCallback(async () => {
		setLoading(true);
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
		// Live refresh every 10s while the lobby is visible. KV is
		// eventually-consistent (~60s) so the bound here is set by KV's
		// own propagation, not the timer.
		const id = window.setInterval(() => {
			if (document.visibilityState === "visible") refresh();
		}, 10_000);
		return () => window.clearInterval(id);
	}, [refresh]);

	const create = useCallback(
		async (visibility: "public" | "private") => {
			setBusy(true);
			setError(null);
			try {
				const res = await api.createRoom({
					username: identity.username,
					token: identity.token,
					visibility,
				});
				onEnterRoom(res.roomCode);
			} catch (e) {
				setError(e instanceof ApiError ? e.code : "create_failed");
				setBusy(false);
			}
		},
		[identity.username, identity.token, onEnterRoom]
	);

	const joinByCode = useCallback(() => {
		const trimmed = codeInput.trim().toUpperCase();
		const parsed = RoomCodeSchema.safeParse(trimmed);
		if (!parsed.success) {
			setError("invalid_code");
			return;
		}
		onEnterRoom(parsed.data);
	}, [codeInput, onEnterRoom]);

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between gap-2 flex-wrap">
				<button
					type="button"
					onClick={onBack}
					className="text-stone-400 hover:text-stone-200 text-sm py-1.5"
				>
					← 返回
				</button>
				<h2 className="text-lg font-semibold">大厅</h2>
				<button
					type="button"
					onClick={refresh}
					disabled={loading || busy}
					className="bg-stone-700 hover:bg-stone-600 disabled:opacity-40 text-stone-100 text-sm px-3 py-2 rounded transition-colors"
				>
					刷新
				</button>
			</div>

			<section className="space-y-3">
				<div className="grid grid-cols-2 gap-2 sm:gap-3">
					<button
						type="button"
						onClick={() => create("public")}
						disabled={busy}
						className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-stone-50 text-sm px-4 py-3 rounded transition-colors"
					>
						创建公开房间
					</button>
					<button
						type="button"
						onClick={() => create("private")}
						disabled={busy}
						className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 text-stone-50 text-sm px-4 py-3 rounded transition-colors"
					>
						创建私人房间
					</button>
				</div>
				<div className="flex gap-2">
					<input
						type="text"
						value={codeInput}
						onChange={(e) => setCodeInput(e.target.value)}
						placeholder="房间码"
						maxLength={6}
						autoCapitalize="characters"
						autoComplete="off"
						className="flex-1 bg-stone-800 border border-stone-700 rounded px-3 py-2.5 text-stone-100 placeholder:text-stone-500 uppercase tracking-widest font-mono focus:outline-none focus:border-stone-500"
					/>
					<button
						type="button"
						onClick={joinByCode}
						disabled={busy || codeInput.length === 0}
						className="bg-stone-700 hover:bg-stone-600 disabled:opacity-40 text-stone-100 text-sm px-4 py-2.5 rounded transition-colors"
					>
						加入
					</button>
				</div>
			</section>

			{error && (
				<p className="text-red-400 text-sm text-center">{labelFor(error)}</p>
			)}

			<section>
				<h3 className="text-stone-400 text-sm uppercase tracking-wider mb-2">
					公开房间
				</h3>
				{loading ? (
					<p className="text-stone-500 text-sm">加载中…</p>
				) : rooms.length === 0 ? (
					<p className="text-stone-500 text-sm">
						目前没有公开房间。创建一个,等朋友加入吧。
					</p>
				) : (
					<ul className="space-y-2">
						{rooms.map((r) => (
							<li key={r.code}>
								<button
									type="button"
									onClick={() => onEnterRoom(r.code)}
									className="w-full bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded px-4 py-3 flex items-center justify-between text-left transition-colors"
								>
									<div>
										<div className="font-mono text-lg tracking-widest text-stone-100">
											{r.code}
										</div>
										<div className="text-stone-400 text-xs mt-0.5 truncate">
											{r.players.join(" · ")}
										</div>
									</div>
									<div className="flex flex-col items-end gap-0.5">
										<span className="text-stone-300 text-sm tabular-nums">
											{r.playerCount} 人
										</span>
										<span
											className={`text-xs ${
												r.status === "playing"
													? "text-amber-400"
													: "text-emerald-400"
											}`}
										>
											{statusLabel(r.status)}
										</span>
									</div>
								</button>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}

function labelFor(code: string): string {
	switch (code) {
		case "invalid_code":
			return "房间码格式不对(6 位字母数字)";
		case "unauthorized":
			return "登录已过期,请重新登录";
		case "load_failed":
			return "房间列表加载失败,请重试";
		case "create_failed":
			return "创建失败,请重试";
		case "code_collision":
			return "服务器忙,请重试";
		default:
			return code;
	}
}

function statusLabel(status: string): string {
	switch (status) {
		case "waiting":
			return "等待中";
		case "playing":
			return "进行中";
		case "finished":
			return "已结束";
		default:
			return status;
	}
}
