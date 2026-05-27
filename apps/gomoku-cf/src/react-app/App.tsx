import { useState } from "react";
import { UserBadge } from "./components/UserBadge";
import { WelcomeModal } from "./components/WelcomeModal";
import { useIdentity } from "./hooks/useIdentity";
import { LobbyPage } from "./pages/LobbyPage";
import { MultiPlayerPage } from "./pages/MultiPlayerPage";
import { SinglePlayerPage } from "./pages/SinglePlayerPage";

type View =
	| { kind: "home" }
	| { kind: "single" }
	| { kind: "lobby" }
	| { kind: "multi"; code: string };

function App() {
	const { state, claimRandom, claimCustom, renameTo, setScore, signOut } =
		useIdentity();
	const [view, setView] = useState<View>({ kind: "home" });

	return (
		<div className="min-h-screen bg-stone-900 text-stone-100">
			<header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-stone-800">
				<h1 className="text-xl font-bold">五子棋</h1>
				{state.status === "ready" && (
					<UserBadge
						identity={state.identity}
						onRename={renameTo}
						onSignOut={signOut}
					/>
				)}
			</header>

			<main className="max-w-3xl mx-auto px-3 sm:px-6 py-6">
				{state.status === "ready" && view.kind === "home" && (
					<HomePage
						onChooseSingle={() => setView({ kind: "single" })}
						onChooseLobby={() => setView({ kind: "lobby" })}
					/>
				)}

				{state.status === "ready" && view.kind === "single" && (
					<SinglePlayerPage
						identity={state.identity}
						score={state.identity.score}
						onScored={setScore}
						onBack={() => setView({ kind: "home" })}
					/>
				)}

				{state.status === "ready" && view.kind === "lobby" && (
					<LobbyPage
						identity={state.identity}
						onEnterRoom={(code) => setView({ kind: "multi", code })}
						onBack={() => setView({ kind: "home" })}
					/>
				)}

				{state.status === "ready" && view.kind === "multi" && (
					<MultiPlayerPage
						identity={state.identity}
						roomCode={view.code}
						onLeave={() => setView({ kind: "lobby" })}
					/>
				)}
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
		</div>
	);
}

function HomePage({
	onChooseSingle,
	onChooseLobby,
}: {
	onChooseSingle: () => void;
	onChooseLobby: () => void;
}) {
	return (
		<div className="space-y-4 max-w-md mx-auto pt-6">
			<button
				type="button"
				onClick={onChooseSingle}
				className="w-full bg-stone-700 hover:bg-stone-600 text-stone-100 px-5 py-6 rounded-lg transition-colors text-lg"
			>
				单机 vs AI
			</button>
			<button
				type="button"
				onClick={onChooseLobby}
				className="w-full bg-emerald-700 hover:bg-emerald-600 text-stone-50 px-5 py-6 rounded-lg transition-colors text-lg"
			>
				进入大厅(多人)
			</button>
			<p className="text-stone-500 text-xs text-center pt-2 px-2">
				多人房间始终配有一个 AI 机器人,所以一个人也可以开局。
			</p>
		</div>
	);
}

export default App;
