import { useCallback, useEffect, useRef, useState } from "react";
import {
	ServerMessageSchema,
	type Board,
	type GameStatus,
	type RoomPlayer,
	type RoomVisibility,
	type ServerMessage,
} from "../../shared/protocol";

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
}

export interface RoomState {
	board: Board;
	players: RoomPlayer[];
	turn: string | null;
	status: GameStatus;
	visibility: RoomVisibility;
	lastMove: { row: number; col: number; by: string } | null;
}

interface Options {
	roomCode: string;
	username: string;
	token: string;
}

const RECONNECT_MS = 2000;

export function useMultiPlayerGame({ roomCode, username, token }: Options) {
	const [connection, setConnection] = useState<ConnectionStatus>("connecting");
	const [state, setState] = useState<RoomState | null>(null);
	const [lastClear, setLastClear] = useState<ClearEvent | null>(null);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	const wsRef = useRef<WebSocket | null>(null);
	const reconnectTimerRef = useRef<number | null>(null);
	const eventIdRef = useRef(0);
	// Keep the latest lastMove sticky across server `state` messages — the
	// state payload doesn't include it, but the preceding `move` message
	// did. Stored in a ref so a new state push doesn't blow it away.
	const lastMoveRef = useRef<RoomState["lastMove"]>(null);
	const cancelledRef = useRef(false);

	const connect = useCallback(() => {
		cancelledRef.current = false;
		const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
		const url = `${proto}//${window.location.host}/api/room/${roomCode}/ws?username=${encodeURIComponent(
			username
		)}&token=${encodeURIComponent(token)}`;
		setConnection("connecting");
		setErrorMsg(null);
		const ws = new WebSocket(url);
		wsRef.current = ws;

		ws.onopen = () => {
			setConnection("open");
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
					});
					break;
				case "error":
					setErrorMsg(parsed.message);
					break;
				case "end":
					// Reserved for M5 round-end flow.
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
	}, [roomCode, username, token]);

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

	const place = useCallback((row: number, col: number) => {
		const ws = wsRef.current;
		if (!ws || ws.readyState !== WebSocket.OPEN) return;
		ws.send(JSON.stringify({ type: "place", row, col }));
	}, []);

	const leave = useCallback(() => {
		cancelledRef.current = true;
		if (reconnectTimerRef.current !== null) {
			window.clearTimeout(reconnectTimerRef.current);
			reconnectTimerRef.current = null;
		}
		wsRef.current?.close();
		wsRef.current = null;
	}, []);

	const me = state?.players.find((p) => p.username === username) ?? null;
	const isMyTurn = state?.turn === username;

	return {
		connection,
		state,
		me,
		isMyTurn,
		lastClear,
		errorMsg,
		place,
		leave,
	};
}
