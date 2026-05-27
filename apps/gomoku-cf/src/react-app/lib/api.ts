import type {
	ClaimRequest,
	ClaimResponse,
	CreateRoomRequest,
	CreateRoomResponse,
	ListRoomsResponse,
	RenameRequest,
	ScoreRequest,
	UserStats,
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

async function request<T>(
	path: string,
	init: RequestInit = {}
): Promise<T> {
	const res = await fetch(path, init);
	const data = (await res.json().catch(() => null)) as
		| { error?: string }
		| null;
	if (!res.ok) {
		const code = data?.error ?? `http_${res.status}`;
		throw new ApiError(res.status, code, code);
	}
	return data as T;
}

function post<T>(path: string, body: unknown): Promise<T> {
	return request<T>(path, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function get<T>(path: string): Promise<T> {
	return request<T>(path, { method: "GET" });
}

export const api = {
	claim(req: ClaimRequest) {
		return post<ClaimResponse>("/api/user/claim", req);
	},
	rename(req: RenameRequest) {
		return post<ClaimResponse>("/api/user/rename", req);
	},
	score(req: ScoreRequest) {
		return post<UserStats>("/api/user/score", req);
	},
	createRoom(req: CreateRoomRequest) {
		return post<CreateRoomResponse>("/api/room", req);
	},
	listRooms() {
		return get<ListRoomsResponse>("/api/room");
	},
};
