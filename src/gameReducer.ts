// Pure game logic, kept free of React so it can be reasoned about and tested
// on its own. `useGame` is the thin hook wrapper around this reducer.
import * as T from "./tetris";

export type Status = "idle" | "playing" | "paused" | "over";

export type State = {
  board: T.Board;
  piece: T.Piece | null;
  next: T.PieceType;
  score: number;
  lines: number;
  level: number;
  status: Status;
  /** Garbage rows received while a piece was locking, applied on next lock. */
  incoming: number;
  /** Attack rows earned but not yet handed to the network layer. */
  outbox: number;
};

export type Action =
  | { type: "START" }
  | { type: "TICK" }
  | { type: "MOVE"; dx: number }
  | { type: "ROTATE" }
  | { type: "SOFT_DROP" }
  | { type: "HARD_DROP" }
  | { type: "PAUSE" }
  | { type: "GARBAGE"; rows: number }
  | { type: "FLUSH_OUTBOX" };

export function init(): State {
  return {
    board: T.emptyBoard(),
    piece: null,
    next: T.randomType(),
    score: 0,
    lines: 0,
    level: 0,
    status: "idle",
    incoming: 0,
    outbox: 0,
  };
}

function spawnNext(s: State): State {
  const piece = T.spawnPiece(s.next);
  const next = T.randomType();
  if (!T.valid(s.board, piece)) return { ...s, status: "over", piece: null };
  return { ...s, piece, next };
}

function lock(s: State): State {
  if (!s.piece) return s;
  const placed = T.place(s.board, s.piece);
  const { board: cleared, cleared: clearedRows } = T.clearLines(placed);

  // Clearing lines cancels pending garbage before any of it lands.
  const attack = T.linesToAttack(clearedRows);
  const remaining = Math.max(0, s.incoming - clearedRows);
  const board = remaining > 0 ? T.addGarbage(cleared, remaining) : cleared;

  const lines = s.lines + clearedRows;
  const level = Math.floor(lines / 10);
  const score = s.score + T.linesToScore(clearedRows, level);

  return spawnNext({
    ...s,
    board,
    lines,
    level,
    score,
    piece: null,
    incoming: 0,
    outbox: s.outbox + attack,
  });
}

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "START":
      return spawnNext({ ...init(), status: "playing" });

    case "PAUSE":
      if (s.status === "playing") return { ...s, status: "paused" };
      if (s.status === "paused") return { ...s, status: "playing" };
      return s;

    case "FLUSH_OUTBOX":
      return s.outbox === 0 ? s : { ...s, outbox: 0 };

    case "GARBAGE": {
      if (a.rows <= 0) return s;
      // Only meaningful mid-game; ignore otherwise so a late packet cannot
      // corrupt a finished or unstarted board.
      if (s.status !== "playing" && s.status !== "paused") return s;
      if (!s.piece) return { ...s, board: T.addGarbage(s.board, a.rows) };
      // A piece is in play — queue it so the active piece is not teleported
      // into a wall mid-drop.
      return { ...s, incoming: s.incoming + a.rows };
    }

    case "TICK": {
      if (s.status !== "playing" || !s.piece) return s;
      const moved = { ...s.piece, y: s.piece.y + 1 };
      return T.valid(s.board, moved) ? { ...s, piece: moved } : lock(s);
    }

    case "MOVE": {
      if (s.status !== "playing" || !s.piece) return s;
      const moved = { ...s.piece, x: s.piece.x + a.dx };
      return T.valid(s.board, moved) ? { ...s, piece: moved } : s;
    }

    case "ROTATE": {
      if (s.status !== "playing" || !s.piece) return s;
      return { ...s, piece: T.rotate(s.board, s.piece) };
    }

    case "SOFT_DROP": {
      if (s.status !== "playing" || !s.piece) return s;
      const moved = { ...s.piece, y: s.piece.y + 1 };
      if (T.valid(s.board, moved)) return { ...s, piece: moved, score: s.score + 1 };
      return lock(s);
    }

    case "HARD_DROP": {
      if (s.status !== "playing" || !s.piece) return s;
      const g = T.ghost(s.board, s.piece);
      const bonus = Math.max(0, g.y - s.piece.y) * 2;
      return lock({ ...s, piece: g, score: s.score + bonus });
    }

    default:
      return s;
  }
}
