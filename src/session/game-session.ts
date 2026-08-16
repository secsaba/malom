/**
 * The game session: one game of malom, and the only thing the interface talks
 * to. It takes intents — what the player tried to do — and exposes the state
 * they can see. The engine sits behind it as an internal.
 *
 * It is pure TypeScript over plain data, like the engine (ADR-0002): it returns
 * the phase, the pending capture and the result as values, and `src/ui` words
 * them in Hungarian.
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
  pointsHeldBy,
  slidesFrom,
  withPiece,
  withoutPiece,
} from "../engine/position";

/**
 * The stage the game is in, as the side to move plays it: flying is one player's
 * state rather than the whole game's, so the two sides can be in different ones.
 */
export type Phase = "placing" | "moving" | "flying";

/** What ended a game: the loser was reduced to two pieces, or left with no legal move. */
export type Ending = "reduced" | "blocked";

/** How a game ended. */
export type Result = { readonly winner: Side; readonly ending: Ending };

/**
 * What a player tried to do. The spec sketches the facade's intents as place,
 * move and capture; selecting is the fourth, because picking a piece up is a
 * step a player can take back — tapping away puts it down again without moving
 * — and that is a rule rather than a detail of any one interface.
 */
export type Intent =
  | { readonly type: "place"; readonly point: PointId }
  | { readonly type: "select"; readonly point: PointId }
  /** Where the selected piece is to go. */
  | { readonly type: "move"; readonly point: PointId }
  | { readonly type: "capture"; readonly point: PointId };

/** What the session records as the game is played. */
type Recorded = {
  readonly position: Position;
  readonly sideToMove: Side;
  /** Whether pieces are still being put onto the board. */
  readonly placing: boolean;
  readonly piecesInHand: Readonly<Record<Side, number>>;
  /** Whether the side to move owes a capture before the move is over. */
  readonly pendingCapture: boolean;
  /** The piece the side to move has picked up, if it has picked one up. */
  readonly selection: PointId | undefined;
  /** How the game ended, once it has. */
  readonly result: Result | undefined;
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

/** How many pieces each side starts with in hand. */
const PIECES_PER_SIDE = 9;

/** How few pieces a side is left with when it starts to fly, and when it has lost. */
const PIECES_TO_FLY = 3;
const PIECES_TO_LOSE = 2;

const phaseOf = (game: Recorded): Phase => {
  if (game.placing) return "placing";

  return pointsHeldBy(game.position, game.sideToMove).length === PIECES_TO_FLY
    ? "flying"
    : "moving";
};

/** Where a piece of the side to move may go: anywhere empty while it flies, next door otherwise. */
const destinationsFrom = (game: Recorded, from: PointId): readonly PointId[] =>
  phaseOf(game) === "flying" ? emptyPoints(game.position) : slidesFrom(game.position, from);

/** The pieces of the side to move that have somewhere to go. */
const movablePoints = (game: Recorded): readonly PointId[] =>
  pointsHeldBy(game.position, game.sideToMove).filter(
    (point) => destinationsFrom(game, point).length > 0,
  );

const legalPointsOf = (game: Recorded): readonly PointId[] => {
  if (game.result) return [];
  if (game.pendingCapture) return capturableFrom(game.position, opponentOf(game.sideToMove));
  if (game.placing) return emptyPoints(game.position);
  if (game.selection) return destinationsFrom(game, game.selection);
  return movablePoints(game);
};

// What the players see is spelled out rather than spread from what is recorded,
// so that a state built from an earlier one cannot smuggle a stale set of legal
// points through with it.
const stateOf = (game: Recorded): GameState => ({
  position: game.position,
  sideToMove: game.sideToMove,
  phase: phaseOf(game),
  piecesInHand: game.piecesInHand,
  pendingCapture: game.pendingCapture,
  selection: game.selection,
  result: game.result,
  legalPoints: legalPointsOf(game),
});

const NEW_GAME: Recorded = {
  position: EMPTY_POSITION,
  sideToMove: "light",
  placing: true,
  piecesInHand: { light: PIECES_PER_SIDE, dark: PIECES_PER_SIDE },
  pendingCapture: false,
  selection: undefined,
  result: undefined,
};

/**
 * What has become of the side about to play: nothing, or the loss it cannot
 * play its way out of. Neither loss can arrive while pieces are still being
 * placed — a side that has not placed all nine is never down to two on the
 * board, and there is always somewhere to place.
 */
const endingAgainst = (game: Recorded): Ending | undefined => {
  if (game.placing) return undefined;
  if (pointsHeldBy(game.position, game.sideToMove).length <= PIECES_TO_LOSE) return "reduced";

  // A side down to three flies, and the board it flies over always has an empty
  // point, so only a side with more pieces than that can be shut in.
  return movablePoints(game).length === 0 ? "blocked" : undefined;
};

/**
 * The move — the placement or the move proper, and the capture it may have
 * earned — is over, so the opponent comes to play, unless what it comes to is a
 * game it has already lost.
 *
 * A completed move is where the placing phase can end: it lasts until both hands
 * are empty, so the last placement of the game keeps the phase until the capture
 * it earned has been taken.
 */
const withMoveComplete = (game: Recorded): Recorded => {
  const handsEmpty = SIDES.every((side) => game.piecesInHand[side] === 0);
  const handedOver: Recorded = {
    ...game,
    sideToMove: opponentOf(game.sideToMove),
    placing: game.placing && !handsEmpty,
    pendingCapture: false,
  };

  const ending = endingAgainst(handedOver);

  return ending === undefined
    ? handedOver
    : { ...handedOver, result: { winner: opponentOf(handedOver.sideToMove), ending } };
};

/**
 * A piece has arrived on a point — put there or moved there — so the mill it may
 * have closed decides whether the move is over or a capture is owed.
 */
const afterArriving = (game: Recorded, position: Position, at: PointId): Recorded => {
  const arrived: Recorded = { ...game, position, selection: undefined };

  // A move closing two mills still earns one capture: the debt is owed, not counted.
  return millsThrough(position, at, game.sideToMove).length > 0
    ? { ...arrived, pendingCapture: true }
    : withMoveComplete(arrived);
};

const afterPlacing = (game: Recorded, point: PointId): Recorded => {
  const { sideToMove } = game;

  return afterArriving(
    {
      ...game,
      piecesInHand: { ...game.piecesInHand, [sideToMove]: game.piecesInHand[sideToMove] - 1 },
    },
    withPiece(game.position, point, sideToMove),
    point,
  );
};

const afterMoving = (game: Recorded, from: PointId, to: PointId): Recorded =>
  afterArriving(game, withPiece(withoutPiece(game.position, from), to, game.sideToMove), to);

const afterCapturing = (game: Recorded, point: PointId): Recorded =>
  withMoveComplete({ ...game, position: withoutPiece(game.position, point) });

/**
 * Picking a piece up, or putting the one already picked up back down: only a
 * piece of the side to move that has somewhere to go is picked up, and tapping
 * anywhere else — the piece itself included — is how a player changes their
 * mind. Nothing is picked up while pieces are still being placed.
 */
const afterSelecting = (game: Recorded, point: PointId): Recorded => {
  if (game.placing) return game;

  const picked =
    point !== game.selection && movablePoints(game).includes(point) ? point : undefined;

  return picked === game.selection ? game : { ...game, selection: picked };
};

/**
 * The game an intent leads to, or the game itself when the intent is not a
 * legal one — an illegal intent is ignored rather than refused, so the
 * interface can offer a tap on any point and let the rules decide.
 */
const nextGame = (game: Recorded, intent: Intent): Recorded => {
  if (game.result) return game; // a finished game answers nothing

  // While a capture is owed it is the only thing that can be played, and there
  // is nothing to capture at any other time.
  if (intent.type === "capture" ? !game.pendingCapture : game.pendingCapture) return game;

  // Picking up is the one intent a point outside the legal ones still answers:
  // tapping away from the selected piece is what puts it down again.
  if (intent.type === "select") return afterSelecting(game, intent.point);

  if (!legalPointsOf(game).includes(intent.point)) return game;

  switch (intent.type) {
    case "place":
      return afterPlacing(game, intent.point);
    case "move":
      // Nothing is on its way anywhere until a piece has been picked up.
      return game.selection ? afterMoving(game, game.selection, intent.point) : game;
    case "capture":
      return afterCapturing(game, intent.point);
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
  let game = NEW_GAME;
  let state = stateOf(game);
  const listeners = new Set<() => void>();

  return {
    get state() {
      return state;
    },

    apply: (intent) => {
      const next = nextGame(game, intent);
      if (next === game) return;

      game = next;
      state = stateOf(game);
      for (const listener of listeners) listener();
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
