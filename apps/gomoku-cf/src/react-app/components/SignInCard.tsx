import { useState } from "react";
import { ApiError } from "../lib/api";

interface Props {
	onRandom: () => Promise<void>;
	onCustom: (name: string) => Promise<void>;
}

/**
 * Inline sidebar version of the old WelcomeModal. Lives at the top of
 * the right-hand sidebar, leaving the board visible underneath so a
 * brand-new visitor still sees the product (board + lobby) before
 * committing to a name — same shape as the legacy frontend's
 * "Register Player" rail card.
 */
export function SignInCard({ onRandom, onCustom }: Props) {
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
			setBusy(false);
		}
	};

	const handleCustom = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = name.trim();
		if (trimmed.length < 1 || trimmed.length > 16) {
			setError("1-16 字符");
			return;
		}
		if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
			setError("只能含字母 / 数字 / 下划线");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			await onCustom(trimmed);
		} catch (e) {
			setError(messageFor(e));
			setBusy(false);
		}
	};

	return (
		<section className="bg-stone-800/60 border border-emerald-700/60 rounded-lg p-3 space-y-3">
			<div>
				<h3 className="text-emerald-300 font-medium">取个名字开始</h3>
				<p className="text-stone-400 text-xs mt-0.5">
					最多 16 字符,字母/数字/下划线
				</p>
			</div>

			{mode === "choose" ? (
				<div className="space-y-2">
					<button
						type="button"
						onClick={handleRandom}
						disabled={busy}
						className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2.5 rounded transition-colors text-sm"
					>
						🎲 随机昵称
					</button>
					<button
						type="button"
						onClick={() => {
							setMode("custom");
							setError(null);
						}}
						disabled={busy}
						className="w-full bg-stone-700 hover:bg-stone-600 disabled:opacity-50 text-stone-100 py-2 rounded transition-colors text-sm"
					>
						✏️ 自定义
					</button>
				</div>
			) : (
				<form onSubmit={handleCustom} className="space-y-2">
					<input
						autoFocus
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="昵称"
						maxLength={16}
						autoComplete="off"
						className="w-full bg-stone-900 border border-stone-600 rounded px-3 py-2 text-stone-100 placeholder-stone-500 text-sm focus:border-emerald-500 focus:outline-none"
					/>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => {
								setMode("choose");
								setError(null);
							}}
							disabled={busy}
							className="flex-1 bg-stone-700 hover:bg-stone-600 disabled:opacity-50 text-stone-100 py-2 rounded transition-colors text-sm"
						>
							返回
						</button>
						<button
							type="submit"
							disabled={busy}
							className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2 rounded transition-colors text-sm"
						>
							{busy ? "..." : "开始"}
						</button>
					</div>
				</form>
			)}

			{error && (
				<p className="text-red-400 text-xs">{error}</p>
			)}
		</section>
	);
}

function messageFor(e: unknown): string {
	if (e instanceof ApiError) {
		if (e.code === "taken") return "名字被占了,换一个或用随机";
		if (e.code === "invalid_request") return "名字不合法";
		return `请求失败: ${e.code}`;
	}
	return e instanceof Error ? e.message : "未知错误";
}
