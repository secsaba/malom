/**
 * The game session: one game of malom, and the only thing the interface talks
 * to. It takes intents — what the player tried to do — and exposes the state
 * they can see. The engine sits behind it as an internal.
 *
 * It is pure TypeScript over plain data, like the engine (ADR-0002): it returns
 * the phase and the pending capture as values, and `src/ui` words them in
 * Hungarian.
 */

import type { PointId } from "../engine/board";
import {
  EMPTY_POSITION,
  type Position,
  SIDES,
  type Side,
  capturableFrom,
  emptyPoints,
  millsThrough,
  opponentOf,
  withPiece,
  withoutPiece,
} from "../engine/position";

/** The stage the game is in. */
export type Phase = "placing" | "moving";

/** What a player tried to do. */
export type Intent =
  | { readonly type: "place"; readonly point: PointId }
  | { readonly type: "capture"; readonly point: PointId };

/** What the session records as the game is played. */
type Recorded = {
  readonly position: Position;
  readonly sideToMove: Side;
  readonly phase: Phase;
  readonly piecesInHand: Readonly<Record<Side, number>>;
  /** Whether the side to move owes a capture before the move is over. */
  readonly pendingCapture: boolean;
};

/** Everything a player can see about the game: what is recorded, and what follows from it. */
export type GameState = Recorded & {
  /**
   * The points the side to move may act on: the pieces it may capture while one
   * is owed, and otherwise the points it may place on.
   */
  readonly legalPoints: readonly PointId[];
};

/** How many pieces each side starts with in hand. */
const PIECES_PER_SIDE = 9;

const legalPointsOf = (game: Recorded): readonly PointId[] => {
  if (game.pendingCapture) return capturableFrom(game.position, opponentOf(game.sideToMove));
  if (game.phase === "placing") return emptyPoints(game.position);
  return []; // the moving phase arrives with #4
};

// Spelled out rather than spread, so that a state built from an earlier one
// cannot smuggle a stale set of legal points through with it.
const stateOf = (game: Recorded): GameState => ({
  position: game.position,
  sideToMove: game.sideToMove,
  phase: game.phase,
  piecesInHand: game.piecesInHand,
  pendingCapture: game.pendingCapture,
  legalPoints: legalPointsOf(game),
});

const NEW_GAME = stateOf({
  position: EMPTY_POSITION,
  sideToMove: "light",
  phase: "placing",
  piecesInHand: { light: PIECES_PER_SIDE, dark: PIECES_PER_SIDE },
  pendingCapture: false,
});

/**
 * The move — the placement and the capture it may have earned — is over, so the
 * opponent comes to play.
 *
 * A completed move is where the placing phase can end: it lasts until both hands
 * are empty, so the last placement of the game keeps the phase until the capture
 * it earned has been taken.
 */
const withMoveComplete = (game: Recorded): Recorded => {
  const handsEmpty = SIDES.every((side) => game.piecesInHand[side] === 0);

  return {
    ...game,
    sideToMove: opponentOf(game.sideToMove),
    phase: game.phase === "placing" && handsEmpty ? "moving" : game.phase,
    pendingCapture: false,
  };
};

const afterPlacing = (state: GameState, point: PointId): Recorded => {
  const { sideToMove } = state;
  const position = withPiece(state.position, point, sideToMove);
  const placed: Recorded = {
    ...state,
    position,
    piecesInHand: { ...state.piecesInHand, [sideToMove]: state.piecesInHand[sideToMove] - 1 },
  };

  // A placement closing two mills still earns one capture: the debt is owed, not counted.
  return millsThrough(position, point, sideToMove).length > 0
    ? { ...placed, pendingCapture: true }
    : withMoveComplete(placed);
};

const afterCapturing = (state: GameState, point: PointId): Recorded =>
  withMoveComplete({ ...state, position: withoutPiece(state.position, point) });

/**
 * The state an intent leads to, or the state itself when the intent is not a
 * legal one — an illegal intent is ignored rather than refused, so the
 * interface can offer a tap on any point and let the rules decide.
 */
const nextState = (state: GameState, intent: Intent): GameState => {
  const owed = state.pendingCapture;
  if (intent.type === "place" && owed) return state;
  if (intent.type === "capture" && !owed) return state;
  if (!state.legalPoints.includes(intent.point)) return state;

  return stateOf(
    intent.type === "place"
      ? afterPlacing(state, intent.point)
      : afterCapturing(state, intent.point),
  );
};

export type GameSession = {
  readonly state: GameState;
  /** Play an intent. An illegal one leaves the state exactly as it was. */
  readonly apply: (intent: Intent) => void;
  /** Watch for state changes. Returns the function that stops watching. */
  readonly subscribe: (listener: () => void) => () => void;
};

/** Start a game. */
export const createGameSession = (): GameSession => {
  let state = NEW_GAME;
  const listeners = new Set<() => void>();

  return {
    get state() {
      return state;
    },

    apply: (intent) => {
      const next = nextState(state, intent);
      if (next === state) return;

      state = next;
      for (const listener of listeners) listener();
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
