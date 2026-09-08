import { useState } from "react";
import Lobby from "./Lobby";
import Game from "./Game";

type Screen = "lobby" | "game";

export default function App() {
  const [screen, setScreen] = useState<Screen>("lobby");
  const [roomCode, setRoomCode] = useState("");

  if (screen === "game") {
    return (
      <Game
        roomCode={roomCode}
        onExit={() => setScreen("lobby")}
      />
    );
  }

  return (
    <Lobby
      onStart={(code) => {
        setRoomCode(code);
        setScreen("game");
      }}
    />
  );
}
