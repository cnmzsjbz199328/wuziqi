import { DurableObject } from "cloudflare:workers";

// Stub for M0 — full implementation lands in M4.
// Right now it only accepts a WebSocket upgrade and echoes a hello so the
// binding is exercisable end-to-end before the real game logic is wired in.
export class GameRoom extends DurableObject<Env> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname.endsWith("/ws")) {
			if (request.headers.get("Upgrade") !== "websocket") {
				return new Response("Expected WebSocket", { status: 400 });
			}
			const pair = new WebSocketPair();
			const [client, server] = Object.values(pair);
			// Hibernation API — DO sleeps between messages, no GB-s billed while idle.
			this.ctx.acceptWebSocket(server);
			return new Response(null, { status: 101, webSocket: client });
		}
		return new Response("Not found", { status: 404 });
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		const text = typeof message === "string" ? message : "<binary>";
		ws.send(JSON.stringify({ type: "echo", received: text }));
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string) {
		ws.close(code, reason);
	}
}
