/**
 * A position: which side, if any, stands on each of the board's 24 points, and
 * the questions the rules ask of it.
 *
 * A position is plain data and is never mutated — every change returns a new
 * one, so a whole game is a sequence of positions the search can walk and the
 * interface can render without copying defensively.
 */

import { LINES, type Line, type PointId, POINTS, neighboursOf } from "./board";

/** The two players. Light places first. */
export const SIDES = ["light", "dark"] as const;

export type Side = (typeof SIDES)[number];

/** The side playing against this one. */
export const opponentOf = (side: Side): Side => (side === "light" ? "dark" : "light");

/** The occupied points of the board, each mapped to the side standing on it. */
export type Position = ReadonlyMap<PointId, Side>;

export const EMPTY_POSITION: Position = new Map();

/** The same position with one more piece on it. */
export const withPiece = (position: Position, point: PointId, side: Side): Position =>
  new Map(position).set(point, side);

/** The same position with the piece on this point taken off. */
export const withoutPiece = (position: Position, point: PointId): Position => {
  const remaining = new Map(position);
  remaining.delete(point);
  return remaining;
};

/** The points no piece stands on. */
export const emptyPoints = (position: Position): readonly PointId[] =>
  POINTS.filter((point) => !position.has(point));

/** The empty points a piece on this point can slide to, ordered by file and then by rank. */
export const slidesFrom = (position: Position, point: PointId): readonly PointId[] =>
  neighboursOf(point).filter((neighbour) => !position.has(neighbour));

/** The points one side's pieces stand on, ordered by file and then by rank. */
export const pointsHeldBy = (position: Position, side: Side): readonly PointId[] =>
  POINTS.filter((point) => position.get(point) === side);

/** How few pieces a side is left with when it starts to fly, and when it has lost. */
const PIECES_TO_FLY = 3;
/** The pieces a side is left with when it has lost: two cannot make a mill. */
export const PIECES_TO_LOSE = 2;

/** Whether this side is down to the three pieces that let it jump rather than slide. */
export const flies = (position: Position, side: Side): boolean =>
  pointsHeldBy(position, side).length === PIECES_TO_FLY;

/**
 * The points the piece standing here may go to: any empty point while its side
 * flies, and the empty points next door otherwise. Nowhere, from an empty point.
 */
export const destinationsFrom = (position: Position, point: PointId): readonly PointId[] => {
  const side = position.get(point);
  if (side === undefined) return [];

  return flies(position, side) ? emptyPoints(position) : slidesFrom(position, point);
};

/** The pieces of one side that have somewhere to go. */
export const movablePointsOf = (position: Position, side: Side): readonly PointId[] =>
  pointsHeldBy(position, side).filter((point) => destinationsFrom(position, point).length > 0);

/** What ended a game: the loser was reduced to two pieces, or left with no legal move. */
export type Ending = "reduced" | "blocked";

/**
 * What has become of this side where it stands: nothing, or the loss it cannot
 * play its way out of. It asks only about the board, so a side that still has
 * pieces in hand — one that has somewhere to put them, and a board that always
 * has room — must not be asked.
 */
export const endingAgainst = (position: Position, side: Side): Ending | undefined => {
  if (pointsHeldBy(position, side).length <= PIECES_TO_LOSE) return "reduced";

  // A side down to three flies, and the board it flies over always has an empty
  // point, so only a side with more pieces than that can be shut in.
  return movablePointsOf(position, side).length === 0 ? "blocked" : undefined;
};

// The two lines every point lies on — the only lines a piece placed there can
// close. Derived from LINES so the board stays the single source of truth.
const LINES_THROUGH: ReadonlyMap<PointId, readonly Line[]> = new Map(
  POINTS.map((point) => [
    point,
    LINES.filter((line) => (line as readonly PointId[]).includes(point)),
  ]),
);

/** The mills this side holds through the given point — none, one, or two. */
export const millsThrough = (
  position: Position,
  point: PointId,
  side: Side,
): readonly Line[] =>
  (LINES_THROUGH.get(point) ?? []).filter((line) =>
    line.every((member) => position.get(member) === side),
  );

/** Whether the piece standing on this point is part of a mill. */
export const standsInMill = (position: Position, point: PointId): boolean => {
  const side = position.get(point);
  return side !== undefined && millsThrough(position, point, side).length > 0;
};

/**
 * The pieces of one side a capture may take: those standing outside a mill, or
 * — once every one of them stands in a mill — any of them, so that a side whose
 * pieces are all milled cannot be captured out of reach.
 */
export const capturableFrom = (position: Position, side: Side): readonly PointId[] => {
  const pieces = pointsHeldBy(position, side);
  const outsideMills = pieces.filter((point) => !standsInMill(position, point));

  return outsideMills.length > 0 ? outsideMills : pieces;
};

/** Whether this side holds all three points of a line. */
const isMill = (position: Position, line: Line, side: Side): boolean =>
  line.every((point) => position.get(point) === side);

/** The lines this side holds all three points of. */
export const millsOf = (position: Position, side: Side): readonly Line[] =>
  LINES.filter((line) => isMill(position, line, side));

/** The lines this side holds two points of, with the third empty — one move from a mill. */
export const potentialMillsOf = (position: Position, side: Side): readonly Line[] =>
  LINES.filter((line) => {
    const held = line.filter((point) => position.get(point) === side);

    return held.length === 2 && line.some((point) => !position.has(point));
  });

/** The empty point a potential mill would be closed on. */
export const closingPointOf = (position: Position, line: Line): PointId | undefined =>
  line.find((point) => !position.has(point));

/**
 * The pieces of this side standing on two potential mills at once, which the
 * opponent cannot block both of.
 *
 * Each point lies on exactly two lines, so a piece on two potential mills is one
 * fork and never more. The two lines meet only at that piece, so the points that
 * would close them are different ones and cannot both be taken in one move.
 */
export const forksOf = (position: Position, side: Side): readonly PointId[] => {
  const potential = potentialMillsOf(position, side);

  return pointsHeldBy(position, side).filter(
    (point) => potential.filter((line) => (line as readonly PointId[]).includes(point)).length === 2,
  );
};

/**
 * The lines this side could still fill: those with no opponent piece anywhere on
 * them. A side with none of these can never close another mill, whatever it
 * plays.
 */
export const openLinesFor = (position: Position, side: Side): readonly Line[] =>
  LINES.filter((line) => line.every((point) => position.get(point) !== opponentOf(side)));
