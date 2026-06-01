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

interface WinningSegment {
	from: { row: number; col: number };
	to: { row: number; col: number };
}

function xy(idx: number): number {
	return PAD + idx * CELL;
}

function labelFor(marker: string): string {
	return marker.charAt(0).toUpperCase();
}

function inkDotOffsets(row: number, col: number) {
	const seed = (row * 37 + col * 19) % 11;
	return [
		{ dx: -7 + (seed % 3), dy: -5, r: 2.2 },
		{ dx: 8, dy: -3 + (seed % 4), r: 1.7 },
		{ dx: -3, dy: 8 - (seed % 3), r: 1.5 },
	];
}

function winningSegments(
	positions: { row: number; col: number }[] | undefined
): WinningSegment[] {
	if (!positions || positions.length < 2) return [];
	const set = new Set(positions.map((p) => `${p.row},${p.col}`));
	const dirs = [
		[0, 1],
		[1, 0],
		[1, 1],
		[1, -1],
	] as const;
	const segments: WinningSegment[] = [];

	for (const pos of positions) {
		for (const [dr, dc] of dirs) {
			if (set.has(`${pos.row - dr},${pos.col - dc}`)) continue;
			let len = 0;
			while (set.has(`${pos.row + len * dr},${pos.col + len * dc}`)) len++;
			if (len < 5) continue;
			segments.push({
				from: pos,
				to: {
					row: pos.row + (len - 1) * dr,
					col: pos.col + (len - 1) * dc,
				},
			});
		}
	}

	return segments;
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

	// Track active winning positions to manage their lifecycle self-contained.
	// This lets them show during the clear-buffer delay and then fade out beautifully
	// without leaving permanent ink wash/lines on the board.
	const [activeWinningPositions, setActiveWinningPositions] = useState<{ row: number; col: number }[] | undefined>(undefined);

	useEffect(() => {
		if (winningPositions && winningPositions.length > 0) {
			setActiveWinningPositions(winningPositions);
			const timer = window.setTimeout(() => {
				setActiveWinningPositions(undefined);
			}, 3500); // Matches the 3.5s animation duration
			return () => window.clearTimeout(timer);
		} else {
			setActiveWinningPositions(undefined);
		}
	}, [winningPositions]);

	const winSegments = winningSegments(activeWinningPositions);

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
			<defs>
				<filter id="paper-grain" x="-6%" y="-6%" width="112%" height="112%">
					<feTurbulence
						type="fractalNoise"
						baseFrequency="0.018 0.09"
						numOctaves={4}
						seed={12}
						result="grain"
					/>
					<feColorMatrix
						in="grain"
						type="matrix"
						values="0 0 0 0 0.83 0 0 0 0 0.74 0 0 0 0 0.55 0 0 0 0.18 0"
					/>
				</filter>
				<filter id="ink-waver" x="-8%" y="-8%" width="116%" height="116%">
					<feTurbulence
						type="fractalNoise"
						baseFrequency="0.045"
						numOctaves={2}
						seed={8}
						result="rough"
					/>
					<feDisplacementMap in="SourceGraphic" in2="rough" scale={1.8} />
				</filter>
				<filter id="ink-soften" x="-40%" y="-40%" width="180%" height="180%">
					<feGaussianBlur in="SourceAlpha" stdDeviation={1.2} result="blur" />
					<feOffset in="blur" dx={0.4} dy={0.8} result="shadow" />
					<feMerge>
						<feMergeNode in="shadow" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
				<radialGradient id="paper-wash" cx="42%" cy="35%" r="78%">
					<stop offset="0%" stopColor="#f2dfad" />
					<stop offset="62%" stopColor="#d7aa5b" />
					<stop offset="100%" stopColor="#b8833c" />
				</radialGradient>
				<radialGradient id="last-move-wash" cx="50%" cy="50%" r="50%">
					<stop offset="0%" stopColor="#1f2937" stopOpacity="0.28" />
					<stop offset="70%" stopColor="#1f2937" stopOpacity="0.08" />
					<stop offset="100%" stopColor="#1f2937" stopOpacity="0" />
				</radialGradient>
			</defs>

			<rect width={SIZE} height={SIZE} fill="url(#paper-wash)" />
			<rect width={SIZE} height={SIZE} filter="url(#paper-grain)" opacity={0.8} />
			<path
				d={`M ${PAD * 0.55} ${PAD * 0.55} C ${SIZE * 0.2} ${PAD * 0.25}, ${SIZE * 0.8} ${PAD * 0.8}, ${SIZE - PAD * 0.55} ${PAD * 0.5}
					L ${SIZE - PAD * 0.45} ${SIZE - PAD * 0.65}
					C ${SIZE * 0.72} ${SIZE - PAD * 0.25}, ${SIZE * 0.18} ${SIZE - PAD * 0.75}, ${PAD * 0.55} ${SIZE - PAD * 0.5}
					Z`}
				fill="none"
				stroke="#2f2419"
				strokeWidth={2.2}
				opacity={0.24}
				filter="url(#ink-waver)"
			/>

			{Array.from({ length: BOARD_SIZE }).map((_, i) => (
				<g
					key={i}
					className="ink-grid-line"
					stroke="#2b1c12"
					strokeWidth={1.35}
					filter="url(#ink-waver)"
				>
					<line
						x1={xy(0)}
						y1={xy(i) + (i % 2 ? 0.25 : -0.15)}
						x2={xy(BOARD_SIZE - 1)}
						y2={xy(i) + (i % 3 ? -0.1 : 0.2)}
					/>
					<line
						x1={xy(i) + (i % 2 ? -0.15 : 0.2)}
						y1={xy(0)}
						x2={xy(i) + (i % 3 ? 0.15 : -0.2)}
						y2={xy(BOARD_SIZE - 1)}
					/>
				</g>
			))}

			{STAR_POINTS.map(([r, c]) => (
				<circle
					key={`star-${r}-${c}`}
					cx={xy(c)}
					cy={xy(r)}
					r={4.2}
					fill="#23170f"
					opacity={0.76}
					filter="url(#ink-soften)"
				/>
			))}

			{winSegments.map((seg, i) => (
				<g key={`win-line-${i}`} className="winning-ink-line">
					<line
						className="winning-ink-aura"
						x1={xy(seg.from.col)}
						y1={xy(seg.from.row)}
						x2={xy(seg.to.col)}
						y2={xy(seg.to.row)}
					/>
					<line
						className="winning-ink-stroke"
						x1={xy(seg.from.col)}
						y1={xy(seg.from.row)}
						x2={xy(seg.to.col)}
						y2={xy(seg.to.row)}
						filter="url(#ink-waver)"
					/>
				</g>
			))}

			{activeWinningPositions?.map((pos, i) => (
				<g key={`win-${pos.row}-${pos.col}-${i}`} className="winning-ink-ring">
					<circle
						cx={xy(pos.col)}
						cy={xy(pos.row)}
						r={STONE_R + 7}
						fill="none"
						stroke="#1f1710"
						strokeWidth={2.8}
						opacity={0.5}
						filter="url(#ink-waver)"
					/>
				</g>
			))}

			{/* Live stones */}
			{board.flatMap((row, r) =>
				row.map((cell, c) => {
					if (!cell) return null;
					const s = styleFor(cell);
					const isLast =
						lastMove && lastMove.row === r && lastMove.col === c;
					return (
						<g
							key={`stone-${r}-${c}`}
							className={isLast ? "ink-stone ink-stone-new" : "ink-stone"}
							filter="url(#ink-soften)"
						>
							{isLast && (
								<circle
									className="stone-ink-bloom"
									cx={xy(c)}
									cy={xy(r)}
									r={STONE_R + 12}
									fill="url(#last-move-wash)"
								/>
							)}
							{inkDotOffsets(r, c).map((dot, i) => (
								<circle
									key={`dot-${i}`}
									cx={xy(c) + dot.dx}
									cy={xy(r) + dot.dy}
									r={dot.r}
									fill={s.fill}
									opacity={0.26}
								/>
							))}
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
									className="last-move-ink"
									cx={xy(c)}
									cy={xy(r)}
									r={STONE_R + 5}
									fill="none"
									stroke="#20160f"
									strokeWidth={2.2}
									filter="url(#ink-waver)"
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
					className={`stone-exit ink-stone ${
						s.kind === "fall" ? "stone-exit-fall" : "stone-exit-shatter"
					}`}
					filter="url(#ink-soften)"
				>
					{inkDotOffsets(s.row, s.col).map((dot, i) => (
						<circle
							key={`exit-dot-${i}`}
							cx={xy(s.col) + dot.dx}
							cy={xy(s.row) + dot.dy}
							r={dot.r}
							fill={s.style.fill}
							opacity={0.26}
						/>
					))}
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
