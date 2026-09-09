import { useState } from "react";
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from "./protocol";

const FONT = "'Space Mono', monospace";
const TITLE_FONT = "'Monoton', cursive";
const BLACK = "#0B0B12";
const MAGENTA = "#FF2E92";
const CYAN = "#00E5FF";
const VIOLET = "#6B21A8";

/** Ask the Worker whether a room exists and has space before joining it. */
async function checkRoom(code: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(`/api/room/${encodeURIComponent(code)}`);
    if (!res.ok) return { ok: false, reason: "INVALID ROOM CODE" };
    const info = (await res.json()) as { exists: boolean; full: boolean };
    if (!info.exists) return { ok: false, reason: "NO SUCH ROOM — CHECK THE CODE" };
    if (info.full) return { ok: false, reason: "ROOM IS FULL" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "CANNOT REACH SERVER" };
  }
}

type Props = { onStart: (code: string, name: string) => void };

export default function Lobby({ onStart }: Props) {
  const [mode, setMode] = useState<"idle" | "create" | "join">("idle");
  const [joinCode, setJoinCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdCode] = useState(generateRoomCode);

  const playerName = () => name.trim().slice(0, 24) || "PLAYER";

  const handleJoin = async () => {
    const code = normalizeRoomCode(joinCode);
    if (!isValidRoomCode(code)) {
      setError("ENTER A VALID ROOM CODE");
      return;
    }
    setBusy(true);
    setError("");
    const result = await checkRoom(code);
    setBusy(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    onStart(code, playerName());
  };

  const btn = (label: string, onClick: () => void, primary = false, disabled = false) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: primary ? MAGENTA : "transparent",
        color: primary ? "#000" : CYAN,
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: "0.68rem",
        letterSpacing: "0.22em",
        padding: "0.9rem 2.25rem",
        border: primary ? "none" : `2px solid ${CYAN}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "opacity 0.1s",
      }}
    >
      {label}
    </button>
  );

  const nameField = (
    <input
      type="text"
      value={name}
      onChange={e => setName(e.target.value)}
      placeholder="YOUR NAME"
      maxLength={24}
      style={{
        background: BLACK,
        color: CYAN,
        fontFamily: FONT,
        fontSize: "0.7rem",
        letterSpacing: "0.18em",
        padding: "0.6rem 1rem",
        border: `1px solid ${VIOLET}`,
        outline: "none",
        width: "100%",
        textAlign: "center",
        marginBottom: "1rem",
      }}
    />
  );

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
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        userSelect: "none",
      }}
    >
      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
        <div style={{ fontSize: "0.62rem", letterSpacing: "0.4em", color: CYAN, marginBottom: "1rem" }}>
          MULTIPLAYER TETRIS
        </div>
        <h1
          style={{
            fontFamily: TITLE_FONT,
            fontSize: "clamp(4rem, 13vw, 8rem)",
            fontWeight: 400,
            lineHeight: 1,
            letterSpacing: "0.02em",
            color: MAGENTA,
            margin: "0 0 1.25rem",
          }}
        >
          PARLOR
        </h1>
        <p style={{ fontSize: "0.6rem", letterSpacing: "0.3em", color: CYAN, margin: 0, fontWeight: 700 }}>
          CLEAR LINES · SEND GARBAGE · NO MERCY
        </p>
      </div>

      {/* Idle: two CTAs */}
      {mode === "idle" && (
        <div style={{ display: "flex", gap: "0.75rem" }}>
          {btn("CREATE ROOM", () => { setError(""); setMode("create"); }, true)}
          {btn("JOIN ROOM", () => { setError(""); setMode("join"); })}
        </div>
      )}

      {/* Create: show generated code */}
      {mode === "create" && (
        <div style={{ textAlign: "center", width: "100%", maxWidth: 340 }}>
          <div style={{ fontSize: "0.47rem", letterSpacing: "0.3em", color: VIOLET, marginBottom: "0.75rem" }}>
            YOUR ROOM CODE
          </div>
          <div
            style={{
              fontSize: "2.2rem",
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: MAGENTA,
              border: `2px solid ${MAGENTA}`,
              padding: "0.65rem 1rem",
              marginBottom: "0.75rem",
            }}
          >
            {createdCode}
          </div>
          <button
            onClick={() => navigator.clipboard?.writeText(createdCode)}
            style={{
              background: "transparent",
              border: "none",
              color: CYAN,
              fontFamily: FONT,
              fontSize: "0.44rem",
              letterSpacing: "0.2em",
              cursor: "pointer",
              marginBottom: "1.5rem",
            }}
          >
            [ COPY CODE ]
          </button>

          {nameField}

          <div style={{ fontSize: "0.44rem", color: VIOLET, letterSpacing: "0.2em", marginBottom: "1.5rem" }}>
            SHARE THE CODE — YOUR OPPONENT JOINS WITH IT
          </div>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            {btn("ENTER ROOM →", () => onStart(createdCode, playerName()), true)}
            {btn("← BACK", () => setMode("idle"))}
          </div>
        </div>
      )}

      {/* Join: code input */}
      {mode === "join" && (
        <div style={{ textAlign: "center", width: "100%", maxWidth: 340 }}>
          <div style={{ fontSize: "0.47rem", letterSpacing: "0.3em", color: VIOLET, marginBottom: "0.75rem" }}>
            ENTER ROOM CODE
          </div>
          <input
            type="text"
            value={joinCode}
            onChange={e => { setJoinCode(e.target.value.toUpperCase()); setError(""); }}
            onKeyDown={e => { if (e.key === "Enter" && !busy) void handleJoin(); }}
            placeholder="XXXX-XXXX"
            maxLength={9}
            autoFocus
            style={{
              background: BLACK,
              color: "#fff",
              fontFamily: FONT,
              fontSize: "1.5rem",
              fontWeight: 700,
              letterSpacing: "0.2em",
              padding: "0.75rem 1rem",
              border: `1px solid ${CYAN}`,
              outline: "none",
              width: "100%",
              textAlign: "center",
              marginBottom: "1rem",
            }}
          />

          {nameField}

          {error && (
            <div style={{ fontSize: "0.44rem", color: "#FF3864", letterSpacing: "0.2em", marginBottom: "0.75rem" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            {btn(busy ? "CHECKING…" : "JOIN →", () => void handleJoin(), true, busy)}
            {btn("← BACK", () => { setMode("idle"); setJoinCode(""); setError(""); })}
          </div>
        </div>
      )}

      {/* Controls hint at bottom */}
      <div
        style={{
          position: "fixed",
          bottom: "1.5rem",
          fontSize: "0.4rem",
          color: VIOLET,
          letterSpacing: "0.2em",
          textAlign: "center",
        }}
      >
        ← → MOVE · ↑ ROTATE · ↓ SOFT DROP · SPACE HARD DROP · P PAUSE
      </div>
    </div>
  );
}
