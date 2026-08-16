import { useState } from "react";

import type { PointId } from "../engine/board";
import type { GameState, Intent } from "../session/game-session";
import { strings } from "../strings";
import { Board } from "./Board";
import { Status } from "./Status";
import { useGameSession } from "./useGameSession";

/**
 * What a tap means, read off the game state: a capture while one is owed, a
 * placement while pieces are still being placed, the destination of a piece
 * already picked up, and otherwise picking one up — or putting it down again,
 * which is what a tap away from its destinations comes to.
 *
 * Which of them is legal is the game session's business, not this one's: an
 * illegal intent is ignored, so every point can be offered as a target.
 */
const intentFor = (game: GameState, point: PointId): Intent => {
  if (game.pendingCapture) return { type: "capture", point };
  if (game.phase === "placing") return { type: "place", point };

  return game.selection && game.legalPoints.includes(point)
    ? { type: "move", point }
    : { type: "select", point };
};

export const App = () => {
  const [showCoordinates, setShowCoordinates] = useState(false);
  const { state, apply } = useGameSession();

  const select = (point: PointId) => apply(intentFor(state, point));

  return (
    <main className="app">
      <header className="app__header">
        <h1>{strings.app.title}</h1>
      </header>

      <Board
        position={state.position}
        legalPoints={state.legalPoints}
        selection={state.selection}
        showCoordinates={showCoordinates}
        onSelect={select}
      />

      <Status game={state} />

      <label className="app__toggle">
        <input
          type="checkbox"
          data-testid="coordinates-toggle"
          checked={showCoordinates}
          onChange={(event) => setShowCoordinates(event.target.checked)}
        />
        {strings.board.showCoordinates}
      </label>
    </main>
  );
};
