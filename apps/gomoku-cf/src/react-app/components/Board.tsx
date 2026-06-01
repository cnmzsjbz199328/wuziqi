import { useEffect, useRef, useState } from "react";
import { BOARD_SIZE, type Board as BoardType } from "../../shared/protocol";

// SVG units. CELL is the spacing between intersections; PAD is the
// border around the playable grid. The actual rendered size scales
// with the container via the viewBox.
const CELL = 40;
const PAD = 30;
const SIZE = CELL * (BOARD_SIZE - 1) + PAD * 2;
const STONE_R = CELL * 0.42;
const LABEL_SIZE = CELL * 0.46;

// Traditional 5-point star pattern for a 15×15 board (corners + center).
const STAR_POINTS = [
	[3, 3],
	[3, 11],
	[7, 7],
	[11, 3],
	[11, 11],
];

export interface StoneStyle {
	fill: string;
	stroke?: string;
	/** Colour of the first-initial label drawn on the stone. */
	text?: string;
}

// Default 2-color palette used as a fallback. Multi-player derives its
// palette from the server-supplied player→color map.
export const SINGLE_PLAYER_PALETTE: Record<string, StoneStyle> = {
	black: { fill: "#111", stroke: "#000", text: "#f5f5f5" },
	white: { fill: "#fafaf6", stroke: "#9a9a8e", text: "#222" },
};

const FALLBACK_STYLE: StoneStyle = { fill: "#888", stroke: "#444", text: "#fff" };

interface ExitingStone {
	id: number;
	row: number;
	col: number;
	label: string;
	style: StoneStyle;
	kind: "fall" | "shatter";
}

interface Props {
	board: BoardType;
	lastMove: { row: number; col: number } | null;
	disabled: boolean;
	onPlace: (row: number, col: number) => void;
	palette?: Record<string, StoneStyle>;
	/**
	 * Username of the player whose 5-in-a-row triggered the most recent
	 * clear. Used to decide each vanishing stone's exit animation: the
	 * clearer's own stones fall, everyone else's shatter. Undefined when
	 * no clear has happened (e.g., single-player fallback).
	 */
	clearedBy?: string;
	/** Optional list of cells that formed the winning run. When present
	 * the board should highlight them briefly before applying the post-
	 * clear board (the hook buffers the state update).
	 */
	winningPositions?: { row: number; col: number }[];
}

function xy(idx: number): number {
	return PAD + idx * CELL;
}

function labelFor(marker: string): string {
	return marker.charAt(0).toUpperCase();
}

export function Board({
	board,
	lastMove,
	disabled,
	onPlace,
	palette = SINGLE_PLAYER_PALETTE,
	clearedBy,
	winningPositions,
}: Props) {
	const styleFor = (marker: string): StoneStyle =>
		palette[marker] ?? FALLBACK_STYLE;

	// Diff the board against its previous value to detect removed stones,
	// then animate them out. Removals only ever happen on a clear event,
	// so the diff naturally gates the animation (a normal placement adds
	// a cell, never removes one).
	const prevBoardRef = useRef<BoardType>(board);
	const exitIdRef = useRef(0);
	const [exiting, setExiting] = useState<ExitingStone[]>([]);

	useEffect(() => {
		const prev = prevBoardRef.current;
		if (prev !== board) {
			const removed: ExitingStone[] = [];
			for (let r = 0; r < BOARD_SIZE; r++) {
				for (let c = 0; c < BOARD_SIZE; c++) {
					const was = prev[r]?.[c];
					if (was && board[r]?.[c] === null) {
						removed.push({
							id: ++exitIdRef.current,
							row: r,
							col: c,
							label: labelFor(was),
							style: styleFor(was),
							// The clearer's own line stones fall; disrupted
							// opponent stones shatter.
							kind: clearedBy && was === clearedBy ? "fall" : "shatter",
						});
					}
				}
			}
			prevBoardRef.current = board;
			if (removed.length > 0) {
				setExiting((cur) => [...cur, ...removed]);
				const ids = new Set(removed.map((s) => s.id));
				window.setTimeout(() => {
					setExiting((cur) => cur.filter((s) => !ids.has(s.id)));
				}, 2200);
			}
		}
		// styleFor / clearedBy intentionally read fresh each board change.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [board, clearedBy]);

	return (
		<svg
			viewBox={`0 0 ${SIZE} ${SIZE}`}
			className="block w-full h-auto rounded-lg select-none touch-manipulation"
			style={{ overflow: "visible" }}
			role="grid"
			aria-label="五子棋棋盘"
		>
			<rect width={SIZE} height={SIZE} fill="#dcb35c" />

			{Array.from({ length: BOARD_SIZE }).map((_, i) => (
				<g key={i} stroke="#3a2718" strokeWidth={1.2}>
					<line x1={xy(0)} y1={xy(i)} x2={xy(BOARD_SIZE - 1)} y2={xy(i)} />
					<line x1={xy(i)} y1={xy(0)} x2={xy(i)} y2={xy(BOARD_SIZE - 1)} />
				</g>
			))}

			{STAR_POINTS.map(([r, c]) => (
				<circle key={`star-${r}-${c}`} cx={xy(c)} cy={xy(r)} r={3.5} fill="#3a2718" />
			))}

			{/* Live stones */}
			{/* Highlight winning positions (pre-clear) */}
			{winningPositions?.map((pos, i) => {
				if (!board[pos.row]?.[pos.col]) return null;
				return (
					<g key={`win-${pos.row}-${pos.col}-${i}`}>
						<circle
							cx={xy(pos.col)}
							cy={xy(pos.row)}
							r={STONE_R + 6}
							fill="none"
							stroke="#ffd166"
							strokeWidth={3}
							opacity={0.95}
						/>
					</g>
				);
			})}
			{board.flatMap((row, r) =>
				row.map((cell, c) => {
					if (!cell) return null;
					const s = styleFor(cell);
					const isLast =
						lastMove && lastMove.row === r && lastMove.col === c;
					return (
						<g key={`stone-${r}-${c}`}>
							<circle
								cx={xy(c)}
								cy={xy(r)}
								r={STONE_R}
								fill={s.fill}
								stroke={s.stroke ?? "none"}
								strokeWidth={s.stroke ? 0.8 : 0}
							/>
							<text
								x={xy(c)}
								y={xy(r)}
								fontSize={LABEL_SIZE}
								fill={s.text ?? "#fff"}
								textAnchor="middle"
								dominantBaseline="central"
								fontWeight={600}
								style={{ pointerEvents: "none" }}
							>
								{labelFor(cell)}
							</text>
							{isLast && (
								<circle
									cx={xy(c)}
									cy={xy(r)}
									r={STONE_R + 2.5}
									fill="none"
									stroke="#c0392b"
									strokeWidth={2}
								/>
							)}
						</g>
					);
				})
			)}

			{/* Exiting stones (clear/disrupt animations) */}
			{exiting.map((s) => (
				<g
					key={`exit-${s.id}`}
					className={`stone-exit ${
						s.kind === "fall" ? "stone-exit-fall" : "stone-exit-shatter"
					}`}
				>
					<circle
						cx={xy(s.col)}
						cy={xy(s.row)}
						r={STONE_R}
						fill={s.style.fill}
						stroke={s.style.stroke ?? "none"}
						strokeWidth={s.style.stroke ? 0.8 : 0}
					/>
					<text
						x={xy(s.col)}
						y={xy(s.row)}
						fontSize={LABEL_SIZE}
						fill={s.style.text ?? "#fff"}
						textAnchor="middle"
						dominantBaseline="central"
						fontWeight={600}
					>
						{s.label}
					</text>
				</g>
			))}

			{/* Click targets */}
			{board.flatMap((row, r) =>
				row.map((cell, c) => {
					const interactive = !disabled && cell === null;
					return (
						<rect
							key={`hit-${r}-${c}`}
							x={xy(c) - CELL / 2}
							y={xy(r) - CELL / 2}
							width={CELL}
							height={CELL}
							fill="transparent"
							style={{ cursor: interactive ? "pointer" : "default" }}
							onClick={interactive ? () => onPlace(r, c) : undefined}
							aria-label={`${r + 1}行${c + 1}列`}
						/>
					);
				})
			)}
		</svg>
	);
}
