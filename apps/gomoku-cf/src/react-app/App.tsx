import { UserBadge } from "./components/UserBadge";
import { WelcomeModal } from "./components/WelcomeModal";
import { useIdentity } from "./hooks/useIdentity";
import { SinglePlayerPage } from "./pages/SinglePlayerPage";

function App() {
	const { state, claimRandom, claimCustom, renameTo, setScore, signOut } =
		useIdentity();

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
				{state.status === "ready" && (
					<SinglePlayerPage
						identity={state.identity}
						score={state.identity.score}
						onScored={setScore}
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

export default App;
