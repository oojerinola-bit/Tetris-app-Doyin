import { useCallback, useEffect, useRef, useState } from "react";
import {
  normalizeRoomCode,
  type ClientMessage,
  type Peer,
  type Seat,
  type ServerMessage,
  type Snapshot,
} from "./protocol";

export type ConnectionState =
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed"
  | "error";

export type RoomError = { code: "room-full" | "bad-room" | "network"; message: string };

/** Build the room WebSocket URL for the current origin (ws:// in dev, wss:// live). */
function socketUrl(room: string, name: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = new URL(`${proto}//${window.location.host}/api/room/${encodeURIComponent(room)}/ws`);
  url.searchParams.set("name", name);
  return url.toString();
}

type Options = {
  room: string;
  name?: string;
  /** Called when the opponent lands an attack on you. */
  onAttack?: (rows: number) => void;
};

/**
 * Live connection to a room's Durable Object. Handles reconnect with backoff,
 * keeps the opponent's latest snapshot, and exposes senders for state/attacks.
 */
export function useRoom({ room, name = "PLAYER", onAttack }: Options) {
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [error, setError] = useState<RoomError | null>(null);
  const [seat, setSeat] = useState<Seat | null>(null);
  const [opponent, setOpponent] = useState<Peer | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const attackRef = useRef(onAttack);
  attackRef.current = onAttack;

  // Latest snapshot we tried to send while the socket was down, replayed on
  // reconnect so the opponent's view catches up immediately.
  const lastSnapshot = useRef<Snapshot | null>(null);

  useEffect(() => {
    const code = normalizeRoomCode(room);
    if (!code) {
      setConnection("error");
      setError({ code: "bad-room", message: "Invalid room code." });
      return;
    }

    let disposed = false;
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let fatal = false;

    const connect = () => {
      if (disposed) return;

      const ws = new WebSocket(socketUrl(code, name));
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) return;
        retries = 0;
        setConnection("open");
        setError(null);
        ws.send(JSON.stringify({ t: "hello", name } satisfies ClientMessage));
        if (lastSnapshot.current) {
          ws.send(JSON.stringify({ t: "state", snapshot: lastSnapshot.current } satisfies ClientMessage));
        }
        // Keep intermediaries from dropping an idle socket.
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ t: "ping" } satisfies ClientMessage));
          }
        }, 30_000);
      };

      ws.onmessage = event => {
        if (disposed || typeof event.data !== "string") return;
        let msg: ServerMessage;
        try {
          msg = JSON.parse(event.data) as ServerMessage;
        } catch {
          return;
        }

        switch (msg.t) {
          case "welcome":
            setSeat(msg.seat);
            setOpponent(msg.peers[0] ?? null);
            break;
          case "peer-join":
            setOpponent(msg.peer);
            break;
          case "peer-state":
            setOpponent(prev =>
              prev && prev.id !== msg.id ? prev : { ...(prev ?? { id: msg.id, name: "PLAYER", seat: 1 as Seat }), id: msg.id, snapshot: msg.snapshot },
            );
            break;
          case "peer-leave":
            setOpponent(prev => (prev && prev.id === msg.id ? null : prev));
            break;
          case "attack":
            attackRef.current?.(msg.rows);
            break;
          case "error":
            fatal = true;
            setError({ code: msg.code, message: msg.message });
            setConnection("error");
            break;
        }
      };

      ws.onclose = () => {
        clearInterval(pingTimer);
        if (disposed || fatal) return;
        // Exponential backoff, capped at 10s.
        const delay = Math.min(10_000, 500 * 2 ** retries);
        retries += 1;
        setConnection("reconnecting");
        retryTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // onclose always follows; it owns the retry.
      };
    };

    connect();

    return () => {
      disposed = true;
      clearInterval(pingTimer);
      clearTimeout(retryTimer);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close(1000, "leaving");
      }
      setConnection("closed");
    };
  }, [room, name]);

  const sendState = useCallback((snapshot: Snapshot) => {
    lastSnapshot.current = snapshot;
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ t: "state", snapshot } satisfies ClientMessage));
    }
  }, []);

  const sendAttack = useCallback((rows: number) => {
    const ws = wsRef.current;
    if (rows > 0 && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ t: "attack", rows } satisfies ClientMessage));
    }
  }, []);

  return { connection, error, seat, opponent, sendState, sendAttack };
}
