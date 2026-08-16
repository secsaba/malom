import { useState } from "react";

import { strings } from "../strings";
import { Board } from "./Board";

export const App = () => {
  const [showCoordinates, setShowCoordinates] = useState(false);

  return (
    <main className="app">
      <header className="app__header">
        <h1>{strings.app.title}</h1>
      </header>

      <Board showCoordinates={showCoordinates} />

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
