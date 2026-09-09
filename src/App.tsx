import { useState } from "react";
import Lobby from "./Lobby";
import Game from "./Game";

type Session = { roomCode: string; playerName: string };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  if (session) {
    return (
      <Game
        roomCode={session.roomCode}
        playerName={session.playerName}
        onExit={() => setSession(null)}
      />
    );
  }

  return (
    <Lobby onStart={(roomCode, playerName) => setSession({ roomCode, playerName })} />
  );
}
