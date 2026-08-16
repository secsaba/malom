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
