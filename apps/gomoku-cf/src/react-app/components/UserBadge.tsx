import { useState } from "react";
import type { Identity } from "../hooks/useIdentity";
import { ApiError } from "../lib/api";

interface Props {
	identity: Identity;
	onRename: (newName: string) => Promise<Identity>;
	onSignOut: () => void;
}

export function UserBadge({ identity, onRename, onSignOut }: Props) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(identity.username);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		const next = draft.trim();
		if (next === identity.username) {
			setEditing(false);
			return;
		}
		if (next.length < 3 || next.length > 16) {
			setError("3-16 字符");
			return;
		}
		if (!/^[a-zA-Z0-9_]+$/.test(next)) {
			setError("非法字符");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			await onRename(next);
			setEditing(false);
		} catch (e) {
			setError(e instanceof ApiError ? messageFor(e.code) : "失败");
		} finally {
			setBusy(false);
		}
	};

	if (editing) {
		return (
			<form onSubmit={submit} className="flex items-center gap-2">
				<input
					autoFocus
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					maxLength={16}
					className="bg-stone-900 border border-stone-600 rounded px-3 py-1.5 text-sm text-stone-100 w-40"
				/>
				<button
					type="submit"
					disabled={busy}
					className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded"
				>
					{busy ? "..." : "✓"}
				</button>
				<button
					type="button"
					onClick={() => {
						setEditing(false);
						setError(null);
						setDraft(identity.username);
					}}
					className="bg-stone-700 hover:bg-stone-600 text-stone-100 text-sm px-3 py-1.5 rounded"
				>
					×
				</button>
				{error && <span className="text-red-400 text-xs">{error}</span>}
			</form>
		);
	}

	return (
		<div className="flex items-center gap-2 text-sm">
			<span className="text-stone-300">{identity.username}</span>
			<button
				onClick={() => setEditing(true)}
				className="text-stone-500 hover:text-stone-300 transition-colors"
				title="改名"
			>
				改名
			</button>
			<button
				onClick={onSignOut}
				className="text-stone-500 hover:text-red-400 transition-colors"
				title="退出"
			>
				退出
			</button>
		</div>
	);
}

function messageFor(code: string): string {
	if (code === "new_name_taken") return "已被占";
	if (code === "unauthorized") return "未授权";
	return code;
}
