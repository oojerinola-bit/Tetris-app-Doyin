import { useMemo, useEffect, useState } from "react";
import * as T from "./tetris";
import { useGame } from "./useGame";

const FONT = "'JetBrains Mono', monospace";
const RED = "#FF2020";

// ─── Opponent simulation ──────────────────────────────────────────────────────

function useOpponent() {
  const [board, setBoard] = useState<T.Board>(T.emptyBoard);
  const [score, setScore] = useState(0);

  useEffect(() => {
    let active = true;
    let cur = T.emptyBoard();

    function tick() {
      if (!active) return;

      const type = T.randomType();
      // Pick a random rotation and starting x that is valid
      let piece: T.Piece | null = null;
      const rotations = [0, 1, 2, 3];
      const xs = Array.from({ length: 7 }, (_, i) => i);

      outer: for (const rot of rotations.sort(() => Math.random() - 0.5)) {
        for (const x of xs.sort(() => Math.random() - 0.5)) {
          const p: T.Piece = { type, rotation: rot, x, y: 0 };
          if (T.valid(cur, p)) { piece = p; break outer; }
        }
      }

      if (!piece) {
        // Board is jammed — reset
        cur = T.emptyBoard();
        setBoard(T.emptyBoard());
        setTimeout(tick, 1500);
        return;
      }

      // Drop to the floor
      let y = piece.y;
      while (T.valid(cur, { ...piece, y: y + 1 })) y++;
      piece = { ...piece, y };

      if (!T.valid(cur, piece)) {
        cur = T.emptyBoard();
        setBoard(T.emptyBoard());
        setTimeout(tick, 1500);
        return;
      }

      cur = T.place(cur, piece);
      const { board: cleared, cleared: lines } = T.clearLines(cur);
      cur = cleared;
      setBoard(cur.map(r => [...r]) as T.Board);
      if (lines > 0) setScore(s => s + T.linesToScore(lines, 0));

      setTimeout(tick, 450 + Math.random() * 650);
    }

    const start = setTimeout(tick, 1800);
    return () => { active = false; clearTimeout(start); };
  }, []);

  return { board, score };
}

// ─── Board renderer ───────────────────────────────────────────────────────────

type BoardProps = {
  board: T.Board;
  piece?: T.Piece | null;
  ghost?: T.Piece | null;
  cell: number;
};

function GameBoard({ board, piece = null, ghost = null, cell }: BoardProps) {
  const display = useMemo(() => {
    type Cell = { type: number; faded: boolean };
    const grid: Cell[][] = board.map(row => row.map(v => ({ type: v, faded: false })));

    if (ghost && piece && ghost.y !== piece.y) {
      for (const [r, c] of T.cells(ghost)) {
        if (r >= 0 && r < T.ROWS && c >= 0 && c < T.COLS && grid[r][c].type === 0) {
          grid[r][c] = { type: piece.type, faded: true };
        }
      }
    }

    if (piece) {
      for (const [r, c] of T.cells(piece)) {
        if (r >= 0 && r < T.ROWS && c >= 0 && c < T.COLS) {
          grid[r][c] = { type: piece.type, faded: false };
        }
      }
    }

    return grid.flat();
  }, [board, piece, ghost]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${T.COLS}, ${cell}px)`,
        gap: 1,
        background: "#1A1A1A",
        padding: 1,
        flexShrink: 0,
      }}
    >
      {display.map((c, i) => (
        <div
          key={i}
          style={{
            width: cell,
            height: cell,
            background: c.type === 0 ? "#0A0A0A" : (T.PIECE_COLORS[c.type] ?? "#fff"),
            opacity: c.faded ? 0.22 : 1,
          }}
        />
      ))}
    </div>
  );
}

// ─── Next-piece preview ───────────────────────────────────────────────────────

function NextPiece({ type }: { type: number }) {
  const shape = T.ROTATIONS[type]?.[0];
  if (!shape) return null;
  const color = T.PIECE_COLORS[type];
  const cs = 14;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(4, ${cs}px)`,
        gap: 1,
        background: "#0A0A0A",
        padding: 4,
      }}
    >
      {shape.flat().map((filled, i) => (
        <div
          key={i}
          style={{ width: cs, height: cs, background: filled ? color : "transparent" }}
        />
      ))}
    </div>
  );
}

// ─── Stat block ───────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.42rem", letterSpacing: "0.28em", color: "#333", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "0.05em", lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

// ─── Game screen ──────────────────────────────────────────────────────────────

type Props = { roomCode: string; onExit: () => void };

export default function Game({ roomCode, onExit }: Props) {
  const game = useGame();
  const opp = useOpponent();

  const overlayVisible = game.status !== "playing";

  const overlayTitle =
    game.status === "over"   ? "GAME OVER" :
    game.status === "paused" ? "PAUSED"    :
                               "BLOCKDROP";

  const overlayAction =
    game.status === "over"   ? "PLAY AGAIN" :
    game.status === "paused" ? "RESUME"     :
                               "START GAME";

  const handleOverlayBtn = () => {
    if (game.status === "paused") game.pause();
    else game.start();
  };

  return (
    <div
      style={{
        background: "#000",
        color: "#fff",
        minHeight: "100vh",
        fontFamily: FONT,
        display: "flex",
        flexDirection: "column",
        userSelect: "none",
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        style={{
          borderBottom: "1px solid #1A1A1A",
          padding: "0.6rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-0.03em" }}>
          BLOCK<span style={{ color: RED }}>DROP</span>
        </div>

        <div style={{ display: "flex", gap: "2.5rem", fontSize: "0.5rem", letterSpacing: "0.18em", color: "#333" }}>
          <span>ROOM <span style={{ color: RED }}>{roomCode}</span></span>
          <span>P PAUSE</span>
          <span>SPACE HARD DROP</span>
        </div>

        <button
          onClick={onExit}
          style={{
            background: "transparent",
            color: "#444",
            fontFamily: FONT,
            fontSize: "0.5rem",
            letterSpacing: "0.2em",
            padding: "0.4rem 0.8rem",
            border: "1px solid #1A1A1A",
            cursor: "pointer",
          }}
        >
          EXIT
        </button>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          gap: "2.5rem",
          minHeight: 0,
        }}
      >
        {/* Left: score/next */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.75rem",
            minWidth: 110,
            alignSelf: "flex-start",
            paddingTop: "0.5rem",
          }}
        >
          <Stat label="SCORE" value={String(game.score).padStart(6, "0")} />
          <Stat label="LEVEL" value={String(game.level).padStart(2, "0")} />
          <Stat label="LINES" value={String(game.lines).padStart(3, "0")} />
          <div>
            <div style={{ fontSize: "0.42rem", letterSpacing: "0.28em", color: "#333", marginBottom: 8 }}>
              NEXT
            </div>
            <NextPiece type={game.next} />
          </div>
        </div>

        {/* Centre: your board */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{ fontSize: "0.42rem", letterSpacing: "0.28em", color: "#333", marginBottom: 6 }}>YOU</div>
          <GameBoard board={game.board} piece={game.piece} ghost={game.ghost} cell={26} />

          {/* Overlay */}
          {overlayVisible && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.88)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "1.25rem",
              }}
            >
              <div style={{ fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-0.03em", textAlign: "center" }}>
                {overlayTitle}
              </div>

              {game.status === "idle" && (
                <div style={{ fontSize: "0.47rem", color: "#444", letterSpacing: "0.22em", textAlign: "center", maxWidth: 200 }}>
                  ROOM: <span style={{ color: RED }}>{roomCode}</span>
                  <br /><br />
                  SHARE THE CODE, THEN START
                </div>
              )}

              {game.status === "over" && (
                <div style={{ fontSize: "0.5rem", color: "#444", letterSpacing: "0.15em" }}>
                  FINAL SCORE: {String(game.score).padStart(6, "0")}
                </div>
              )}

              <button
                onClick={handleOverlayBtn}
                style={{
                  background: RED,
                  color: "#000",
                  fontFamily: FONT,
                  fontWeight: 800,
                  fontSize: "0.65rem",
                  letterSpacing: "0.22em",
                  padding: "0.8rem 2rem",
                  border: "none",
                  cursor: "pointer",
                  marginTop: "0.5rem",
                }}
              >
                {overlayAction}
              </button>
            </div>
          )}
        </div>

        {/* Right: opponent */}
        <div style={{ flexShrink: 0, alignSelf: "flex-start", paddingTop: "0.5rem" }}>
          <div style={{ fontSize: "0.42rem", letterSpacing: "0.28em", color: "#333", marginBottom: 4 }}>
            OPPONENT
          </div>
          <div
            style={{
              fontSize: "0.55rem",
              color: RED,
              letterSpacing: "0.12em",
              marginBottom: 8,
              fontWeight: 700,
            }}
          >
            {String(opp.score).padStart(6, "0")}
          </div>
          <GameBoard board={opp.board} cell={14} />
        </div>
      </main>

      {/* ── Footer hint ──────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid #0D0D0D",
          padding: "0.45rem 2rem",
          display: "flex",
          justifyContent: "center",
          gap: "2.5rem",
          fontSize: "0.38rem",
          letterSpacing: "0.15em",
          color: "#1A1A1A",
          flexShrink: 0,
        }}
      >
        <span>← → MOVE</span>
        <span>↑ ROTATE</span>
        <span>↓ SOFT DROP</span>
        <span>SPACE HARD DROP</span>
        <span>P PAUSE</span>
      </footer>
    </div>
  );
}
