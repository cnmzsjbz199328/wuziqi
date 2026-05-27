import { UserBadge } from "./components/UserBadge";
import { WelcomeModal } from "./components/WelcomeModal";
import { useIdentity } from "./hooks/useIdentity";

function App() {
	const { state, claimRandom, claimCustom, renameTo, signOut } = useIdentity();

	return (
		<div className="min-h-screen bg-stone-900 text-stone-100">
			<header className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
				<h1 className="text-xl font-bold">五子棋</h1>
				{state.status === "ready" && (
					<UserBadge
						identity={state.identity}
						onRename={renameTo}
						onSignOut={signOut}
					/>
				)}
			</header>

			<main className="max-w-3xl mx-auto px-6 py-12">
				{state.status === "ready" && (
					<div className="space-y-4">
						<p className="text-stone-400">
							你好，
							<span className="text-stone-100 font-medium">
								{state.identity.username}
							</span>
							。
						</p>
						<p className="text-stone-500 text-sm">
							M3 还没接上 —— 棋盘和单机对战马上就来。
						</p>
					</div>
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
