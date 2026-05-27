import type {
	ClaimRequest,
	ClaimResponse,
	RenameRequest,
} from "../../shared/protocol";

export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string
	) {
		super(message);
	}
}

async function post<T>(path: string, body: unknown): Promise<T> {
	const res = await fetch(path, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	const data = (await res.json().catch(() => null)) as
		| { error?: string }
		| null;
	if (!res.ok) {
		const code = data?.error ?? `http_${res.status}`;
		throw new ApiError(res.status, code, code);
	}
	return data as T;
}

export const api = {
	claim(req: ClaimRequest) {
		return post<ClaimResponse>("/api/user/claim", req);
	},
	rename(req: RenameRequest) {
		return post<ClaimResponse>("/api/user/rename", req);
	},
};
