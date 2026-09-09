import { useReducer, useEffect, useRef } from "react";
import * as T from "./tetris";
import { init, reducer, type State } from "./gameReducer";
export type { Status } from "./gameReducer";

type Options = {
  /** Called when this player earns garbage rows to send to the opponent. */
  onAttack?: (rows: number) => void;
};

export function useGame({ onAttack }: Options = {}) {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  // Keep the latest callback without re-running the flush effect on every
  // render of the parent.
  const attackRef = useRef(onAttack);
  attackRef.current = onAttack;

  // Hand earned attack rows to the network layer, then clear the outbox.
  useEffect(() => {
    if (state.outbox === 0) return;
    attackRef.current?.(state.outbox);
    dispatch({ type: "FLUSH_OUTBOX" });
  }, [state.outbox]);

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
    receiveGarbage: (rows: number) => dispatch({ type: "GARBAGE", rows }),
  };
}
