import { useCallback, useEffect, useRef, useState } from "react";
import { Board } from "./components/Board";
import { LobbyWidget } from "./components/LobbyWidget";
import { PoemHeader } from "./components/PoemHeader";
import { SignInCard } from "./components/SignInCard";
import { UserBadge } from "./components/UserBadge";
import { useIdentity } from "./hooks/useIdentity";
import { ApiError, api } from "./lib/api";
import { GamePage } from "./pages/GamePage";
import {
	BOARD_SIZE,
	RoomCodeSchema,
	type Board as BoardType,
	type Cell,
	type Poem,
	type RoomVisibility,
} from "../shared/protocol";

const LAST_ROOM_KEY = "gomoku.lastRoom";

function readStoredRoom(): string | null {
	try {
		const raw = window.localStorage.getItem(LAST_ROOM_KEY);
		if (!raw) return null;
		const parsed = RoomCodeSchema.safeParse(raw);
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

function writeStoredRoom(code: string | null) {
	try {
		if (code) window.localStorage.setItem(LAST_ROOM_KEY, code);
		else window.localStorage.removeItem(LAST_ROOM_KEY);
	} catch {
		// ignore
	}
}

// A 15x15 grid of empty cells used as the board placeholder before
// sign-in (or while the room is being created). The user sees the
// product immediately — board + lobby — without a blocking modal.
const EMPTY_BOARD: BoardType = Array.from({ length: BOARD_SIZE }, () =>
	Array.from({ length: BOARD_SIZE }, (): Cell => null)
);

function App() {
	const { state, claimRandom, claimCustom, renameTo, signOut } = useIdentity();

	const [roomCode, setRoomCode] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [appError, setAppError] = useState<string | null>(null);
	const [headerPoem, setHeaderPoem] = useState<Poem | null>(null);

	const bootstrappingRef = useRef(false);

	const switchRoom = useCallback((code: string) => {
		setRoomCode(code);
		writeStoredRoom(code);
	}, []);

	const createRoom = useCallback(
		async (visibility: RoomVisibility) => {
			if (state.status !== "ready" || busy) return;
			setBusy(true);
			setAppError(null);
			try {
				const res = await api.createRoom({
					username: state.identity.username,
					token: state.identity.token,
					visibility,
				});
				switchRoom(res.roomCode);
			} catch (e) {
				setAppError(e instanceof ApiError ? e.code : "create_failed");
			} finally {
				setBusy(false);
			}
		},
		[state, busy, switchRoom]
	);

	// After identity claim, rehydrate the last room (or auto-create a
	// private one) so the user lands directly on a playable board.
	useEffect(() => {
		if (state.status !== "ready") return;
		if (roomCode !== null) return;
		if (bootstrappingRef.current) return;

		const stored = readStoredRoom();
		if (stored) {
			setRoomCode(stored);
			return;
		}

		bootstrappingRef.current = true;
		(async () => {
			try {
				const res = await api.createRoom({
					username: state.identity.username,
					token: state.identity.token,
					visibility: "private",
				});
				setRoomCode(res.roomCode);
				writeStoredRoom(res.roomCode);
			} catch (e) {
				setAppError(e instanceof ApiError ? e.code : "bootstrap_failed");
			} finally {
				bootstrappingRef.current = false;
			}
		})();
	}, [state, roomCode]);

	const handleSignOut = useCallback(() => {
		writeStoredRoom(null);
		setRoomCode(null);
		signOut();
	}, [signOut]);

	const identity = state.status === "ready" ? state.identity : null;

	const randomSignIn = useCallback(async () => {
		await claimRandom();
	}, [claimRandom]);

	const customSignIn = useCallback(
		async (name: string) => {
			await claimCustom(name);
		},
		[claimCustom]
	);

	const showPoem = useCallback((poem: Poem) => {
		setHeaderPoem(poem);
	}, []);

	const clearPoem = useCallback(() => {
		setHeaderPoem(null);
	}, []);

	return (
		<div className="min-h-screen bg-stone-900 text-stone-100">
			<header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-stone-800">
				<PoemHeader poem={headerPoem} onDone={clearPoem} />
				{state.status === "ready" && (
					<UserBadge
						identity={state.identity}
						onRename={renameTo}
						onSignOut={handleSignOut}
					/>
				)}
			</header>

			<main className="max-w-6xl mx-auto px-3 sm:px-6 py-5">
				{roomCode ? (
					<GamePage
						identity={identity}
						roomCode={roomCode}
						busy={busy}
						onCreateRoom={createRoom}
						onJoinRoom={switchRoom}
						onRandomSignIn={randomSignIn}
						onCustomSignIn={customSignIn}
						onPoem={showPoem}
					/>
				) : (
					<LandingShell
						anonymous={state.status === "anonymous"}
						onRandom={randomSignIn}
						onCustom={customSignIn}
						onJoinRoom={switchRoom}
					/>
				)}
			</main>

			{appError && (
				<div
					role="alert"
					className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded bg-red-950/90 border border-red-800 text-red-100 text-sm"
				>
					{appError === "bootstrap_failed"
						? "进入房间失败,刷新重试"
						: appError === "create_failed"
						? "创建房间失败"
						: appError === "unauthorized"
						? "登录已过期"
						: appError}
				</div>
			)}
		</div>
	);
}

/**
 * The two-column shell rendered before a real game is connected:
 * empty board on the left, SignInCard (or a loading note) + lobby on
 * the right. Matches the layout the logged-in GamePage uses so the
 * transition into a live game doesn't shift the page around.
 */
function LandingShell({
	anonymous,
	onRandom,
	onCustom,
	onJoinRoom,
}: {
	anonymous: boolean;
	onRandom: () => Promise<void>;
	onCustom: (name: string) => Promise<void>;
	onJoinRoom: (code: string) => void;
}) {
	return (
		<div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 lg:gap-6">
			<div className="space-y-3">
				<div className="text-center text-base font-medium text-stone-400">
					{anonymous
						? "点击右侧公开房间观战,或先登记昵称开局"
						: "正在分配房间…"}
				</div>
				<div className="max-w-xl mx-auto">
					<Board
						board={EMPTY_BOARD}
						lastMove={null}
						disabled
						onPlace={() => {}}
					/>
				</div>
				<p className="text-stone-500 text-xs text-center px-2">
					五连成线 → 清除己方连子,每位对手随机被扰乱相同数量,得分时古诗在标题处显现。
				</p>
			</div>

			<aside className="space-y-3">
				{anonymous ? (
					<SignInCard onRandom={onRandom} onCustom={onCustom} />
				) : (
					<section className="bg-stone-800/40 border border-stone-700 rounded-lg p-3">
						<p className="text-stone-400 text-sm">连接房间中…</p>
					</section>
				)}
				{/* Clicking a public room moves the user into spectator
				    mode (anonymous) or seats them (signed-in) — the
				    GamePage branch handles both via useMultiPlayerGame. */}
				<LobbyWidget currentRoom="" onJoinRoom={onJoinRoom} />
			</aside>
		</div>
	);
}

export default App;
