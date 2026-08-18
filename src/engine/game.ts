/**
 * A game of malom as the rules see it: where the pieces stand, whose turn it is,
 * what is still in hand, the moves that can be played from there, and the result
 * they arrive at.
 *
 * Where `position.ts` answers questions about a board, this plays a whole game
 * over one. It is what the search walks and what the session hands the
 * interface's intents to, so the move the computer chooses and the move a player
 * taps out go through the same rules rather than through two copies of them.
 *
 * A game is plain data and is never mutated: {@link afterMove} returns the next
 * one, so a search can branch a position without copying defensively.
 *
 * The draw conditions live here rather than in `position.ts` because neither
 * repetition nor the fifty-move count is a question a single position can
 * answer. Both belong to a game going by, which is what a `Game` is.
 */

import { type Line, POINTS, type PointId, neighboursOf } from "./board";
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
  millsOf,
  millsThrough,
  movablePointsOf,
  opponentOf,
  slidesFrom,
  withPiece,
  withoutPiece,
} from "./position";

/**
 * The three stages, in the order a game passes through them. Flying is one
 * player's state rather than the whole game's, so the two sides can be in
 * different ones.
 */
export const PHASES = ["placing", "moving", "flying"] as const;

/** The stage the game is in, as the side to move plays it. */
export type Phase = (typeof PHASES)[number];

/**
 * What drew a game neither side could win: the same position for the third time,
 * or fifty moves by each player without a capture.
 */
export type Draw = "repetition" | "fifty-move";

/** How a game ended: who won and what ended it, or what drew it. */
export type Result = { readonly winner: Side; readonly ending: Ending } | { readonly draw: Draw };

/**
 * Where a move's piece comes from and where it goes — the move without the
 * capture it may earn. A piece coming out of a hand comes from nowhere.
 */
export type Arrival = {
  readonly from?: PointId | undefined;
  readonly to: PointId;
};

/**
 * One player's complete turn: the placement or the slide, and the capture the
 * mill it closed earned. A move that closes two mills still carries one capture.
 */
export type Move = Arrival & { readonly capture?: PointId | undefined };

/**
 * The stretch of quiet moves the game is in: the positions it has stood in since
 * its last capture or placement, most recent first, and how many moves back that
 * runs.
 *
 * Nothing from before that point can come round again — a piece taken off the
 * board and a piece taken out of a hand are changes no move puts back, so two
 * identical positions can have neither between them. A stretch is therefore all
 * the repetition rule ever needs to see, and its length is exactly what the
 * fifty-move rule counts.
 */
export type QuietStretch = {
  readonly identity: string;
  /** Moves played since the last capture or placement — nought at the position one left. */
  readonly quietMoves: number;
  readonly earlier: QuietStretch | undefined;
};

/** A game of malom, part-played. */
export type Game = {
  readonly position: Position;
  readonly sideToMove: Side;
  /** Whether pieces are still being put onto the board. */
  readonly placing: boolean;
  readonly piecesInHand: Readonly<Record<Side, number>>;
  /** The quiet moves the game is in the middle of, or none yet. */
  readonly quietStretch: QuietStretch | undefined;
  /** How the game ended, once it has. */
  readonly result: Result | undefined;
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

/** A game nobody has played a move in yet. Light places first. */
export const NEW_GAME: Game = {
  position: EMPTY_POSITION,
  sideToMove: "light",
  placing: true,
  piecesInHand: { light: PIECES_PER_SIDE, dark: PIECES_PER_SIDE },
  // The empty board a game starts on is the one position it can never come back to.
  quietStretch: undefined,
  result: undefined,
};

/**
 * Whether this side jumps rather than slides. Flying is a state of a game whose
 * pieces are all down: a side on its way to nine passes through three pieces
 * without that meaning anything, because during the placing phase nobody moves.
 */
export const fliesIn = (game: Game, side: Side): boolean =>
  !game.placing && flies(game.position, side);

export const phaseOf = (game: Game): Phase => {
  if (game.placing) return "placing";
  return fliesIn(game, game.sideToMove) ? "flying" : "moving";
};

/**
 * The room the piece standing here has: any empty point while its side flies,
 * and the empty points next door otherwise. Nowhere, from an empty point.
 *
 * It is what the piece could go to were it its side's move, which during the
 * placing phase is nothing it can act on yet — but room a piece will have is
 * still worth something to whoever is weighing the position up.
 */
export const roomAround = (game: Game, point: PointId): readonly PointId[] => {
  if (!game.position.has(point)) return [];

  // Outside the placing phase this is the rules' own answer. Inside it, a side
  // that happens to hold three pieces is not flying, so the room is next door.
  return game.placing
    ? slidesFrom(game.position, point)
    : destinationsFrom(game.position, point);
};

/**
 * The mills this side can run — the csikicsuki: a closed mill with a piece that
 * can step out to an empty point beside it and step back next move, closing the
 * mill again and earning another capture every second move.
 *
 * The step back only works while the opponent cannot take the point that was
 * left, so the piece stepping out must have no opponent piece next to it — and a
 * side that flies reaches every point, which is why an opponent down to three
 * pieces ends the running of mills altogether.
 *
 * It lives here rather than in `position.ts` because whether the opponent flies
 * is a question about the game rather than about the board: three pieces mean
 * nothing while pieces are still being placed.
 */
export const runningMillsOf = (game: Game, side: Side): readonly Line[] => {
  const { position } = game;
  const opponent = opponentOf(side);
  if (fliesIn(game, opponent)) return [];

  return millsOf(position, side).filter((line) =>
    line.some(
      (member) =>
        // Every empty neighbour is off the mill's own line: the other two points
        // of a mill are held by this very side, so neither of them is empty.
        neighboursOf(member).some((next) => !position.has(next)) &&
        neighboursOf(member).every((next) => position.get(next) !== opponent),
    ),
  );
};

/**
 * What makes two positions the same one for the repetition rule: the pieces, the
 * side to move, the phase, and what is still in hand. Boards that look alike but
 * offer different moves are different positions, so all four go into the name.
 */
const identityOf = (game: Game): string =>
  [
    POINTS.map((point) => game.position.get(point) ?? "-").join("/"),
    game.sideToMove,
    phaseOf(game),
    SIDES.map((side) => game.piecesInHand[side]).join("/"),
  ].join(" ");

/** How often the game has stood in this position over the current stretch. */
const timesSeen = (stretch: QuietStretch | undefined, identity: string): number => {
  let seen = 0;
  for (let step = stretch; step !== undefined; step = step.earlier) {
    if (step.identity === identity) seen += 1;
  }
  return seen;
};

/**
 * What has drawn the game, if anything: the position the side to move is faced
 * with having come up for the third time, or fifty moves by each player without
 * a capture. A game that has been won is never asked.
 */
const drawnBy = (stretch: QuietStretch, seen: number): Draw | undefined => {
  if (seen >= REPETITIONS_TO_DRAW) return "repetition";

  return stretch.quietMoves >= QUIET_MOVES_TO_DRAW ? "fifty-move" : undefined;
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
 * whole moves rather than the halves a capture divides one into. A placement is
 * progress in the way a capture is — a hand it comes out of is a hand that will
 * empty — so it starts the stretch again as well, and the fifty each side is
 * given are fifty of the moving phase's own.
 */
const withMoveComplete = (game: Game, { captured }: { readonly captured: boolean }): Game => {
  const handsEmpty = SIDES.every((side) => game.piecesInHand[side] === 0);
  const handedOver: Game = {
    ...game,
    sideToMove: opponentOf(game.sideToMove),
    placing: game.placing && !handsEmpty,
  };

  const earlier = captured || game.placing ? undefined : game.quietStretch;
  const quietStretch: QuietStretch = {
    identity: identityOf(handedOver),
    quietMoves: earlier === undefined ? 0 : earlier.quietMoves + 1,
    earlier,
  };
  const counted: Game = { ...handedOver, quietStretch };

  // A side still holding pieces has them to put down, however few of them are
  // on the board, so only a side past the placing phase can have lost.
  const ending = counted.placing ? undefined : endingAgainst(counted.position, counted.sideToMove);

  if (ending !== undefined) {
    return { ...counted, result: { winner: opponentOf(counted.sideToMove), ending } };
  }

  // A win is a win: a game that ends on its hundredth quiet move, or on a
  // position seen three times, has still been won if the side to move has lost.
  const draw = drawnBy(quietStretch, timesSeen(quietStretch, quietStretch.identity));

  return draw === undefined ? counted : { ...counted, result: { draw } };
};

/**
 * What a move's arrival leaves behind, before the capture it may earn: the board
 * the piece has landed on, the hand it came out of, and the opponent pieces the
 * mill it closed may take — none of them, where it closed no mill.
 *
 * An arrival is half a move. The rules have no use for the halves, but an
 * interface does: a player taps the destination and then taps the piece to take,
 * and between the two taps this is where the game stands.
 */
export type Arrived = {
  readonly position: Position;
  readonly piecesInHand: Readonly<Record<Side, number>>;
  readonly captures: readonly PointId[];
};

/** Where a legal arrival leaves the game. An illegal one is not asked about. */
export const afterArrival = (game: Game, { from, to }: Arrival): Arrived => {
  const vacated = from === undefined ? game.position : withoutPiece(game.position, from);
  const position = withPiece(vacated, to, game.sideToMove);
  const { sideToMove } = game;

  return {
    position,
    piecesInHand:
      from === undefined
        ? { ...game.piecesInHand, [sideToMove]: game.piecesInHand[sideToMove] - 1 }
        : game.piecesInHand,
    captures:
      millsThrough(position, to, sideToMove).length > 0
        ? capturableFrom(position, opponentOf(sideToMove))
        : [],
  };
};

/** The game a legal move leads to. An illegal one is not asked about. */
export const afterMove = (game: Game, move: Move): Game => {
  const arrived = afterArrival(game, move);

  return withMoveComplete(
    {
      ...game,
      position:
        move.capture === undefined
          ? arrived.position
          : withoutPiece(arrived.position, move.capture),
      piecesInHand: arrived.piecesInHand,
    },
    { captured: move.capture !== undefined },
  );
};

/**
 * Every move the side to move may play, each one whole: where the piece comes
 * from, where it goes, and which piece the mill it closes takes. A move closing a
 * mill is listed once per piece it could take, because which one to take is a
 * decision in its own right. A finished game offers nothing.
 */
export const legalMovesOf = (game: Game): readonly Move[] => {
  if (game.result) return [];

  const arrivals: readonly Arrival[] = game.placing
    ? emptyPoints(game.position).map((to) => ({ to }))
    : movablePointsOf(game.position, game.sideToMove).flatMap((from) =>
        destinationsFrom(game.position, from).map((to) => ({ from, to })),
      );

  return arrivals.flatMap((arrival) => {
    const { captures } = afterArrival(game, arrival);

    return captures.length === 0
      ? [arrival]
      : captures.map((capture) => ({ ...arrival, capture }));
  });
};
