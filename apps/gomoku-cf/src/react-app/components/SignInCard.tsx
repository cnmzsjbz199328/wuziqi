import { useState } from "react";
import { randomName } from "../lib/randomName";

interface Props {
	/** Remembered name from a previous room, used to prefill the input. */
	defaultName?: string;
	/** Server-side rejection (e.g. the name is taken in this room). */
	error?: string | null;
	onPick: (name: string) => void;
}

/**
 * Sidebar prompt shown to a spectator. Picking a name takes a seat in
 * THIS room only — names are room-scoped, so the same name can be reused
 * in another room. There's no global account or sign-in step.
 */
export function SignInCard({ defaultName = "", error, onPick }: Props) {
	const [name, setName] = useState(defaultName);
	const [localError, setLocalError] = useState<string | null>(null);

	const submit = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = name.trim();
		if (trimmed.length < 1 || trimmed.length > 16) {
			setLocalError("1-16 字符");
			return;
		}
		if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
			setLocalError("只能含字母 / 数字 / 下划线");
			return;
		}
		setLocalError(null);
		onPick(trimmed);
	};

	const pickRandom = () => {
		setLocalError(null);
		onPick(randomName());
	};

	const shown = localError ?? error ?? null;

	return (
		<section className="bg-stone-800/60 border border-emerald-700/60 rounded-lg p-3 space-y-3">
			<div>
				<h3 className="text-emerald-300 font-medium">取个名字加入本盘</h3>
				<p className="text-stone-400 text-xs mt-0.5">
					名字只在这一盘有效,换房可重名。最多 16 字符
				</p>
			</div>
			<form onSubmit={submit} className="space-y-2">
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
						onClick={pickRandom}
						className="flex-1 bg-stone-700 hover:bg-stone-600 text-stone-100 py-2 rounded transition-colors text-sm"
					>
						🎲 随机
					</button>
					<button
						type="submit"
						className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded transition-colors text-sm"
					>
						加入
					</button>
				</div>
			</form>
			{shown && <p className="text-red-400 text-xs">{shown}</p>}
		</section>
	);
}
