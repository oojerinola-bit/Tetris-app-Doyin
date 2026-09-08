import { useReducer, useEffect } from "react";
import * as T from "./tetris";

export type Status = "idle" | "playing" | "paused" | "over";

type State = {
  board: T.Board;
  piece: T.Piece | null;
  next: T.PieceType;
  score: number;
  lines: number;
  level: number;
  status: Status;
};

type Action =
  | { type: "START" }
  | { type: "TICK" }
  | { type: "MOVE"; dx: number }
  | { type: "ROTATE" }
  | { type: "SOFT_DROP" }
  | { type: "HARD_DROP" }
  | { type: "PAUSE" };

function init(): State {
  return {
    board: T.emptyBoard(),
    piece: null,
    next: T.randomType(),
    score: 0,
    lines: 0,
    level: 0,
    status: "idle",
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
  const { board, cleared } = T.clearLines(placed);
  const lines = s.lines + cleared;
  const level = Math.floor(lines / 10);
  const score = s.score + T.linesToScore(cleared, level);
  return spawnNext({ ...s, board, lines, level, score, piece: null });
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "START":
      return spawnNext({ ...init(), status: "playing" });

    case "PAUSE":
      if (s.status === "playing") return { ...s, status: "paused" };
      if (s.status === "paused") return { ...s, status: "playing" };
      return s;

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

export function useGame() {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  // Gravity tick — recreated when level or status changes
  useEffect(() => {
    if (state.status !== "playing") return;
    const id = setInterval(() => dispatch({ type: "TICK" }), T.tickMs(state.level));
    return () => clearInterval(id);
  }, [state.status, state.level]);

  // Keyboard controls
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Allow repeat only for movement and soft drop
      if (e.repeat) {
        if (e.key === "ArrowLeft") { e.preventDefault(); dispatch({ type: "MOVE", dx: -1 }); }
        else if (e.key === "ArrowRight") { e.preventDefault(); dispatch({ type: "MOVE", dx: 1 }); }
        else if (e.key === "ArrowDown") { e.preventDefault(); dispatch({ type: "SOFT_DROP" }); }
        return;
      }
      switch (e.key) {
        case "ArrowLeft":  e.preventDefault(); dispatch({ type: "MOVE", dx: -1 }); break;
        case "ArrowRight": e.preventDefault(); dispatch({ type: "MOVE", dx: 1 });  break;
        case "ArrowUp":    e.preventDefault(); dispatch({ type: "ROTATE" });        break;
        case "ArrowDown":  e.preventDefault(); dispatch({ type: "SOFT_DROP" });     break;
        case " ":          e.preventDefault(); dispatch({ type: "HARD_DROP" });     break;
        case "p": case "P": dispatch({ type: "PAUSE" }); break;
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  const ghostPiece =
    state.piece && state.status === "playing"
      ? T.ghost(state.board, state.piece)
      : null;

  return {
    ...state,
    ghost: ghostPiece,
    start: () => dispatch({ type: "START" }),
    pause: () => dispatch({ type: "PAUSE" }),
  };
}
