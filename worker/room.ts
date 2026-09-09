import { DurableObject } from "cloudflare:workers";
import {
  MAX_PLAYERS,
  type ClientMessage,
  type Peer,
  type Seat,
  type ServerMessage,
  type Snapshot,
} from "../src/protocol";

/**
 * Per-connection metadata. Stored via `serializeAttachment` so it survives
 * hibernation — the DO can be evicted between messages and rehydrated without
 * losing who is who.
 */
type Attachment = {
  id: string;
  name: string;
  seat: Seat;
  snapshot: Snapshot | null;
};

/** One room, addressed by room code. Relays state between up to two players. */
export class Room extends DurableObject {
  /** Idle rooms shut down on their own after this long with nobody connected. */
  static readonly EMPTY_TTL_MS = 10 * 60 * 1000;

  private sockets(): { ws: WebSocket; att: Attachment }[] {
    const out: { ws: WebSocket; att: Attachment }[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (att) out.push({ ws, att });
    }
    return out;
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // Socket already gone; close handler will clean up.
    }
  }

  /** Send to everyone except `exceptId`. */
  private broadcast(msg: ServerMessage, exceptId?: string) {
    for (const { ws, att } of this.sockets()) {
      if (att.id !== exceptId) this.send(ws, msg);
    }
  }

  /** Occupancy, used by the lobby's join check. */
  async info(): Promise<{ exists: boolean; players: number; full: boolean }> {
    const players = this.sockets().length;
    return { exists: players > 0, players, full: players >= MAX_PLAYERS };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const room = url.searchParams.get("room") ?? "";
    const name = (url.searchParams.get("name") ?? "").slice(0, 24) || "PLAYER";

    const existing = this.sockets();
    if (existing.length >= MAX_PLAYERS) {
      // Accept the socket only to deliver a clean reason, then close.
      const pair = new WebSocketPair();
      pair[1].accept();
      this.send(pair[1], {
        t: "error",
        code: "room-full",
        message: "This room already has two players.",
      });
      pair[1].close(4001, "room-full");
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    const takenSeats = new Set(existing.map(e => e.att.seat));
    const seat: Seat = takenSeats.has(0) ? 1 : 0;
    const id = crypto.randomUUID();

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    // Hibernatable accept: the DO can sleep between messages and still keep
    // this connection alive, so idle rooms cost nothing.
    this.ctx.acceptWebSocket(server);

    const att: Attachment = { id, name, seat, snapshot: null };
    server.serializeAttachment(att);

    const peers: Peer[] = existing.map(e => ({
      id: e.att.id,
      name: e.att.name,
      seat: e.att.seat,
      snapshot: e.att.snapshot,
    }));

    this.send(server, { t: "welcome", id, seat, room, peers });
    this.broadcast({ t: "peer-join", peer: { id, name, seat, snapshot: null } }, id);

    // Someone is here, so cancel any pending empty-room cleanup.
    await this.ctx.storage.deleteAlarm();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== "string") return;

    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }

    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att) return;

    switch (msg.t) {
      case "ping":
        this.send(ws, { t: "pong" });
        break;

      case "hello": {
        const name = String(msg.name ?? "").slice(0, 24) || att.name;
        ws.serializeAttachment({ ...att, name });
        this.broadcast(
          { t: "peer-join", peer: { ...att, name, snapshot: att.snapshot } },
          att.id,
        );
        break;
      }

      case "state": {
        const snapshot = sanitizeSnapshot(msg.snapshot);
        if (!snapshot) return;
        ws.serializeAttachment({ ...att, snapshot });
        this.broadcast({ t: "peer-state", id: att.id, snapshot }, att.id);
        break;
      }

      case "attack": {
        const rows = Math.max(0, Math.min(8, Math.floor(Number(msg.rows) || 0)));
        if (rows === 0) return;
        this.broadcast({ t: "attack", rows, from: att.id }, att.id);
        break;
      }
    }
  }

  async webSocketClose(ws: WebSocket) {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (att) this.broadcast({ t: "peer-leave", id: att.id }, att.id);
    await this.scheduleCleanupIfEmpty();
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }

  private async scheduleCleanupIfEmpty() {
    // getWebSockets() still includes the closing socket during this handler,
    // so treat "one or fewer" as empty.
    if (this.ctx.getWebSockets().length <= 1) {
      await this.ctx.storage.setAlarm(Date.now() + Room.EMPTY_TTL_MS);
    }
  }

  async alarm() {
    if (this.ctx.getWebSockets().length === 0) {
      await this.ctx.storage.deleteAll();
    }
  }
}

/** Reject malformed snapshots so one bad client cannot corrupt the other's view. */
function sanitizeSnapshot(s: unknown): Snapshot | null {
  if (!s || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  const board = o.board;
  if (typeof board !== "string" || board.length !== 200 || !/^[0-8]{200}$/.test(board)) {
    return null;
  }
  const status = o.status;
  if (status !== "idle" && status !== "playing" && status !== "paused" && status !== "over") {
    return null;
  }
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  };
  return {
    board,
    score: num(o.score),
    lines: num(o.lines),
    level: num(o.level),
    status,
  };
}
