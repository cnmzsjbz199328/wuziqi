import { useEffect, useRef, useState } from "react";
import {
	RoomCodeSchema,
	type RoomVisibility,
} from "../../shared/protocol";

interface Props {
	roomCode: string;
	visibility: RoomVisibility | null;
	connection: "connecting" | "open" | "closed" | "error";
	busy: boolean;
	onCreateRoom: (visibility: RoomVisibility) => void;
	onJoinRoom: (code: string) => void;
	/** Resets the board + every player's per-room score to 0. Omitted
	    for spectators — only seated players can restart (the server
	    rejects it for spectators anyway), so the UI hides the affordance
	    rather than showing a button that errors. */
	onRestart?: () => void;
}

export function RoomWidget({
	roomCode,
	visibility,
	connection,
	busy,
	onCreateRoom,
	onJoinRoom,
	onRestart,
}: Props) {
	const [codeInput, setCodeInput] = useState("");
	const [codeError, setCodeError] = useState<string | null>(null);
	const [confirmRestart, setConfirmRestart] = useState(false);
	const confirmTimerRef = useRef<number | null>(null);

	const requestRestart = () => {
		setConfirmRestart(true);
		if (confirmTimerRef.current !== null) window.clearTimeout(confirmTimerRef.current);
		confirmTimerRef.current = window.setTimeout(() => setConfirmRestart(false), 4000);
	};
	const confirmAndRestart = () => {
		if (confirmTimerRef.current !== null) window.clearTimeout(confirmTimerRef.current);
		setConfirmRestart(false);
		onRestart?.();
	};
	useEffect(() => () => {
		if (confirmTimerRef.current !== null) window.clearTimeout(confirmTimerRef.current);
	}, []);

	const submitJoin = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = codeInput.trim().toUpperCase();
		const parsed = RoomCodeSchema.safeParse(trimmed);
		if (!parsed.success) {
			setCodeError("6 位字母数字");
			return;
		}
		setCodeError(null);
		setCodeInput("");
		onJoinRoom(parsed.data);
	};

	return (
		<section className="bg-stone-800/40 border border-stone-700 rounded-lg p-3 space-y-3">
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<h3 className="text-stone-400 text-xs uppercase tracking-wider">
						当前房间
					</h3>
					<div className="flex items-center gap-2 mt-1 flex-wrap">
						<span className="font-mono tracking-widest text-stone-100 text-lg">
							{roomCode}
						</span>
						{visibility && (
							<span
								className={`text-xs px-1.5 py-0.5 rounded ${
									visibility === "public"
										? "bg-emerald-900/60 text-emerald-300"
										: "bg-indigo-900/60 text-indigo-300"
								}`}
							>
								{visibility === "public" ? "公开" : "私人"}
							</span>
						)}
					</div>
				</div>
				<ConnectionDot status={connection} />
			</div>

			<div className="grid grid-cols-2 gap-2">
				<button
					type="button"
					onClick={() => onCreateRoom("public")}
					disabled={busy}
					className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-stone-50 text-sm px-2 py-2 rounded transition-colors"
				>
					新建公开
				</button>
				<button
					type="button"
					onClick={() => onCreateRoom("private")}
					disabled={busy}
					className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 text-stone-50 text-sm px-2 py-2 rounded transition-colors"
				>
					新建私人
				</button>
			</div>

			<form onSubmit={submitJoin} className="flex gap-2">
				<input
					type="text"
					value={codeInput}
					onChange={(e) => setCodeInput(e.target.value)}
					placeholder="房间码"
					maxLength={6}
					autoCapitalize="characters"
					autoComplete="off"
					className="flex-1 min-w-0 bg-stone-900 border border-stone-700 rounded px-2 py-1.5 text-stone-100 placeholder:text-stone-500 uppercase tracking-widest font-mono text-sm focus:outline-none focus:border-stone-500"
				/>
				<button
					type="submit"
					disabled={busy || codeInput.length === 0}
					className="bg-stone-700 hover:bg-stone-600 disabled:opacity-40 text-stone-100 text-sm px-3 py-1.5 rounded transition-colors"
				>
					加入
				</button>
			</form>
			{codeError && (
				<p className="text-red-400 text-xs">{codeError}</p>
			)}

			{onRestart && (
				confirmRestart ? (
					<div className="flex items-center gap-2">
						<span className="text-amber-400 text-xs flex-1">确定要重开？</span>
						<button
							type="button"
							onClick={confirmAndRestart}
							className="text-xs px-2 py-1 rounded bg-amber-700 hover:bg-amber-600 text-amber-50 transition-colors"
						>
							确定
						</button>
						<button
							type="button"
							onClick={() => setConfirmRestart(false)}
							className="text-xs px-2 py-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-200 transition-colors"
						>
							取消
						</button>
					</div>
				) : (
					<button
						type="button"
						onClick={requestRestart}
						className="w-full text-stone-500 hover:text-stone-300 text-xs py-1 transition-colors"
						title="清空棋盘并把所有人的本房分数归零"
					>
						重开本房间棋局
					</button>
				)
			)}
		</section>
	);
}

function ConnectionDot({ status }: { status: string }) {
	const map: Record<string, { cls: string; label: string }> = {
		connecting: { cls: "bg-stone-500 animate-pulse", label: "连接中" },
		open: { cls: "bg-emerald-500", label: "在线" },
		closed: { cls: "bg-stone-600", label: "已断开" },
		error: { cls: "bg-red-500", label: "出错" },
	};
	const m = map[status] ?? map.closed;
	return (
		<span
			className="flex items-center gap-1.5 text-xs text-stone-400 shrink-0"
			title={m.label}
		>
			<span
				className={`inline-block w-2 h-2 rounded-full ${m.cls}`}
				aria-hidden
			/>
			{m.label}
		</span>
	);
}
