import { BOARD_SIZE, type Board as BoardType } from "../../shared/protocol";

// SVG units. CELL is the spacing between intersections; PAD is the
// border around the playable grid. The actual rendered size scales
// with the container via the viewBox.
const CELL = 40;
const PAD = 30;
const SIZE = CELL * (BOARD_SIZE - 1) + PAD * 2;
const STONE_R = CELL * 0.42;

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
}

// Default 2-color palette used by the single-player page. Multi-player
// derives its palette from the server-supplied player→color map.
export const SINGLE_PLAYER_PALETTE: Record<string, StoneStyle> = {
	black: { fill: "#111", stroke: "#000" },
	white: { fill: "#fafaf6", stroke: "#9a9a8e" },
};

const FALLBACK_STYLE: StoneStyle = { fill: "#888", stroke: "#444" };

interface Props {
	board: BoardType;
	lastMove: { row: number; col: number } | null;
	disabled: boolean;
	onPlace: (row: number, col: number) => void;
	palette?: Record<string, StoneStyle>;
}

function xy(idx: number): number {
	return PAD + idx * CELL;
}

export function Board({
	board,
	lastMove,
	disabled,
	onPlace,
	palette = SINGLE_PLAYER_PALETTE,
}: Props) {
	const styleFor = (marker: string): StoneStyle =>
		palette[marker] ?? FALLBACK_STYLE;

	return (
		<svg
			viewBox={`0 0 ${SIZE} ${SIZE}`}
			className="block w-full h-auto rounded-lg select-none touch-manipulation"
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

			{board.flatMap((row, r) =>
				row.map((cell, c) => {
					if (!cell) return null;
					const s = styleFor(cell);
					return (
						<circle
							key={`stone-${r}-${c}`}
							cx={xy(c)}
							cy={xy(r)}
							r={STONE_R}
							fill={s.fill}
							stroke={s.stroke ?? "none"}
							strokeWidth={s.stroke ? 0.8 : 0}
						/>
					);
				})
			)}

			{lastMove && board[lastMove.row][lastMove.col] && (
				<circle
					cx={xy(lastMove.col)}
					cy={xy(lastMove.row)}
					r={4}
					fill="#c0392b"
				/>
			)}

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
