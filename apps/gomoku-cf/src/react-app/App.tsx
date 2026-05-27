import { useCallback, useEffect, useRef, useState } from "react";
import { UserBadge } from "./components/UserBadge";
import { WelcomeModal } from "./components/WelcomeModal";
import { useIdentity } from "./hooks/useIdentity";
import { ApiError, api } from "./lib/api";
import { GamePage } from "./pages/GamePage";
import {
	RoomCodeSchema,
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

function App() {
	const { state, claimRandom, claimCustom, renameTo, signOut } = useIdentity();

	const [roomCode, setRoomCode] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [appError, setAppError] = useState<string | null>(null);

	// Survives StrictMode's double-effect in dev so we don't fire two
	// createRoom requests on first mount.
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

	// First-time landing: rehydrate the last room from localStorage, or
	// auto-create a private room so the user lands directly on a board
	// without any "pick a mode" intermediate page.
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

	// Sign-out clears the room memory so the next user lands fresh.
	const handleSignOut = useCallback(() => {
		writeStoredRoom(null);
		setRoomCode(null);
		signOut();
	}, [signOut]);

	return (
		<div className="min-h-screen bg-stone-900 text-stone-100">
			<header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-stone-800">
				<h1 className="text-xl font-bold">五子棋</h1>
				{state.status === "ready" && (
					<UserBadge
						identity={state.identity}
						onRename={renameTo}
						onSignOut={handleSignOut}
					/>
				)}
			</header>

			<main className="max-w-6xl mx-auto px-3 sm:px-6 py-5">
				{state.status === "ready" && roomCode ? (
					<GamePage
						identity={state.identity}
						roomCode={roomCode}
						busy={busy}
						onCreateRoom={createRoom}
						onJoinRoom={switchRoom}
					/>
				) : state.status === "ready" ? (
					<p className="text-stone-500 text-sm text-center py-8">
						进入房间中…
					</p>
				) : null}
			</main>

			{state.status === "anonymous" && (
				<WelcomeModal
					onRandom={async () => {
						await claimRandom();
					}}
					onCustom={async (name) => {
						await claimCustom(name);
					}}
				/>
			)}

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

export default App;
