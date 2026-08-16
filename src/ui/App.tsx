import { useState } from "react";

import type { PointId } from "../engine/board";
import { type Side, opponentOf } from "../engine/position";
import type { GameState, Intent, Setup as GameSetup } from "../session/game-session";
import { strings } from "../strings";
import { Board } from "./Board";
import { FIRST_GAME, type NextGame, Setup } from "./Setup";
import { Status } from "./Status";
import { useGameSession } from "./useGameSession";

/**
 * What a tap means, read off the game state: a capture while one is owed, a
 * placement while pieces are still being placed, the destination of a piece
 * already picked up, and otherwise picking one up — or putting it down again,
 * which is what a tap away from its destinations comes to.
 *
 * Naming the gesture is all this does. Whether the named intent is legal is the
 * game session's business, and an illegal one is ignored, so every point of the
 * board can be offered as a target; the one thing read off `legalPoints` here is
 * whether a tap lands where the picked-up piece could go, which is what tells a
 * move from a change of mind.
 */
const intentFor = (game: GameState, point: PointId): Intent => {
  if (game.pendingCapture) return { type: "capture", point };
  if (game.phase === "placing") return { type: "place", point };

  return game.selection && game.legalPoints.includes(point)
    ? { type: "move", point }
    : { type: "select", point };
};

/** Who plays which side, as the game session takes it. */
const setupOf = ({ against, humanSide }: NextGame): GameSetup =>
  against === "computer" ? { opponentSide: opponentOf(humanSide) } : {};

export const App = () => {
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [next, setNext] = useState<NextGame>(FIRST_GAME);
  const { state, apply, start } = useGameSession();

  const select = (point: PointId) => apply(intentFor(state, point));

  const startGame = (chosen: NextGame) => {
    setNext(chosen);
    start(setupOf(chosen));
  };

  // A rematch is offered once a game against the computer is over, and the
  // player takes the side the computer has just played — which is the whole
  // point of one: the opening is a different game from each side of it.
  const rematchSide: Side | undefined = state.result && state.opponentSide;

  return (
    <main className="app">
      <header className="app__header">
        <h1>{strings.app.title}</h1>
      </header>

      <Board
        position={state.position}
        legalPoints={state.legalPoints}
        selection={state.selection}
        arrival={state.lastArrival}
        showCoordinates={showCoordinates}
        onSelect={select}
      />

      <Status game={state} />

      {rematchSide && (
        <button
          type="button"
          className="rematch"
          data-testid="rematch"
          onClick={() => startGame({ against: "computer", humanSide: rematchSide })}
        >
          {strings.setup.rematch}
        </button>
      )}

      <Setup next={next} onChoose={setNext} onStart={() => startGame(next)} />

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
