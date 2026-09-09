import { isValidRoomCode, normalizeRoomCode } from "../src/protocol";
import { Room } from "./room";

export { Room };

export interface Env {
  ROOM: DurableObjectNamespace<Room>;
  ASSETS: Fetcher;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // /api/room/:code/ws   → upgrade into the room's Durable Object
    // /api/room/:code      → occupancy check used by the lobby
    const match = url.pathname.match(/^\/api\/room\/([^/]+)(\/ws)?$/);
    if (match) {
      const rawCode = decodeURIComponent(match[1]);
      const isWs = Boolean(match[2]);

      if (!isValidRoomCode(rawCode)) {
        return json({ error: "bad-room", message: "Invalid room code." }, 400);
      }

      const code = normalizeRoomCode(rawCode);
      const stub = env.ROOM.get(env.ROOM.idFromName(code));

      if (!isWs) {
        return json({ room: code, ...(await stub.info()) });
      }

      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }

      const forward = new URL(request.url);
      forward.searchParams.set("room", code);
      return stub.fetch(new Request(forward, request));
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "not-found" }, 404);
    }

    // Everything else is the static SPA.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
