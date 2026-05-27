import { useEffect, useState } from "react";
import { Board } from "../components/Board";
import { EndScreen } from "../components/EndScreen";
import { LobbyWidget } from "../components/LobbyWidget";
import { PlayerList, paletteForPlayers } from "../components/PlayerList";
import { RoomWidget } from "../components/RoomWidget";
import type { Identity } from "../hooks/useIdentity";
import { useMultiPlayerGame } from "../hooks/useMultiPlayerGame";
import type { RoomVisibility } from "../../shared/protocol";

interface Props {
	identity: Identity;
	roomCode: string;
	busy: boolean;
	onCreateRoom: (visibility: RoomVisibility) => void;
	onJoinRoom: (code: string) => void;
}

export function GamePage({
	identity,
	roomCode,
	busy,
	onCreateRoom,
	onJoinRoom,
}: Props) {
	const {
		connection,
		state,
		isMyTurn,
		lastClear,
		lastTimeout,
		lastEnd,
		errorMsg,
		place,
		restart,
	} = useMultiPlayerGame({
		roomCode,
		username: identity.username,
		token: identity.token,
	});

	const turnLabel = !state ? (
		"连接中…"
	) : state.status === "finished" ? (
		"本轮结束"
	) : state.status === "waiting" ? (
		"等待玩家加入…"
	) : isMyTurn ? (
		"轮到你"
	) : state.turn ? (
		`等待 ${state.turn}`
	) : (
		"—"
	);

	return (
		<div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 lg:gap-6">
			{/* Board column */}
			<div className="space-y-3">
				<div
					className={`text-center text-base font-medium ${
						isMyTurn && state?.status === "playing"
							? "text-emerald-400"
							: "text-stone-300"
					}`}
				>
					{turnLabel}
				</div>

				<div className="max-w-xl mx-auto">
					{state ? (
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
					) : (
						<BoardSkeleton />
					)}
				</div>

				<p className="text-stone-500 text-xs text-center px-2">
					五连成线 → 清除己方连子,每位对手随机被扰乱相同数量。先达 5 分者胜。
				</p>
			</div>

			{/* Right sidebar */}
			<aside className="space-y-3 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1">
				<RoomWidget
					roomCode={roomCode}
					visibility={state?.visibility ?? null}
					connection={connection}
					busy={busy}
					onCreateRoom={onCreateRoom}
					onJoinRoom={onJoinRoom}
				/>

				{state && state.players.length > 0 && (
					<section className="bg-stone-800/40 border border-stone-700 rounded-lg p-3">
						<h3 className="text-stone-400 text-xs uppercase tracking-wider mb-2">
							玩家
						</h3>
						<PlayerList
							players={state.players}
							turn={state.turn}
							me={identity.username}
						/>
					</section>
				)}

				<LobbyWidget currentRoom={roomCode} onJoinRoom={onJoinRoom} />
			</aside>

			<ClearBanner event={lastClear} me={identity.username} />
			<TimeoutBanner event={lastTimeout} />
			<ErrorBanner message={errorMsg} />

			{lastEnd && state?.status === "finished" && (
				<EndScreen
					event={lastEnd}
					me={identity.username}
					onRestart={restart}
					onLeave={() => onCreateRoom("private")}
				/>
			)}
		</div>
	);
}

function BoardSkeleton() {
	return (
		<div className="aspect-square bg-stone-800/50 border border-stone-700 rounded-lg animate-pulse flex items-center justify-center text-stone-500 text-sm">
			棋盘准备中…
		</div>
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

function TimeoutBanner({
	event,
}: {
	event: { id: number; username: string } | null;
}) {
	const [dismissedId, setDismissedId] = useState<number | null>(null);
	useEffect(() => {
		if (!event) return;
		const h = window.setTimeout(() => setDismissedId(event.id), 3000);
		return () => window.clearTimeout(h);
	}, [event]);
	if (!event || event.id === dismissedId) return null;
	return (
		<div
			role="status"
			className="fixed top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded bg-amber-900/90 border border-amber-700 text-amber-100 text-sm"
		>
			{event.username} 超时,跳过
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
