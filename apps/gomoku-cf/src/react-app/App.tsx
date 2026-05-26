import { useEffect, useState } from "react";

type PingResponse = { ok: boolean; now: string };
type BindingsResponse = { kv: boolean; gameRoom: boolean; assets: boolean };

function App() {
	const [ping, setPing] = useState<PingResponse | null>(null);
	const [bindings, setBindings] = useState<BindingsResponse | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const run = async () => {
			try {
				const [p, b] = await Promise.all([
					fetch("/api/ping").then((r) => r.json() as Promise<PingResponse>),
					fetch("/api/_bindings").then(
						(r) => r.json() as Promise<BindingsResponse>
					),
				]);
				setPing(p);
				setBindings(b);
			} catch (e) {
				setError(e instanceof Error ? e.message : String(e));
			}
		};
		run();
	}, []);

	return (
		<main className="min-h-screen flex items-center justify-center bg-stone-900 text-stone-100 p-8">
			<div className="max-w-xl w-full space-y-6">
				<header className="text-center">
					<h1 className="text-4xl font-bold mb-2">五子棋</h1>
					<p className="text-stone-400">M0 scaffold — Cloudflare Workers</p>
				</header>

				<section className="bg-stone-800 rounded-lg p-6 space-y-3 border border-stone-700">
					<h2 className="text-lg font-semibold">Health check</h2>
					{error && <p className="text-red-400">Error: {error}</p>}
					<div className="font-mono text-sm space-y-1">
						<div>
							<span className="text-stone-400">/api/ping →</span>{" "}
							{ping ? (
								<span className="text-emerald-400">
									ok · {ping.now}
								</span>
							) : (
								<span className="text-stone-500">loading…</span>
							)}
						</div>
						<div>
							<span className="text-stone-400">bindings →</span>{" "}
							{bindings ? (
								<span>
									KV={renderFlag(bindings.kv)} · GAME_ROOM=
									{renderFlag(bindings.gameRoom)} · ASSETS=
									{renderFlag(bindings.assets)}
								</span>
							) : (
								<span className="text-stone-500">loading…</span>
							)}
						</div>
					</div>
				</section>

				<p className="text-stone-500 text-sm text-center">
					Next: M1 — port the game engine from the Java reference.
				</p>
			</div>
		</main>
	);
}

function renderFlag(ok: boolean) {
	return (
		<span className={ok ? "text-emerald-400" : "text-red-400"}>
			{ok ? "✓" : "✗"}
		</span>
	);
}

export default App;
