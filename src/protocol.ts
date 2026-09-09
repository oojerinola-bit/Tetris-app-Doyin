// Wire protocol shared by the browser client and the Cloudflare Durable Object.
//
// Boards are sent as a flat 200-character digit string rather than nested JSON
// arrays: ~200 bytes per frame instead of ~1 KB, which matters because every
// player broadcasts a snapshot on each piece movement.

import { COLS, ROWS, type Board, type Cell } from "./tetris";

export const MAX_PLAYERS = 2;

export type Seat = 0 | 1;

export type PlayerStatus = "idle" | "playing" | "paused" | "over";

export type Snapshot = {
  /** Flat ROWS*COLS digit string, including the active piece. */
  board: string;
  score: number;
  lines: number;
  level: number;
  status: PlayerStatus;
};

export type Peer = {
  id: string;
  name: string;
  seat: Seat;
  snapshot: Snapshot | null;
};

/** Browser → server. */
export type ClientMessage =
  | { t: "hello"; name: string }
  | { t: "state"; snapshot: Snapshot }
  | { t: "attack"; rows: number }
  | { t: "ping" };

/** Server → browser. */
export type ServerMessage =
  | { t: "welcome"; id: string; seat: Seat; room: string; peers: Peer[] }
  | { t: "peer-join"; peer: Peer }
  | { t: "peer-leave"; id: string }
  | { t: "peer-state"; id: string; snapshot: Snapshot }
  | { t: "attack"; rows: number; from: string }
  | { t: "error"; code: "room-full" | "bad-room"; message: string }
  | { t: "pong" };

export function encodeBoard(board: Board): string {
  let out = "";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) out += board[r][c];
  }
  return out;
}

export function decodeBoard(s: string): Board {
  const board: Board = [];
  for (let r = 0; r < ROWS; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < COLS; c++) {
      const ch = s.charCodeAt(r * COLS + c) - 48;
      row.push((ch >= 0 && ch <= 8 ? ch : 0) as Cell);
    }
    board.push(row);
  }
  return board;
}

export const EMPTY_BOARD_STRING = "0".repeat(ROWS * COLS);

/** Room codes are XXXX-XXXX over an unambiguous alphabet. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// The code alphabet deliberately contains none of 0/O/1/I, so any of those
// four characters is a transcription slip rather than a real code character.
export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidRoomCode(raw: string): boolean {
  const code = normalizeRoomCode(raw);
  if (code.length < 4 || code.length > 12) return false;
  return [...code].every(ch => CODE_ALPHABET.includes(ch));
}

export function generateRoomCode(): string {
  const seg = (n: number) =>
    Array.from(
      { length: n },
      () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
    ).join("");
  return `${seg(4)}-${seg(4)}`;
}
