/**
 * The game session: one game of malom, and the only thing the interface talks
 * to. It takes intents — what the player tried to do — and exposes the state
 * they can see. The engine sits behind it as an internal.
 *
 * The rules are not here. `src/engine/game` plays whole moves; this turns the
 * taps an interface deals in into them, and holds what a half-played move leaves
 * over: the piece picked up and not yet moved, and the capture owed by a mill
 * just closed.
 *
 * It is pure TypeScript over plain data, like the engine (ADR-0002): it returns
 * the phase, the pending capture and the result as values, and `src/ui` words
 * them in Hungarian.
 */

import type { PointId } from "../engine/board";
import {
  type Arrival,
  type Draw,
  type Game,
  NEW_GAME,
  type Phase,
  type Result,
  afterArrival,
  afterMove,
  phaseOf,
} from "../engine/game";
import {
  type Ending,
  type Position,
  type Side,
  destinationsFrom,
  emptyPoints,
  movablePointsOf,
} from "../engine/position";

export type { Draw, Ending, Phase, Result };

/**
 * What a player tried to do. The spec sketches the facade's intents as place,
 * move and capture; selecting is the fourth, because picking a piece up is a
 * step a player can take back — tapping away puts it down again without moving
 * — and that is a rule rather than a detail of any one interface.
 *
 * These are gestures, not the glossary's Move: a whole turn is the place or the
 * move and the capture it may earn, which the session assembles from two of
 * these intents.
 */
export type Intent =
  | { readonly type: "place"; readonly point: PointId }
  | { readonly type: "select"; readonly point: PointId }
  /** Where the selected piece is to go. */
  | { readonly type: "move"; readonly point: PointId }
  | { readonly type: "capture"; readonly point: PointId };

/** What the session records as the game is played. */
type Recorded = {
  /** The game as the rules have it, up to the last move played out in full. */
  readonly game: Game;
  /** The piece the side to move has picked up, if it has picked one up. */
  readonly selection: PointId | undefined;
  /** The half-played move: a piece has arrived, and the mill it closed owes a capture. */
  readonly arrival: Arrival | undefined;
};

/** Everything a player can see about the game: what is recorded, and what follows from it. */
export type GameState = {
  readonly position: Position;
  readonly sideToMove: Side;
  readonly phase: Phase;
  readonly piecesInHand: Readonly<Record<Side, number>>;
  readonly pendingCapture: boolean;
  readonly selection: PointId | undefined;
  readonly result: Result | undefined;
  /**
   * The points the side to move may act on: the pieces it may capture while one
   * is owed, the points it may place on, the points the selected piece may go
   * to, and otherwise the pieces it may pick up. Nothing, once the game is over.
   */
  readonly legalPoints: readonly PointId[];
};

const legalPointsOf = ({ game, selection, arrival }: Recorded): readonly PointId[] => {
  if (game.result) return [];
  if (arrival) return afterArrival(game, arrival).captures;
  if (game.placing) return emptyPoints(game.position);
  if (selection) return destinationsFrom(game.position, selection);
  return movablePointsOf(game.position, game.sideToMove);
};

// What the players see is spelled out rather than spread from what is recorded,
// so that a state built from an earlier one cannot smuggle a stale set of legal
// points through with it.
const stateOf = (recorded: Recorded): GameState => {
  const { game, selection, arrival } = recorded;
  // A piece that has arrived is on the board and out of its hand from the moment
  // it lands, so what the players see mid-move is the arrival, not the game the
  // capture it owes will complete.
  const arrived = arrival && afterArrival(game, arrival);

  return {
    position: arrived?.position ?? game.position,
    sideToMove: game.sideToMove,
    phase: phaseOf(game),
    piecesInHand: arrived?.piecesInHand ?? game.piecesInHand,
    pendingCapture: arrived !== undefined,
    selection,
    result: game.result,
    legalPoints: legalPointsOf(recorded),
  };
};

const NEW_SESSION: Recorded = { game: NEW_GAME, selection: undefined, arrival: undefined };

/**
 * A piece has arrived on a point — put there or moved there — so the mill it may
 * have closed decides whether the move is over or a capture is owed.
 */
const afterArriving = ({ game }: Recorded, arrival: Arrival): Recorded =>
  // A move closing two mills still earns one capture: the debt is owed, not counted.
  afterArrival(game, arrival).captures.length > 0
    ? { game, selection: undefined, arrival }
    : { game: afterMove(game, arrival), selection: undefined, arrival: undefined };

/** The capture the arrival owed has been taken, so the move is played out in full. */
const afterCapturing = (game: Game, arrival: Arrival, point: PointId): Recorded => ({
  game: afterMove(game, { ...arrival, capture: point }),
  selection: undefined,
  arrival: undefined,
});

/**
 * Picking a piece up, or putting the one already picked up back down: only a
 * piece of the side to move that has somewhere to go is picked up, and tapping
 * anywhere else — the piece itself included — is how a player changes their
 * mind. Nothing is picked up while pieces are still being placed.
 */
const afterSelecting = (recorded: Recorded, point: PointId): Recorded => {
  const { game, selection } = recorded;
  if (game.placing) return recorded;

  const picked =
    point !== selection && movablePointsOf(game.position, game.sideToMove).includes(point)
      ? point
      : undefined;

  return picked === selection ? recorded : { ...recorded, selection: picked };
};

/**
 * The game an intent leads to, or the game itself when the intent is not a
 * legal one — an illegal intent is ignored rather than refused, so the
 * interface can offer a tap on any point and let the rules decide.
 */
const nextRecorded = (recorded: Recorded, intent: Intent): Recorded => {
  const { game, selection, arrival } = recorded;
  if (game.result) return recorded; // a finished game answers nothing

  // While a capture is owed it is the only thing that can be played, and there
  // is nothing to capture at any other time.
  if (intent.type === "capture" ? arrival === undefined : arrival !== undefined) return recorded;

  // Picking up is the one intent a point outside the legal ones still answers:
  // tapping away from the selected piece is what puts it down again.
  if (intent.type === "select") return afterSelecting(recorded, intent.point);

  if (!legalPointsOf(recorded).includes(intent.point)) return recorded;

  switch (intent.type) {
    case "place":
      return afterArriving(recorded, { to: intent.point });
    case "move":
      // Nothing is on its way anywhere until a piece has been picked up.
      return selection ? afterArriving(recorded, { from: selection, to: intent.point }) : recorded;
    case "capture":
      // The guard above has already established that a capture is owed, which is
      // to say that a piece has arrived and is waiting on it.
      return arrival ? afterCapturing(game, arrival, intent.point) : recorded;
  }
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
  let recorded = NEW_SESSION;
  let state = stateOf(recorded);
  const listeners = new Set<() => void>();

  return {
    get state() {
      return state;
    },

    apply: (intent) => {
      const next = nextRecorded(recorded, intent);
      if (next === recorded) return;

      recorded = next;
      state = stateOf(recorded);
      for (const listener of listeners) listener();
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
