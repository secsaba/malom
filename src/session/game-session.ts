/**
 * The game session: one game of malom, and the only thing the interface talks
 * to. It takes intents — what the player tried to do — and exposes the state
 * they can see. The engine sits behind it as an internal.
 *
 * It is pure TypeScript over plain data, like the engine (ADR-0002): it returns
 * the phase, the pending capture and the result as values, and `src/ui` words
 * them in Hungarian.
 */

import { type PointId, POINTS } from "../engine/board";
import {
  EMPTY_POSITION,
  type Ending,
  type Position,
  SIDES,
  type Side,
  capturableFrom,
  destinationsFrom,
  emptyPoints,
  endingAgainst,
  flies,
  millsThrough,
  movablePointsOf,
  opponentOf,
  withPiece,
  withoutPiece,
} from "../engine/position";

/**
 * The stage the game is in, as the side to move plays it: flying is one player's
 * state rather than the whole game's, so the two sides can be in different ones.
 */
export type Phase = "placing" | "moving" | "flying";

/**
 * What drew a game neither side could win: the same position for the third time,
 * or fifty moves by each player without a capture.
 */
export type Draw = "repetition" | "fifty-move";

/** How a game ended: who won and what ended it, or what drew it. */
export type Result = { readonly winner: Side; readonly ending: Ending } | { readonly draw: Draw };

export type { Ending };

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
  readonly position: Position;
  readonly sideToMove: Side;
  /** Whether pieces are still being put onto the board. */
  readonly placing: boolean;
  readonly piecesInHand: Readonly<Record<Side, number>>;
  /** Whether the side to move owes a capture before the move is over. */
  readonly pendingCapture: boolean;
  /** The piece the side to move has picked up, if it has picked one up. */
  readonly selection: PointId | undefined;
  /** How often each position the game has stood in has come up, the third time drawing it. */
  readonly positionsSeen: ReadonlyMap<string, number>;
  /** Quiet moves played: those since the last capture, or since the last placement. */
  readonly quietMoves: number;
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

/** How often a position may come up before the game is drawn. */
const REPETITIONS_TO_DRAW = 3;

/**
 * How many moves without a capture draw the game — fifty by each player, a move
 * being one player's turn.
 */
const QUIET_MOVES_TO_DRAW = 100;

const phaseOf = (game: Recorded): Phase => {
  if (game.placing) return "placing";
  return flies(game.position, game.sideToMove) ? "flying" : "moving";
};

/**
 * What makes two positions the same one for the repetition rule: the pieces, the
 * side to move, the phase, and what is still in hand. Boards that look alike but
 * offer different moves are different positions, so all four go into the name.
 */
const identityOf = (game: Recorded): string =>
  [
    POINTS.map((point) => game.position.get(point) ?? "-").join("/"),
    game.sideToMove,
    phaseOf(game),
    SIDES.map((side) => game.piecesInHand[side]).join("/"),
  ].join(" ");

/**
 * What has drawn the game, if anything: the position the side to move is faced
 * with having come up for the third time, or fifty moves by each player without
 * a capture. A game that has been won is never asked.
 */
const drawnBy = (game: Recorded, timesSeen: number): Draw | undefined => {
  if (timesSeen >= REPETITIONS_TO_DRAW) return "repetition";

  return game.quietMoves >= QUIET_MOVES_TO_DRAW ? "fifty-move" : undefined;
};

const legalPointsOf = (game: Recorded): readonly PointId[] => {
  if (game.result) return [];
  if (game.pendingCapture) return capturableFrom(game.position, opponentOf(game.sideToMove));
  if (game.placing) return emptyPoints(game.position);
  if (game.selection) return destinationsFrom(game.position, game.selection);
  return movablePointsOf(game.position, game.sideToMove);
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
  // Positions are counted as each move completes, and the empty board a game
  // starts on is the one position it can never come back to.
  positionsSeen: new Map(),
  quietMoves: 0,
  result: undefined,
};

/**
 * The move — the placement or the move proper, and the capture it may have
 * earned — is over, so the opponent comes to play, unless what it comes to is a
 * game it has already lost, or one neither side can win any more.
 *
 * A completed move is where the placing phase can end: it lasts until both hands
 * are empty, so the last placement of the game keeps the phase until the capture
 * it earned has been taken.
 *
 * It is also where the two draw conditions are counted, so what they count is
 * whole moves rather than the halves of one a pending capture divides it into.
 * A placement is progress in the way a capture is — a hand it comes out of is a
 * hand that will empty — so it starts the count of quiet moves again as well,
 * and the fifty each side is given are fifty of the moving phase's own.
 */
const withMoveComplete = (
  game: Recorded,
  { captured }: { readonly captured: boolean },
): Recorded => {
  const handsEmpty = SIDES.every((side) => game.piecesInHand[side] === 0);
  const handedOver: Recorded = {
    ...game,
    sideToMove: opponentOf(game.sideToMove),
    placing: game.placing && !handsEmpty,
    pendingCapture: false,
    quietMoves: captured || game.placing ? 0 : game.quietMoves + 1,
  };

  const identity = identityOf(handedOver);
  const timesSeen = (handedOver.positionsSeen.get(identity) ?? 0) + 1;
  const counted: Recorded = {
    ...handedOver,
    positionsSeen: new Map(handedOver.positionsSeen).set(identity, timesSeen),
  };

  // A side still holding pieces has them to put down, however few of them are
  // on the board, so only a side past the placing phase can have lost.
  const ending = counted.placing
    ? undefined
    : endingAgainst(counted.position, counted.sideToMove);

  if (ending !== undefined) {
    return { ...counted, result: { winner: opponentOf(counted.sideToMove), ending } };
  }

  // A win is a win: a game that ends on its hundredth quiet move, or on a
  // position seen three times, has still been won if the side to move has lost.
  const draw = drawnBy(counted, timesSeen);

  return draw === undefined ? counted : { ...counted, result: { draw } };
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
    : withMoveComplete(arrived, { captured: false });
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
  withMoveComplete({ ...game, position: withoutPiece(game.position, point) }, { captured: true });

/**
 * Picking a piece up, or putting the one already picked up back down: only a
 * piece of the side to move that has somewhere to go is picked up, and tapping
 * anywhere else — the piece itself included — is how a player changes their
 * mind. Nothing is picked up while pieces are still being placed.
 */
const afterSelecting = (game: Recorded, point: PointId): Recorded => {
  if (game.placing) return game;

  const picked =
    point !== game.selection && movablePointsOf(game.position, game.sideToMove).includes(point)
      ? point
      : undefined;

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
