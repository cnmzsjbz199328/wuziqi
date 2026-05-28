import { useCallback, useState } from "react";
import { ApiError, api } from "../lib/api";
import { randomName } from "../lib/randomName";

const STORAGE_KEY = "gomoku.identity";

export interface Identity {
	username: string;
	token: string;
	score: number;
}

function loadIdentity(): Identity | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<Identity>;
		if (
			typeof parsed.username === "string" &&
			typeof parsed.token === "string"
		) {
			return {
				username: parsed.username,
				token: parsed.token,
				// Pre-M3 identities stored before the score field existed: treat
				// as 0 locally; next score POST returns the authoritative number.
				score: typeof parsed.score === "number" ? parsed.score : 0,
			};
		}
		return null;
	} catch {
		return null;
	}
}

function saveIdentity(id: Identity) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(id));
}

export type IdentityState =
	| { status: "anonymous" }
	| { status: "ready"; identity: Identity };

function initialState(): IdentityState {
	// Pure CSR app — reading localStorage during render is safe.
	const stored = loadIdentity();
	return stored ? { status: "ready", identity: stored } : { status: "anonymous" };
}

export function useIdentity() {
	const [state, setState] = useState<IdentityState>(initialState);

	const claimRandom = useCallback(async (): Promise<Identity> => {
		// Up to 3 retries on the (very unlikely) collision.
		let lastError: unknown;
		for (let attempt = 0; attempt < 3; attempt++) {
			const name = randomName();
			try {
				const response = await api.claim({ username: name });
				const identity: Identity = {
					username: response.username,
					token: response.token,
					score: response.score,
				};
				saveIdentity(identity);
				setState({ status: "ready", identity });
				return identity;
			} catch (e) {
				lastError = e;
				if (!(e instanceof ApiError) || e.code !== "taken") throw e;
			}
		}
		throw lastError ?? new Error("Random name retries exhausted");
	}, []);

	const claimCustom = useCallback(
		async (name: string): Promise<Identity> => {
			const response = await api.claim({ username: name });
			const identity: Identity = {
				username: response.username,
				token: response.token,
				score: response.score,
			};
			saveIdentity(identity);
			setState({ status: "ready", identity });
			return identity;
		},
		[]
	);

	const renameTo = useCallback(
		async (newName: string): Promise<Identity> => {
			if (state.status !== "ready") {
				throw new Error("Cannot rename before identity is established");
			}
			const response = await api.rename({
				username: state.identity.username,
				token: state.identity.token,
				newName,
			});
			const identity: Identity = {
				username: response.username,
				token: response.token,
				score: response.score,
			};
			saveIdentity(identity);
			setState({ status: "ready", identity });
			return identity;
		},
		[state]
	);

	const signOut = useCallback(() => {
		localStorage.removeItem(STORAGE_KEY);
		setState({ status: "anonymous" });
	}, []);

	return { state, claimRandom, claimCustom, renameTo, signOut };
}
