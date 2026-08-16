/**
 * The bridge between React and the game session: one game per mounted app,
 * re-rendering whenever an intent changes the state.
 *
 * The session is the store; React only subscribes to it. Nothing about the
 * rules lives here.
 */

import { useState, useSyncExternalStore } from "react";

import { type GameState, type Intent, createGameSession } from "../session/game-session";

export type UseGameSession = {
  readonly state: GameState;
  readonly apply: (intent: Intent) => void;
};

export const useGameSession = (): UseGameSession => {
  const [session] = useState(createGameSession);
  const state = useSyncExternalStore(session.subscribe, () => session.state);

  return { state, apply: session.apply };
};
