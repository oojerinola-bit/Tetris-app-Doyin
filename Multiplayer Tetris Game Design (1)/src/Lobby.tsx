import { useState } from "react";

const FONT = "'JetBrains Mono', monospace";
const RED = "#FF2020";

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${seg(4)}-${seg(4)}`;
}

type Props = { onStart: (code: string) => void };

export default function Lobby({ onStart }: Props) {
  const [mode, setMode] = useState<"idle" | "create" | "join">("idle");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [createdCode] = useState(genCode);

  const btn = (label: string, onClick: () => void, primary = false) => (
    <button
      onClick={onClick}
      style={{
        background: primary ? RED : "transparent",
        color: primary ? "#000" : "#fff",
        fontFamily: FONT,
        fontWeight: primary ? 800 : 400,
        fontSize: "0.68rem",
        letterSpacing: "0.22em",
        padding: "0.9rem 2.25rem",
        border: primary ? "none" : "1px solid #2A2A2A",
        cursor: "pointer",
        transition: "opacity 0.1s",
      }}
      onMouseEnter={e => ((e.target as HTMLElement).style.opacity = "0.85")}
      onMouseLeave={e => ((e.target as HTMLElement).style.opacity = "1")}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        background: "#000",
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
        <h1
          style={{
            fontSize: "clamp(4.5rem, 16vw, 10rem)",
            fontWeight: 800,
            lineHeight: 0.84,
            letterSpacing: "-0.04em",
            margin: "0 0 1rem",
          }}
        >
          BLOCK
          <br />
          <span style={{ color: RED }}>DROP</span>
        </h1>
        <p style={{ fontSize: "0.58rem", letterSpacing: "0.42em", color: "#2A2A2A", margin: 0 }}>
          DROP BLOCKS · DESTROY FRIENDS · NO MERCY
        </p>
      </div>

      {/* Idle: two CTAs */}
      {mode === "idle" && (
        <div style={{ display: "flex", gap: "0.75rem" }}>
          {btn("CREATE ROOM", () => setMode("create"), true)}
          {btn("JOIN ROOM", () => setMode("join"))}
        </div>
      )}

      {/* Create: show generated code */}
      {mode === "create" && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.47rem", letterSpacing: "0.3em", color: "#444", marginBottom: "0.75rem" }}>
            YOUR ROOM CODE
          </div>
          <div
            style={{
              fontSize: "2.2rem",
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: RED,
              border: `1px solid ${RED}`,
              padding: "0.65rem 2rem",
              marginBottom: "0.75rem",
            }}
          >
            {createdCode}
          </div>
          <div style={{ fontSize: "0.44rem", color: "#333", letterSpacing: "0.2em", marginBottom: "2rem" }}>
            SHARE WITH YOUR OPPONENT BEFORE STARTING
          </div>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            {btn("START GAME →", () => onStart(createdCode), true)}
            {btn("← BACK", () => setMode("idle"))}
          </div>
        </div>
      )}

      {/* Join: code input */}
      {mode === "join" && (
        <div style={{ textAlign: "center", width: "100%", maxWidth: 340 }}>
          <div style={{ fontSize: "0.47rem", letterSpacing: "0.3em", color: "#444", marginBottom: "0.75rem" }}>
            ENTER ROOM CODE
          </div>
          <input
            type="text"
            value={joinCode}
            onChange={e => { setJoinCode(e.target.value.toUpperCase()); setError(""); }}
            onKeyDown={e => {
              if (e.key === "Enter") {
                const code = joinCode.trim();
                if (code.length < 4) { setError("ENTER A VALID ROOM CODE"); return; }
                onStart(code);
              }
            }}
            placeholder="XXXX-XXXX"
            maxLength={9}
            autoFocus
            style={{
              background: "#000",
              color: "#fff",
              fontFamily: FONT,
              fontSize: "1.5rem",
              fontWeight: 700,
              letterSpacing: "0.2em",
              padding: "0.75rem 1rem",
              border: "1px solid #333",
              outline: "none",
              width: "100%",
              textAlign: "center",
              marginBottom: "0.5rem",
            }}
          />
          {error && (
            <div style={{ fontSize: "0.44rem", color: RED, letterSpacing: "0.2em", marginBottom: "0.75rem" }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
            {btn(
              "JOIN →",
              () => {
                const code = joinCode.trim();
                if (code.length < 4) { setError("ENTER A VALID ROOM CODE"); return; }
                onStart(code);
              },
              true
            )}
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
          color: "#1A1A1A",
          letterSpacing: "0.2em",
          textAlign: "center",
        }}
      >
        ← → MOVE · ↑ ROTATE · ↓ SOFT DROP · SPACE HARD DROP · P PAUSE
      </div>
    </div>
  );
}
