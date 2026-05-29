import { useCallback, useEffect, useRef, useState } from "react";
import {
	ServerMessageSchema,
	type Board,
	type GameStatus,
	type Poem,
	type RoomPlayer,
	type RoomVisibility,
	type ServerMessage,
} from "../../shared/protocol";
import type { Seat } from "./useRoomSeat";

export type ConnectionStatus =
	| "connecting"
	| "open"
	| "closed"
	| "error";

export interface ClearEvent {
	id: number;
	by: string;
	clearedSelf: number;
	removedFromOpponents: Record<string, number>;
	pointsAwarded: number;
	/** Server attaches a random Tang quatrain whenever pointsAwarded > 0. */
	poem: Poem | null;
}

export interface RoomState {
	board: Board;
	players: RoomPlayer[];
	turn: string | null;
	status: GameStatus;
	visibility: RoomVisibility;
	lastMove: { row: number; col: number; by: string } | null;
}

export interface TimeoutEvent {
	id: number;
	username: string;
}

/** A failed seat attempt (e.g. the chosen name is taken in this room). */
export interface SeatRejection {
	id: number;
	code: string;
	message: string;
}

interface Options {
	roomCode: string;
	/**
	 * The room-scoped seat, or null for spectator mode. Every socket opens
	 * as a spectator; when a seat is present the hook sends an in-band
	 * `join` to claim/reclaim it. place/restart are gated on having a seat.
	 */
	seat: Seat | null;
}

const RECONNECT_MS = 2000;
// Error codes that mean "your seat attempt was refused" rather than a
// transient gameplay error — surfaced separately so the UI can re-prompt.
const SEAT_REJECT_CODES = new Set([
	"name_taken",
	"room_full",
	"username_reserved",
]);

export function useMultiPlayerGame({ roomCode, seat }: Options) {
	const [connection, setConnection] = useState<ConnectionStatus>("connecting");
	const [state, setState] = useState<RoomState | null>(null);
	const [lastClear, setLastClear] = useState<ClearEvent | null>(null);
	const [lastTimeout, setLastTimeout] = useState<TimeoutEvent | null>(null);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [seatRejection, setSeatRejection] = useState<SeatRejection | null>(null);

	const wsRef = useRef<WebSocket | null>(null);
	const reconnectTimerRef = useRef<number | null>(null);
	const eventIdRef = useRef(0);
	// Keep the latest lastMove sticky across server `state` messages — the
	// state payload doesn't include it, but the preceding `move` message
	// did. Stored in a ref so a new state push doesn't blow it away.
	const lastMoveRef = useRef<RoomState["lastMove"]>(null);
	const cancelledRef = useRef(false);
	// Latest seat, read inside ws.onopen (a closure created at connect time).
	const seatRef = useRef<Seat | null>(seat);
	seatRef.current = seat;

	const sendJoin = useCallback(() => {
		const s = seatRef.current;
		const ws = wsRef.current;
		if (!s || !ws || ws.readyState !== WebSocket.OPEN) return;
		ws.send(
			JSON.stringify({ type: "join", username: s.username, token: s.token })
		);
	}, []);

	const connect = useCallback(() => {
		cancelledRef.current = false;
		const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
		// No credentials in the URL — the socket always opens as a
		// spectator and seating is negotiated in-band via `join`.
		const url = `${proto}//${window.location.host}/api/room/${roomCode}/ws`;
		setConnection("connecting");
		setErrorMsg(null);
		const ws = new WebSocket(url);
		wsRef.current = ws;

		ws.onopen = () => {
			setConnection("open");
			// Reclaim (or take) our seat if we have one.
			sendJoin();
		};

		ws.onmessage = (ev) => {
			let parsed: ServerMessage;
			try {
				const raw = JSON.parse(ev.data);
				parsed = ServerMessageSchema.parse(raw);
			} catch {
				// Skip messages we can't validate. Errors here usually mean
				// the protocol drifted; surface in dev console only.
				return;
			}
			switch (parsed.type) {
				case "state":
					setState({
						board: parsed.board,
						players: parsed.players,
						turn: parsed.turn,
						status: parsed.status,
						visibility: parsed.visibility,
						lastMove: lastMoveRef.current,
					});
					break;
				case "move":
					lastMoveRef.current = {
						row: parsed.row,
						col: parsed.col,
						by: parsed.by,
					};
					setState((s) =>
						s ? { ...s, lastMove: lastMoveRef.current } : s
					);
					break;
				case "clear":
					setLastClear({
						id: ++eventIdRef.current,
						by: parsed.by,
						clearedSelf: parsed.clearedSelf,
						removedFromOpponents: parsed.removedFromOpponents,
						pointsAwarded: parsed.pointsAwarded,
						poem: parsed.poem ?? null,
					});
					break;
				case "timeout":
					setLastTimeout({
						id: ++eventIdRef.current,
						username: parsed.username,
					});
					break;
				case "error":
					if (SEAT_REJECT_CODES.has(parsed.code)) {
						setSeatRejection({
							id: ++eventIdRef.current,
							code: parsed.code,
							message: parsed.message,
						});
					} else {
						setErrorMsg(parsed.message);
					}
					break;
			}
		};

		ws.onclose = () => {
			setConnection("closed");
			wsRef.current = null;
			if (cancelledRef.current) return;
			reconnectTimerRef.current = window.setTimeout(connect, RECONNECT_MS);
		};

		ws.onerror = () => {
			setConnection("error");
		};
	}, [roomCode, sendJoin]);

	useEffect(() => {
		connect();
		return () => {
			cancelledRef.current = true;
			if (reconnectTimerRef.current !== null) {
				window.clearTimeout(reconnectTimerRef.current);
				reconnectTimerRef.current = null;
			}
			wsRef.current?.close();
			wsRef.current = null;
		};
	}, [connect]);

	// Send `join` when a seat appears while the socket is already open
	// (i.e. the user just picked a name). Connecting-then-seated is handled
	// by ws.onopen; this covers the open-then-seated order.
	useEffect(() => {
		if (connection === "open" && seat) sendJoin();
	}, [connection, seat, sendJoin]);

	const isSpectator = !seat;

	const place = useCallback(
		(row: number, col: number) => {
			if (!seat) return; // UI surfaces the sign-in prompt; just no-op here.
			const ws = wsRef.current;
			if (!ws || ws.readyState !== WebSocket.OPEN) return;
			ws.send(JSON.stringify({ type: "place", row, col }));
		},
		[seat]
	);

	const restart = useCallback(() => {
		if (!seat) return;
		const ws = wsRef.current;
		if (!ws || ws.readyState !== WebSocket.OPEN) return;
		ws.send(JSON.stringify({ type: "restart" }));
	}, [seat]);

	// Give up the current seat (stay connected as a spectator). The caller
	// is responsible for clearing its local seat afterwards.
	const leaveSeat = useCallback(() => {
		const ws = wsRef.current;
		if (!ws || ws.readyState !== WebSocket.OPEN) return;
		ws.send(JSON.stringify({ type: "resign" }));
	}, []);

	// Also drop lastMove on restart so the new round opens with a clean
	// indicator rather than the previous round's final dot.
	useEffect(() => {
		if (state?.status === "playing" || state?.status === "waiting") {
			if (lastMoveRef.current && state.board[lastMoveRef.current.row]?.[lastMoveRef.current.col] === null) {
				lastMoveRef.current = null;
			}
		}
	}, [state?.status, state?.board]);

	const isMyTurn = !!seat && state?.turn === seat.username;

	return {
		connection,
		state,
		isMyTurn,
		isSpectator,
		lastClear,
		lastTimeout,
		errorMsg,
		seatRejection,
		place,
		restart,
		leaveSeat,
	};
}
