/**
 * The bridge between React and the game session: one game per mounted app,
 * re-rendering whenever an intent changes the state.
 *
 * The session is the store; React only subscribes to it. Nothing about the
 * rules lives here — and nothing about the search either: the session is handed
 * an opponent, an engine to ask for hints and an engine to grade moves, all of
 * which think in a Web Worker, and what it does with them is its own business.
 *
 * This is where the three are put together, because this is where the app is:
 * one thread, thought in by all of them. The computer's move, the player's hint
 * and the grade on the move they played are the same search asked different
 * questions — the opponent's weakened by the difficulty being played at, the
 * other two never (ADR-0001) — so a second worker would be a second copy of the
 * engine and nothing more.
 */

import { useState, useSyncExternalStore } from "react";

import { createOpponent } from "../opponent/opponent";
import { createSearchThread } from "../opponent/search-thread";
import {
  type Difficulty,
  type GameState,
  type Intent,
  type Players,
  createGameSession,
} from "../session/game-session";
import { createAssessor } from "../teaching/assessment";
import { createHint } from "../teaching/hint";

export type UseGameSession = {
  readonly state: GameState;
  readonly apply: (intent: Intent) => void;
  /** Throw the game away and start another one, played by whoever is given. */
  readonly start: (players: Players) => void;
  /** Change how strongly the computer plays, without disturbing the game in progress. */
  readonly playAt: (difficulty: Difficulty) => void;
  /** Switch teaching on or off, for this game and for the ones after it. */
  readonly teach: (on: boolean) => void;
  /** Ask the engine what it would play here. */
  readonly askForHint: () => void;
  /** Take the last move back, to the player's own decision point. */
  readonly takeBack: () => void;
  /** Ask to be warned before a blunder, or stop asking. */
  readonly warnOfBlunders: (on: boolean) => void;
  /** Play the move the warning asked about. */
  readonly playAnyway: () => void;
  /** Take that move off the table again. */
  readonly thinkAgain: () => void;
};

export const useGameSession = (): UseGameSession => {
  const [session] = useState(() => {
    const runSearch = createSearchThread();

    return createGameSession({
      chooseMove: createOpponent(runSearch),
      chooseHint: createHint(runSearch),
      assessMove: createAssessor(runSearch),
    });
  });
  const state = useSyncExternalStore(session.subscribe, () => session.state);

  return {
    state,
    apply: session.apply,
    start: session.start,
    playAt: session.playAt,
    teach: session.teach,
    askForHint: session.askForHint,
    takeBack: session.takeBack,
    warnOfBlunders: session.warnOfBlunders,
    playAnyway: session.playAnyway,
    thinkAgain: session.thinkAgain,
  };
};
