import { useState } from "react";
import { ApiError } from "../lib/api";

interface Props {
	onRandom: () => Promise<void>;
	onCustom: (name: string) => Promise<void>;
}

export function WelcomeModal({ onRandom, onCustom }: Props) {
	const [mode, setMode] = useState<"choose" | "custom">("choose");
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const handleRandom = async () => {
		setBusy(true);
		setError(null);
		try {
			await onRandom();
		} catch (e) {
			setError(messageFor(e));
		} finally {
			setBusy(false);
		}
	};

	const handleCustom = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = name.trim();
		if (trimmed.length < 3 || trimmed.length > 16) {
			setError("用户名需要 3 到 16 个字符");
			return;
		}
		if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
			setError("只能含字母、数字、下划线");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			await onCustom(trimmed);
		} catch (e) {
			setError(messageFor(e));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
			<div className="bg-stone-800 border border-stone-700 rounded-xl p-8 max-w-md w-full space-y-6 shadow-2xl">
				<div className="text-center">
					<h1 className="text-3xl font-bold text-stone-100">欢迎来玩五子棋</h1>
					<p className="text-stone-400 text-sm mt-2">取个名字就能开始</p>
				</div>

				{mode === "choose" && (
					<div className="space-y-3">
						<button
							onClick={handleRandom}
							disabled={busy}
							className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-4 rounded-lg text-lg transition-colors"
						>
							🎲 随机昵称开始
						</button>
						<button
							onClick={() => {
								setMode("custom");
								setError(null);
							}}
							disabled={busy}
							className="w-full bg-stone-700 hover:bg-stone-600 disabled:opacity-50 text-stone-100 font-medium py-3 rounded-lg transition-colors"
						>
							✏️ 自定义昵称
						</button>
					</div>
				)}

				{mode === "custom" && (
					<form onSubmit={handleCustom} className="space-y-3">
						<input
							autoFocus
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="3-16 字符，字母 / 数字 / 下划线"
							maxLength={16}
							className="w-full bg-stone-900 border border-stone-600 rounded-lg px-4 py-3 text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none"
						/>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => {
									setMode("choose");
									setError(null);
								}}
								disabled={busy}
								className="flex-1 bg-stone-700 hover:bg-stone-600 disabled:opacity-50 text-stone-100 py-3 rounded-lg transition-colors"
							>
								返回
							</button>
							<button
								type="submit"
								disabled={busy}
								className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
							>
								{busy ? "..." : "开始"}
							</button>
						</div>
					</form>
				)}

				{error && (
					<p className="text-red-400 text-sm text-center bg-red-950/40 rounded-lg py-2 px-3">
						{error}
					</p>
				)}
			</div>
		</div>
	);
}

function messageFor(e: unknown): string {
	if (e instanceof ApiError) {
		if (e.code === "taken") return "这个名字被人占了，试试别的或用随机昵称";
		if (e.code === "invalid_request") return "名字不合法，请检查格式";
		return `请求失败：${e.code}`;
	}
	return e instanceof Error ? e.message : "未知错误";
}
