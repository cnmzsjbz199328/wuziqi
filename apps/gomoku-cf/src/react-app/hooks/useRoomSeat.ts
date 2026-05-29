import { useCallback, useEffect, useState } from "react";
import { TokenSchema, UsernameSchema } from "../../shared/protocol";

export interface Seat {
	username: string;
	token: string;
}

// Preferred name is remembered across rooms purely as a convenience
// default — it does NOT reserve the name anywhere. The seat (name +
// token) is stored per-room so a reload can reclaim the same seat.
const NAME_KEY = "gomoku.name";
const seatKey = (room: string) => `gomoku.seat:${room}`;

export function getPreferredName(): string {
	try {
		const raw = localStorage.getItem(NAME_KEY) ?? "";
		return UsernameSchema.safeParse(raw).success ? raw : "";
	} catch {
		return "";
	}
}

function readSeat(room: string): Seat | null {
	if (!room) return null;
	try {
		const raw = localStorage.getItem(seatKey(room));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<Seat>;
		if (
			UsernameSchema.safeParse(parsed.username).success &&
			TokenSchema.safeParse(parsed.token).success
		) {
			return { username: parsed.username!, token: parsed.token! };
		}
		return null;
	} catch {
		return null;
	}
}

// 64 random bytes → 128 hex chars, matching TokenSchema. The token is
// just a seat secret generated client-side; the DO binds it to the name
// on first join and checks it on reconnect.
function generateToken(): string {
	const bytes = new Uint8Array(64);
	crypto.getRandomValues(bytes);
	let hex = "";
	for (const b of bytes) hex += b.toString(16).padStart(2, "0");
	return hex;
}

/**
 * Per-room seat identity. There is no global account: a name is a
 * room-scoped label, and the same name can be used freely in different
 * rooms. `take` claims a seat (reusing the room's existing token so a
 * re-pick after a reload still reclaims), `clear` drops back to spectator.
 */
export function useRoomSeat(roomCode: string) {
	const [seat, setSeat] = useState<Seat | null>(() => readSeat(roomCode));

	useEffect(() => {
		setSeat(readSeat(roomCode));
	}, [roomCode]);

	const take = useCallback(
		(name: string) => {
			if (!roomCode) return;
			const token = readSeat(roomCode)?.token ?? generateToken();
			const next: Seat = { username: name, token };
			try {
				localStorage.setItem(seatKey(roomCode), JSON.stringify(next));
				localStorage.setItem(NAME_KEY, name);
			} catch {
				// ignore
			}
			setSeat(next);
		},
		[roomCode]
	);

	const clear = useCallback(() => {
		if (!roomCode) return;
		try {
			localStorage.removeItem(seatKey(roomCode));
		} catch {
			// ignore
		}
		setSeat(null);
	}, [roomCode]);

	return { seat, take, clear };
}
