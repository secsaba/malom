/**
 * The bridge between React and the game session: one game per mounted app,
 * re-rendering whenever an intent changes the state.
 *
 * The session is the store; React only subscribes to it. Nothing about the
 * rules lives here — and nothing about the search either: the session is handed
 * an opponent that thinks in a Web Worker, and what it does with it is its own
 * business.
 */

import { useState, useSyncExternalStore } from "react";

import { createWorkerOpponent } from "../opponent/worker-opponent";
import {
  type Difficulty,
  type GameState,
  type Intent,
  type Players,
  createGameSession,
} from "../session/game-session";

export type UseGameSession = {
  readonly state: GameState;
  readonly apply: (intent: Intent) => void;
  /** Throw the game away and start another one, played by whoever is given. */
  readonly start: (players: Players) => void;
  /** Change how strongly the computer plays, without disturbing the game in progress. */
  readonly playAt: (difficulty: Difficulty) => void;
};

export const useGameSession = (): UseGameSession => {
  const [session] = useState(() => createGameSession({ chooseMove: createWorkerOpponent() }));
  const state = useSyncExternalStore(session.subscribe, () => session.state);

  return { state, apply: session.apply, start: session.start, playAt: session.playAt };
};
