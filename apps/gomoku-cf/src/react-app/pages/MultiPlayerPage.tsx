import { useEffect, useState } from "react";
import { Board } from "../components/Board";
import { PlayerStrip, paletteForPlayers } from "../components/PlayerStrip";
import type { Identity } from "../hooks/useIdentity";
import { useMultiPlayerGame } from "../hooks/useMultiPlayerGame";

interface Props {
	identity: Identity;
	roomCode: string;
	onLeave: () => void;
}

export function MultiPlayerPage({ identity, roomCode, onLeave }: Props) {
	const { connection, state, isMyTurn, lastClear, errorMsg, place, leave } =
		useMultiPlayerGame({
			roomCode,
			username: identity.username,
			token: identity.token,
		});

	const handleLeave = () => {
		leave();
		onLeave();
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-3">
				<button
					type="button"
					onClick={handleLeave}
					className="text-stone-400 hover:text-stone-200 text-sm"
				>
					← 离开
				</button>
				<div className="flex items-center gap-2">
					<span className="text-stone-400 text-xs uppercase tracking-wider">
						房间
					</span>
					<span className="font-mono tracking-widest text-stone-100">
						{roomCode}
					</span>
					{state && (
						<span
							className={`text-xs px-1.5 py-0.5 rounded ${
								state.visibility === "public"
									? "bg-emerald-900/60 text-emerald-300"
									: "bg-indigo-900/60 text-indigo-300"
							}`}
						>
							{state.visibility === "public" ? "公开" : "私人"}
						</span>
					)}
				</div>
				<ConnectionBadge status={connection} />
			</div>

			{state ? (
				<>
					<PlayerStrip
						players={state.players}
						turn={state.turn}
						me={identity.username}
					/>

					<div className="text-center text-sm">
						{state.status === "waiting" ? (
							<span className="text-stone-400">等待玩家加入…</span>
						) : isMyTurn ? (
							<span className="text-emerald-400 font-medium">轮到你下</span>
						) : state.turn ? (
							<span className="text-stone-400">
								等待 <span className="text-stone-200">{state.turn}</span>
							</span>
						) : (
							<span className="text-stone-500">—</span>
						)}
					</div>

					<div className="max-w-md mx-auto">
						<Board
							board={state.board}
							lastMove={
								state.lastMove
									? { row: state.lastMove.row, col: state.lastMove.col }
									: null
							}
							disabled={!isMyTurn || state.status !== "playing"}
							onPlace={place}
							palette={paletteForPlayers(state.players)}
						/>
					</div>

					<p className="text-stone-500 text-xs text-center px-2">
						五连成线 → 清除己方连子,每位对手随机被扰乱相同数量。机器人始终在场。
					</p>
				</>
			) : (
				<p className="text-stone-500 text-sm text-center py-8">
					{connection === "connecting"
						? "连接中…"
						: connection === "error"
						? "连接失败,重试中…"
						: "等待房间状态…"}
				</p>
			)}

			<ClearBanner event={lastClear} me={identity.username} />
			<ErrorBanner message={errorMsg} />
		</div>
	);
}

function ConnectionBadge({ status }: { status: string }) {
	const map: Record<string, { label: string; cls: string }> = {
		connecting: { label: "连接中", cls: "bg-stone-700 text-stone-300" },
		open: { label: "在线", cls: "bg-emerald-800 text-emerald-200" },
		closed: { label: "已断开", cls: "bg-stone-800 text-stone-400" },
		error: { label: "出错", cls: "bg-red-900 text-red-200" },
	};
	const m = map[status] ?? map.closed;
	return (
		<span
			className={`text-xs px-2 py-0.5 rounded ${m.cls}`}
			role="status"
		>
			{m.label}
		</span>
	);
}

function ClearBanner({
	event,
	me,
}: {
	event: { id: number; by: string; clearedSelf: number; pointsAwarded: number } | null;
	me: string;
}) {
	const [dismissedId, setDismissedId] = useState<number | null>(null);
	useEffect(() => {
		if (!event) return;
		const h = window.setTimeout(() => setDismissedId(event.id), 4000);
		return () => window.clearTimeout(h);
	}, [event]);
	if (!event || event.id === dismissedId) return null;
	const mine = event.by === me;
	return (
		<div
			role="status"
			className={`fixed top-20 left-1/2 -translate-x-1/2 z-40 px-5 py-3 rounded-lg shadow-lg border text-sm text-center ${
				mine
					? "bg-emerald-900/90 border-emerald-700 text-emerald-100"
					: "bg-stone-800/95 border-stone-600 text-stone-100"
			}`}
		>
			<div className="font-medium">
				{mine ? "五连!" : `${event.by} 五连`}
			</div>
			<div className="opacity-90">
				清除 {event.clearedSelf} 子
				{mine && event.pointsAwarded > 0 && (
					<> · +{event.pointsAwarded} 分</>
				)}
			</div>
		</div>
	);
}

function ErrorBanner({ message }: { message: string | null }) {
	const [dismissed, setDismissed] = useState<string | null>(null);
	useEffect(() => {
		if (!message) return;
		const h = window.setTimeout(() => setDismissed(message), 3500);
		return () => window.clearTimeout(h);
	}, [message]);
	if (!message || dismissed === message) return null;
	return (
		<div
			role="alert"
			className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded bg-red-950/90 border border-red-800 text-red-100 text-sm"
		>
			{message}
		</div>
	);
}
