import { useEffect, useState } from "react";
import { Board } from "../components/Board";
import { LobbyWidget } from "../components/LobbyWidget";
import { PlayerList, paletteForPlayers } from "../components/PlayerList";
import { RoomWidget } from "../components/RoomWidget";
import { SignInCard } from "../components/SignInCard";
import { useMultiPlayerGame } from "../hooks/useMultiPlayerGame";
import { getPreferredName, useRoomSeat } from "../hooks/useRoomSeat";
import type { Poem, RoomVisibility } from "../../shared/protocol";

interface Props {
	roomCode: string;
	busy: boolean;
	onCreateRoom: (visibility: RoomVisibility) => void;
	onJoinRoom: (code: string) => void;
	/** Surfaces the latest clear-event poem (room-scoped) up to App so
	    it can be typewritten in the page header without blocking play. */
	onPoem: (poem: Poem) => void;
}

export function GamePage({
	roomCode,
	busy,
	onCreateRoom,
	onJoinRoom,
	onPoem,
}: Props) {
	const { seat, take, clear } = useRoomSeat(roomCode);
	const {
		connection,
		state,
		isMyTurn,
		isSpectator,
		lastClear,
		lastTimeout,
		errorMsg,
		seatRejection,
		place,
		restart,
		leaveSeat,
	} = useMultiPlayerGame({ roomCode, seat });

	const [signInHintAt, setSignInHintAt] = useState(0);
	const [signInError, setSignInError] = useState<string | null>(null);

	// Every new lastClear with a poem fires the header swap. The key is
	// lastClear.id so a re-render without a new event doesn't re-trigger.
	useEffect(() => {
		if (lastClear?.poem) onPoem(lastClear.poem);
	}, [lastClear?.id, lastClear?.poem, onPoem]);

	// A rejected seat (name taken in this room, room full…) drops us back
	// to spectator and shows the reason in the sign-in card.
	useEffect(() => {
		if (seatRejection) {
			setSignInError(seatRejection.message);
			clear();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [seatRejection?.id]);

	const me = seat?.username ?? "";

	const handlePlace = (row: number, col: number) => {
		if (isSpectator) {
			setSignInHintAt(Date.now());
			return;
		}
		place(row, col);
	};

	const pickSeat = (name: string) => {
		setSignInError(null);
		take(name);
	};

	const leave = () => {
		leaveSeat();
		clear();
	};

	const turnLabel = !state ? (
		"连接中…"
	) : state.status === "waiting" ? (
		isSpectator ? "等待玩家加入…(观战中)" : "等待玩家加入…"
	) : isSpectator ? (
		state.turn ? `观战中 · 轮到 ${state.turn}` : "观战中"
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
							/* Spectators get the board active enough to consume
							   clicks (so handlePlace can surface the sign-in
							   hint) but logically can't change state. Players
							   are gated by their own turn + status as before. */
							disabled={
								isSpectator
									? state.status !== "playing"
									: !isMyTurn || state.status !== "playing"
							}
							onPlace={handlePlace}
							palette={paletteForPlayers(state.players)}
							clearedBy={lastClear?.by}
							winningPositions={lastClear?.winningPositions}
						/>
					) : (
						<BoardSkeleton />
					)}
				</div>

				<p className="text-stone-500 text-xs text-center px-2">
					五连成线 → 清除己方连子,每位对手随机被扰乱相同数量,得分时古诗在标题处显现。
				</p>
			</div>

			{/* Right sidebar */}
			<aside className="space-y-3 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1">
				{isSpectator && (
					<SignInCard
						defaultName={getPreferredName()}
						error={signInError}
						onPick={pickSeat}
					/>
				)}

				{/* Room controls (create / join / restart) are navigation,
				    not gameplay — spectators get them too so they can spin
				    up their own room or hop to another. Restart stays
				    seated-only via the optional onRestart prop. */}
				<RoomWidget
					roomCode={roomCode}
					visibility={state?.visibility ?? null}
					connection={connection}
					busy={busy}
					onCreateRoom={onCreateRoom}
					onJoinRoom={onJoinRoom}
					onRestart={isSpectator ? undefined : restart}
				/>

				{!isSpectator && (
					<section className="bg-stone-800/40 border border-stone-700 rounded-lg p-3 flex items-center justify-between gap-2 text-sm">
						<span className="text-stone-300 truncate">
							你 · <span className="text-emerald-300 font-medium">{me}</span>
						</span>
						<button
							type="button"
							onClick={leave}
							className="text-stone-500 hover:text-stone-300 text-xs shrink-0 transition-colors"
							title="放弃座位,改用其他名字"
						>
							退出席位
						</button>
					</section>
				)}

				{state && state.players.length > 0 && (
					<section className="bg-stone-800/40 border border-stone-700 rounded-lg p-3">
						<h3 className="text-stone-400 text-xs uppercase tracking-wider mb-2">
							玩家
						</h3>
						<PlayerList
							players={state.players}
							turn={state.turn}
							me={me}
						/>
					</section>
				)}

				<LobbyWidget currentRoom={roomCode} onJoinRoom={onJoinRoom} />
			</aside>

			<TimeoutBanner event={lastTimeout} />
			<ErrorBanner message={errorMsg} />
			<SignInHint key={signInHintAt} visible={signInHintAt > 0} />
		</div>
	);
}

function SignInHint({ visible }: { visible: boolean }) {
	const [dismissed, setDismissed] = useState(false);
	useEffect(() => {
		setDismissed(false);
		if (!visible) return;
		const h = window.setTimeout(() => setDismissed(true), 3500);
		return () => window.clearTimeout(h);
	}, [visible]);
	if (!visible || dismissed) return null;
	return (
		<div
			role="status"
			className="fixed top-20 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-2rem)] px-5 py-3 rounded-lg shadow-lg border bg-emerald-900/90 border-emerald-700 text-emerald-50 text-sm text-center"
		>
			<div className="font-medium">想下子?</div>
			<div className="opacity-90 mt-0.5">请先取个名字加入本盘</div>
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
			className="fixed top-20 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-2rem)] px-4 py-2 rounded bg-amber-900/90 border border-amber-700 text-amber-100 text-sm"
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
			className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-2rem)] px-4 py-2 rounded bg-red-950/90 border border-red-800 text-red-100 text-sm"
		>
			{message}
		</div>
	);
}
