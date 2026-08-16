import { useState } from "react";

import type { PointId } from "../engine/board";
import { strings } from "../strings";
import { Board } from "./Board";
import { Status } from "./Status";
import { useGameSession } from "./useGameSession";

export const App = () => {
  const [showCoordinates, setShowCoordinates] = useState(false);
  const { state, apply } = useGameSession();

  // What a tap means is read off the game state: a capture while one is owed,
  // a placement otherwise. The session decides whether it was legal.
  const select = (point: PointId) =>
    apply({ type: state.pendingCapture ? "capture" : "place", point });

  return (
    <main className="app">
      <header className="app__header">
        <h1>{strings.app.title}</h1>
      </header>

      <Board
        position={state.position}
        legalPoints={state.legalPoints}
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
