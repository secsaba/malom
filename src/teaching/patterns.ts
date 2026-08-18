/**
 * The patterns: the named tactical features the engine can positively detect in
 * a move that has been played, and the only thing a reason may ever be built
 * from (ADR-0003).
 *
 * Every detector here answers a question about the rules and nothing else. None
 * of them asks the search, and none of them reads an evaluation — a pattern is
 * something that is either on the board or is not, which is exactly what makes
 * it safe to say out loud. The grade says how much a move cost; a pattern says
 * what the move did, and the two are worked out independently.
 *
 * The catalogue is closed and ordered. Closed, because a reason that is not one
 * of these is a reason nobody wrote a detector for; ordered, because a move
 * often does several things at once and the player is shown one sentence. The
 * order within each half is what to say first, most instructive foremost: a
 * novice who has just built a kettős fenyegetés learns more from being told so
 * than from being told they also stood on a kereszteződés.
 *
 * They are returned as data and worded in `src/ui` (ADR-0002), so the same
 * pattern reads in Hungarian or in English without this module knowing either.
 */

import { type Line, type PointId, neighboursOf } from "../engine/board";
import {
  type Arrived,
  type Game,
  type Move,
  afterArrival,
  afterMove,
  fliesIn,
  legalMovesOf,
  roomAround,
  runningMillsOf,
} from "../engine/game";
import {
  type Side,
  closingPointOf,
  destinationsFrom,
  forksOf,
  millsThrough,
  openLinesFor,
  opponentOf,
  pointsHeldBy,
  potentialMillsOf,
} from "../engine/position";

/**
 * What a move did well, best worth saying first. The learner is told these so
 * that good play is recognised and not only punished play named.
 */
export const PRAISE = [
  /** The opponent has no line left it could ever fill, so it can close no more mills. */
  "opponent-mill-less",
  /** Two potential mills sharing a piece, of which the opponent can block only one. */
  "fork-created",
  /** A mill that can now be stepped out of and back into — the csikicsuki. */
  "running-mill-opened",
  /** The opponent's potential mill was taken away on the move before it closed. */
  "mill-blocked",
  "mill-closed",
  /** One of the four points with four neighbours, the most valuable on the board. */
  "intersection-taken",
] as const;

/**
 * What a move did badly, worst worth saying first. The wrong piece taken leads
 * because it is the most specific: a capture that leaves the threat it was
 * earned by standing is a mill let through as well, and the sentence that names
 * the capture teaches more than the sentence that names the mill.
 */
export const CRITICISM = [
  "wrong-piece-captured",
  /** The opponent can close a mill now, and some other move would have stopped it. */
  "mill-let-through",
  "fork-handed",
  /** A mill was there to be closed and the move closed none. */
  "mill-missed",
  /** A piece stepped out of a mill it cannot step back into, and gained nothing by it. */
  "mill-broken-for-nothing",
  /** The piece that moved can be shut in by the opponent's reply. */
  "piece-left-blockable",
] as const;

/** The whole catalogue, praise before criticism and each half in its own order. */
export const PATTERNS = [...PRAISE, ...CRITICISM] as const;

export type Praise = (typeof PRAISE)[number];
export type Criticism = (typeof CRITICISM)[number];
export type Pattern = (typeof PATTERNS)[number];

/** Whether a pattern is one of the ones a player is told off for. */
export const isCriticism = (pattern: Pattern): pattern is Criticism =>
  (CRITICISM as readonly Pattern[]).includes(pattern);

/** How many neighbours the four intersections have. */
const INTERSECTION_DEGREE = 4;

/**
 * A move that has been played, as the detectors need to see it: the game it was
 * played in, the game it led to, and the half-way point between them — the piece
 * landed and the capture not yet taken, which is what says whether a mill was
 * closed and which pieces the capture could have taken instead.
 */
type Played = {
  readonly before: Game;
  readonly move: Move;
  readonly after: Game;
  readonly arrived: Arrived;
  readonly mover: Side;
  readonly opponent: Side;
};

/**
 * Whether this side could send a piece to this point, were it their move. A
 * point somebody stands on can be reached by nobody, and while pieces are still
 * being placed any empty point is reachable by a side with one left in hand.
 *
 * `notFrom` leaves pieces out of the reckoning, which is what the second caller
 * needs: a piece already on a line cannot close it. Both questions are the rules'
 * rather than teaching's, but they are asked nowhere else in the codebase, so
 * they stay here rather than being pushed into the engine for one caller each.
 */
const canReach = (
  game: Game,
  side: Side,
  point: PointId,
  notFrom: readonly PointId[] = [],
): boolean => {
  if (game.position.has(point)) return false;
  if (game.placing) return game.piecesInHand[side] > 0;

  return pointsHeldBy(game.position, side).some(
    (from) => !notFrom.includes(from) && destinationsFrom(game.position, from).includes(point),
  );
};

/**
 * Whether this side could close this potential mill on their very next move.
 *
 * The piece that closes it has to come from off the line: a piece already on the
 * line that slides to the empty point takes its own place away with it, and the
 * line is two pieces and a hole again. That is the whole of what "in time"
 * means — a mill blocked a move before it could have been closed was blocked in
 * time, and a mill blocked earlier than that was blocked against nothing.
 */
const canClose = (game: Game, side: Side, line: Line): boolean => {
  const point = closingPointOf(game.position, line);

  return point !== undefined && canReach(game, side, point, line);
};

/**
 * The forks this side could actually act on: a piece on two potential mills of
 * which it could close either one next move.
 *
 * The glossary defines a fork by what it does — two potential mills sharing a
 * piece, *so the opponent can only block one of them* — and that clause is a
 * threat rather than a shape. `forksOf` answers the shape, which is what the
 * evaluation counts and what its weights were tuned against; this is teaching's
 * own sharper question, asked for the same reason `canClose` is: a learner told
 * they built a kettős fenyegetés is being told the opponent is now in trouble,
 * and a pair of lines neither of which anybody can fill puts nobody in trouble.
 *
 * While pieces are still being placed every empty point is one placement away,
 * so this is the shape itself in that phase and only narrows once pieces move.
 *
 * It is deliberately not pushed back into `forksOf`: what that counts is an
 * evaluation term, and narrowing it would change the search's opinion of every
 * position it has been measured on (ADR-0005) — a self-play question rather than
 * a teaching one.
 */
const threateningForksOf = (game: Game, side: Side): readonly PointId[] => {
  const potential = potentialMillsOf(game.position, side);

  return forksOf(game.position, side).filter((point) =>
    potential
      .filter((line) => (line as readonly PointId[]).includes(point))
      .every((line) => canClose(game, side, line)),
  );
};

/**
 * Whether the side to move can close a mill at once. A move earning a capture is
 * exactly a move closing a mill, so the rules answer this without the shapes
 * being counted again.
 */
const millIsThere = (game: Game): boolean =>
  legalMovesOf(game).some(({ capture }) => capture !== undefined);

/** Whether the move closed a mill — which is to say, whether it earned a capture. */
const closedAMill = ({ arrived, move, mover }: Played): boolean =>
  millsThrough(arrived.position, move.to, mover).length > 0;

/** Whether the move landed on the one empty point of a mill the opponent was about to close. */
const blockedAMill = ({ before, move, opponent }: Played): boolean =>
  potentialMillsOf(before.position, opponent).some(
    (line) => closingPointOf(before.position, line) === move.to && canClose(before, opponent, line),
  );

/**
 * What each pattern is. Every one of them is a question about the position
 * before the move and the position after it, and none of them guesses at what
 * the player was thinking.
 */
const DETECTORS: Readonly<Record<Pattern, (played: Played) => boolean>> = {
  "opponent-mill-less": ({ before, after, opponent }) =>
    openLinesFor(before.position, opponent).length > 0 &&
    openLinesFor(after.position, opponent).length === 0,

  "fork-created": ({ before, after, mover }) =>
    threateningForksOf(after, mover).length > threateningForksOf(before, mover).length,

  // A csikicsuki is a mill being run, and nothing can be run until the pieces
  // are all down — so a mill that opens one on the last placement of the game
  // counts, and one that opens it earlier is a mill and no more than that yet.
  "running-mill-opened": ({ before, after, mover }) =>
    !after.placing && runningMillsOf(after, mover).length > runningMillsOf(before, mover).length,

  "mill-blocked": blockedAMill,

  "mill-closed": closedAMill,

  "intersection-taken": ({ move }) => neighboursOf(move.to).length === INTERSECTION_DEGREE,

  /**
   * A capture is a decision of its own: the mill is earned by the arrival, and
   * which piece comes off is chosen afterwards. It is the wrong piece when some
   * other piece the same mill could have taken would have left the opponent
   * without a mill to close, and this one left them one.
   */
  "wrong-piece-captured": (played) => {
    const { before, move, after, arrived } = played;
    if (move.capture === undefined || !millIsThere(after)) return false;

    return arrived.captures.some(
      (other) =>
        other !== move.capture && !millIsThere(afterMove(before, { ...move, capture: other })),
    );
  },

  /**
   * A mill the opponent can now close, where some other move would have left
   * them none. The second half is what makes it letting one through rather than
   * being unable to stop it: a player with no move that stops it has not made a
   * mistake, and telling them they have would teach them the wrong lesson.
   */
  "mill-let-through": ({ before, after }) =>
    millIsThere(after) &&
    legalMovesOf(before).some((other) => !millIsThere(afterMove(before, other))),

  "fork-handed": ({ before, after, opponent }) =>
    threateningForksOf(after, opponent).length > threateningForksOf(before, opponent).length,

  "mill-missed": (played) => !closedAMill(played) && millIsThere(played.before),

  /**
   * A piece stepped out of a mill, closed nothing, blocked nothing, and cannot
   * step back — the opponent can take the point it left. A piece that steps out
   * of a mill nobody can follow it into is running one, which is the opposite of
   * this and is praised as such.
   */
  "mill-broken-for-nothing": (played) => {
    const { before, move, after, mover, opponent } = played;
    if (move.from === undefined) return false;

    return (
      millsThrough(before.position, move.from, mover).length > 0 &&
      !closedAMill(played) &&
      !blockedAMill(played) &&
      canReach(after, opponent, move.from)
    );
  },

  /**
   * The piece that moved can be shut in by the opponent's very next move. A
   * piece the reply captures is off the board rather than shut in, so what is
   * checked is that the piece is still standing there with nowhere to go — and a
   * side that flies reaches every empty point and can be shut in by nobody.
   */
  "piece-left-blockable": ({ move, after, mover }) => {
    if (fliesIn(after, mover) || roomAround(after, move.to).length === 0) return false;

    return legalMovesOf(after).some((reply) => {
      const replied = afterMove(after, reply);

      return (
        replied.position.get(move.to) === mover && roomAround(replied, move.to).length === 0
      );
    });
  },
};

/**
 * What the move did, in the order it is worth saying. A move often does several
 * things at once, so this is a list rather than an answer; which of them the
 * player is told is the reason's decision and not this module's.
 */
export const patternsIn = (before: Game, move: Move): readonly Pattern[] => {
  const mover = before.sideToMove;
  const played: Played = {
    before,
    move,
    after: afterMove(before, move),
    arrived: afterArrival(before, move),
    mover,
    opponent: opponentOf(mover),
  };

  return PATTERNS.filter((pattern) => DETECTORS[pattern](played));
};
