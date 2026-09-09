import { useEffect, useMemo, useRef } from "react";
import * as T from "./tetris";
import { useGame } from "./useGame";
import { useRoom } from "./useRoom";
import { decodeBoard, encodeBoard, type Snapshot } from "./protocol";

const FONT = "'Space Mono', monospace";
const TITLE_FONT = "'Monoton', cursive";
const BLACK = "#0B0B12";
const MAGENTA = "#FF2E92";
const CYAN = "#00E5FF";
const VIOLET = "#6B21A8";
const PANEL = "#1A0B2E";

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
        background: PANEL,
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
            background: c.type === 0 ? "#0F0818" : (T.PIECE_COLORS[c.type] ?? "#fff"),
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
        background: "#0F0818",
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
      <div style={{ fontSize: "0.42rem", letterSpacing: "0.28em", color: VIOLET, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "0.05em", lineHeight: 1, color: CYAN }}>
        {value}
      </div>
    </div>
  );
}

// ─── Game screen ──────────────────────────────────────────────────────────────

type Props = { roomCode: string; playerName?: string; onExit: () => void };

/** How often at most to push a board snapshot to the opponent. */
const SNAPSHOT_INTERVAL_MS = 60;

export default function Game({ roomCode, playerName = "PLAYER", onExit }: Props) {
  // `useGame` needs to send attacks and `useRoom` needs to deliver them, so the
  // two are tied together through a ref rather than a direct circular call.
  const sendAttackRef = useRef<(rows: number) => void>(() => {});

  const game = useGame({ onAttack: rows => sendAttackRef.current(rows) });

  const room = useRoom({
    room: roomCode,
    name: playerName,
    onAttack: game.receiveGarbage,
  });

  sendAttackRef.current = room.sendAttack;

  // Board as the opponent should see it: locked cells plus the live piece.
  const snapshot: Snapshot = useMemo(() => {
    const withPiece = game.piece ? T.place(game.board, game.piece) : game.board;
    return {
      board: encodeBoard(withPiece),
      score: game.score,
      lines: game.lines,
      level: game.level,
      status: game.status,
    };
  }, [game.board, game.piece, game.score, game.lines, game.level, game.status]);

  // Coalesce rapid updates (gravity ticks + key repeat) into one send per frame
  // budget, so a fast player does not spam the Durable Object.
  const sendState = room.sendState;
  const pending = useRef<Snapshot | null>(null);
  useEffect(() => {
    pending.current = snapshot;
    const id = setTimeout(() => {
      if (pending.current) {
        sendState(pending.current);
        pending.current = null;
      }
    }, SNAPSHOT_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [snapshot, sendState]);

  const oppSnapshot = room.opponent?.snapshot ?? null;
  const oppBoard = useMemo(
    () => (oppSnapshot ? decodeBoard(oppSnapshot.board) : T.emptyBoard()),
    [oppSnapshot],
  );

  const statusLabel =
    room.error                       ? room.error.message.toUpperCase() :
    room.connection === "open"       ? (room.opponent ? "● LIVE" : "● CONNECTED") :
    room.connection === "connecting" ? "CONNECTING…" :
    room.connection === "reconnecting" ? "RECONNECTING…" :
                                       "OFFLINE";

  const statusColor =
    room.error                 ? "#FF3864" :
    room.connection === "open" ? (room.opponent ? "#39FF14" : CYAN) :
                                 VIOLET;

  const overlayVisible = game.status !== "playing";

  const overlayTitle =
    game.status === "over"   ? "GAME OVER" :
    game.status === "paused" ? "PAUSED"    :
                               "PARLOR";

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
      className="scanlines"
      style={{
        background: BLACK,
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
          borderBottom: `1px solid ${PANEL}`,
          padding: "0.6rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div style={{ fontFamily: TITLE_FONT, fontWeight: 400, fontSize: "1.3rem", color: MAGENTA }}>
          PARLOR
        </div>

        <div style={{ display: "flex", gap: "2.5rem", fontSize: "0.5rem", letterSpacing: "0.18em", color: VIOLET }}>
          <span>ROOM <span style={{ color: MAGENTA }}>{roomCode}</span></span>
          <span>P PAUSE</span>
          <span>SPACE HARD DROP</span>
        </div>

        <button
          onClick={onExit}
          style={{
            background: "transparent",
            color: CYAN,
            fontFamily: FONT,
            fontSize: "0.5rem",
            letterSpacing: "0.2em",
            padding: "0.4rem 0.8rem",
            border: `1px solid ${CYAN}`,
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
            <div style={{ fontSize: "0.42rem", letterSpacing: "0.28em", color: VIOLET, marginBottom: 8 }}>
              NEXT
            </div>
            <NextPiece type={game.next} />
          </div>
        </div>

        {/* Centre: your board */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{ fontSize: "0.42rem", letterSpacing: "0.28em", color: CYAN, marginBottom: 6 }}>YOU</div>
          <GameBoard board={game.board} piece={game.piece} ghost={game.ghost} cell={26} />

          {/* Overlay */}
          {overlayVisible && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(11,11,18,0.92)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "1.25rem",
              }}
            >
              <div
                style={{
                  fontFamily: overlayTitle === "PARLOR" ? TITLE_FONT : FONT,
                  fontWeight: overlayTitle === "PARLOR" ? 400 : 800,
                  fontSize: overlayTitle === "PARLOR" ? "2rem" : "1.4rem",
                  letterSpacing: overlayTitle === "PARLOR" ? "0.02em" : "-0.03em",
                  color: MAGENTA,
                  textAlign: "center",
                }}
              >
                {overlayTitle}
              </div>

              {game.status === "idle" && (
                <div style={{ fontSize: "0.47rem", color: VIOLET, letterSpacing: "0.22em", textAlign: "center", maxWidth: 220, lineHeight: 2 }}>
                  ROOM: <span style={{ color: MAGENTA }}>{roomCode}</span>
                  <br />
                  {room.opponent
                    ? <span style={{ color: "#39FF14" }}>OPPONENT READY</span>
                    : "SHARE THE CODE, THEN START"}
                </div>
              )}

              {game.status === "over" && (
                <div style={{ fontSize: "0.5rem", color: VIOLET, letterSpacing: "0.15em" }}>
                  FINAL SCORE: {String(game.score).padStart(6, "0")}
                </div>
              )}

              <button
                onClick={handleOverlayBtn}
                style={{
                  background: MAGENTA,
                  color: "#000",
                  fontFamily: FONT,
                  fontWeight: 700,
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
        <div style={{ flexShrink: 0, alignSelf: "flex-start", paddingTop: "0.5rem", position: "relative" }}>
          <div style={{ fontSize: "0.42rem", letterSpacing: "0.28em", color: CYAN, marginBottom: 4 }}>
            {room.opponent ? room.opponent.name.toUpperCase() : "OPPONENT"}
          </div>
          <div
            style={{
              fontSize: "0.55rem",
              color: MAGENTA,
              letterSpacing: "0.12em",
              marginBottom: 8,
              fontWeight: 700,
            }}
          >
            {String(oppSnapshot?.score ?? 0).padStart(6, "0")}
          </div>

          <div style={{ position: "relative" }}>
            <GameBoard board={oppBoard} cell={14} />

            {!room.opponent && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(11,11,18,0.9)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0.5rem",
                }}
              >
                <div
                  style={{
                    fontSize: "0.42rem",
                    letterSpacing: "0.2em",
                    color: VIOLET,
                    textAlign: "center",
                    lineHeight: 1.8,
                  }}
                >
                  WAITING FOR
                  <br />
                  OPPONENT
                  <br />
                  <span className="cursor-blink" style={{ color: MAGENTA }}>_</span>
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: "0.38rem",
              letterSpacing: "0.18em",
              color: statusColor,
            }}
          >
            {statusLabel}
          </div>
        </div>
      </main>

      {/* ── Footer hint ──────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: `1px solid ${PANEL}`,
          padding: "0.45rem 2rem",
          display: "flex",
          justifyContent: "center",
          gap: "2.5rem",
          fontSize: "0.38rem",
          letterSpacing: "0.15em",
          color: VIOLET,
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
