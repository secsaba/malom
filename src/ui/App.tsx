import { useState } from "react";

import type { PointId } from "../engine/board";
import { type Side, opponentOf } from "../engine/position";
import type { GameState, Intent, Players } from "../session/game-session";
import { strings } from "../strings";
import { BlunderWarning } from "./BlunderWarning";
import { Board } from "./Board";
import { DifficultyChoice } from "./DifficultyChoice";
import { MoveList } from "./MoveList";
import { Panel } from "./Panel";
import { FIRST_GAME, type NextGame, Setup } from "./Setup";
import { Status } from "./Status";
import { Summary } from "./Summary";
import { Teaching } from "./Teaching";
import { remember, rememberedSettings } from "./storage";
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
const playersOf = ({ against, humanSide }: NextGame): Players =>
  against === "computer" ? { opponentSide: opponentOf(humanSide) } : {};

/**
 * What the setup panel starts on: whatever the game in front of the player is.
 * A game read back out of storage would otherwise be sat under a panel saying
 * the next game is a hotseat one, which reads as though the reload had thrown
 * the computer opponent away.
 */
const setupFor = (opponentSide: Side | undefined): NextGame =>
  opponentSide === undefined
    ? FIRST_GAME
    : { against: "computer", humanSide: opponentOf(opponentSide) };

export const App = () => {
  const {
    state,
    apply,
    start,
    playAt,
    teach,
    askForHint,
    takeBack,
    review,
    stopReviewing,
    warnOfBlunders,
    playAnyway,
    thinkAgain,
  } = useGameSession();
  const [showCoordinates, setShowCoordinates] = useState(() => rememberedSettings().showCoordinates);
  const [next, setNext] = useState<NextGame>(() => setupFor(state.opponentSide));
  // Folded away until the player asks for it, so that a phone opens on the board
  // and nothing else. On a screen with room for two columns the stylesheet shows
  // the panel whatever this says.
  const [panelExpanded, setPanelExpanded] = useState(false);

  const select = (point: PointId) => apply(intentFor(state, point));

  // The board's own setting rather than the game's, so it is the interface that
  // writes it down; everything the session holds is written down by the session's
  // own hook.
  const chooseCoordinates = (show: boolean) => {
    setShowCoordinates(show);
    remember({ showCoordinates: show });
  };

  const startGame = (chosen: NextGame) => {
    setNext(chosen);
    start(playersOf(chosen));
  };

  // A rematch is offered once a game against the computer is over, and the
  // player takes the side the computer has just played — which is the whole
  // point of one: the opening is a different game from each side of it.
  const rematchSide: Side | undefined = state.result && state.opponentSide;

  // A draw against the computer at full strength is the result a learner is
  // playing for, and the summary says so rather than wording it as a defeat.
  const againstMaster = state.opponentSide !== undefined && state.difficulty === "master";

  return (
    <main className="app">
      <div className="app__play">
        <header className="app__header">
          <h1>{strings.app.title}</h1>
        </header>

        <div className="app__board">
          <Board
            position={state.position}
            legalPoints={state.legalPoints}
            selection={state.selection}
            arrival={state.lastArrival}
            hint={state.hint}
            showCoordinates={showCoordinates}
            onSelect={select}
          />
        </div>

        <Status game={state} />

        <BlunderWarning
          teaching={state.teaching}
          checking={state.checking}
          warned={state.warned}
          onPlayAnyway={playAnyway}
          onThinkAgain={thinkAgain}
        />
      </div>

      <Panel expanded={panelExpanded} onExpand={setPanelExpanded}>
        <Teaching
          teaching={state.teaching}
          hintOffered={state.hintOffered}
          hinting={state.hinting}
          takebackOffered={state.takebackOffered}
          warnsOfBlunders={state.warnsOfBlunders}
          grade={state.grade}
          reason={state.reason}
          onTeach={teach}
          onAskForHint={askForHint}
          onTakeBack={takeBack}
          onWarnOfBlunders={warnOfBlunders}
        />

        {state.teaching && state.summary.length > 0 && (
          <Summary summary={state.summary} againstMaster={againstMaster} />
        )}

        {state.teaching && state.moves.length > 0 && (
          <MoveList
            moves={state.moves}
            reviewing={state.reviewing}
            onReview={review}
            onStopReviewing={stopReviewing}
          />
        )}

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

        <DifficultyChoice difficulty={state.difficulty} onChoose={playAt} />

        <Setup next={next} onChoose={setNext} onStart={() => startGame(next)} />

        <label className="app__toggle">
          <input
            type="checkbox"
            data-testid="coordinates-toggle"
            checked={showCoordinates}
            onChange={(event) => chooseCoordinates(event.target.checked)}
          />
          {strings.board.showCoordinates}
        </label>
      </Panel>
    </main>
  );
};
