import { useCallback, useEffect, useRef, useState } from "react";
import { Board } from "./components/Board";
import { LobbyWidget } from "./components/LobbyWidget";
import { PoemHeader } from "./components/PoemHeader";
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

// A 15x15 grid of empty cells used as the board placeholder while the
// first room is being created, so the user sees the product immediately.
const EMPTY_BOARD: BoardType = Array.from({ length: BOARD_SIZE }, () =>
	Array.from({ length: BOARD_SIZE }, (): Cell => null)
);

function App() {
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
			if (busy) return;
			setBusy(true);
			setAppError(null);
			try {
				const res = await api.createRoom({ visibility });
				switchRoom(res.roomCode);
			} catch (e) {
				setAppError(e instanceof ApiError ? e.code : "create_failed");
			} finally {
				setBusy(false);
			}
		},
		[busy, switchRoom]
	);

	// Land everyone directly on a playable board: rehydrate the last room
	// or auto-create a private one. There is no sign-in gate — naming
	// happens in-room, when the visitor decides to take a seat.
	useEffect(() => {
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
				const res = await api.createRoom({ visibility: "private" });
				setRoomCode(res.roomCode);
				writeStoredRoom(res.roomCode);
			} catch (e) {
				setAppError(e instanceof ApiError ? e.code : "bootstrap_failed");
			} finally {
				bootstrappingRef.current = false;
			}
		})();
	}, [roomCode]);

	const showPoem = useCallback((poem: Poem) => setHeaderPoem(poem), []);
	const clearPoem = useCallback(() => setHeaderPoem(null), []);

	return (
		<div className="min-h-screen bg-stone-900 text-stone-100">
			<header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-stone-800">
				<PoemHeader poem={headerPoem} onDone={clearPoem} />
			</header>

			<main className="max-w-6xl mx-auto px-3 sm:px-6 py-5">
				{roomCode ? (
					<GamePage
						roomCode={roomCode}
						busy={busy}
						onCreateRoom={createRoom}
						onJoinRoom={switchRoom}
						onPoem={showPoem}
					/>
				) : (
					<LandingShell onJoinRoom={switchRoom} />
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
						: appError}
				</div>
			)}
		</div>
	);
}

/**
 * Shown only briefly while the first room is being created: empty board
 * on the left, lobby on the right (so the visitor can jump into a public
 * room instead of waiting). Matches the GamePage layout so the handoff
 * into a live game doesn't shift the page around.
 */
function LandingShell({ onJoinRoom }: { onJoinRoom: (code: string) => void }) {
	return (
		<div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 lg:gap-6">
			<div className="space-y-3">
				<div className="text-center text-base font-medium text-stone-400">
					正在分配房间…
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
				<section className="bg-stone-800/40 border border-stone-700 rounded-lg p-3">
					<p className="text-stone-400 text-sm">连接房间中…</p>
				</section>
				<LobbyWidget currentRoom="" onJoinRoom={onJoinRoom} />
			</aside>
		</div>
	);
}

export default App;
