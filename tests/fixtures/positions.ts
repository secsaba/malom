/**
 * Games written down as the position they stand in rather than as the moves that
 * produced them, so that a test about the search can say what the position is for
 * instead of spending eighteen placements getting there.
 *
 * The rules are bypassed on the way in, so a game built here is only as legal as
 * whoever wrote it made it. Every fixture that uses {@link gameOf} says what it
 * is testing and why the position is a reachable one; anything about how a game
 * arrives at a position belongs in the session's tests, which play it out.
 */

import type { PointId } from "../../src/engine/board";
import type { Game, Recent } from "../../src/engine/game";
import { type Position, type Side, withPiece } from "../../src/engine/position";

export type GameFixture = {
  /** The points light stands on. */
  readonly light: readonly PointId[];
  /** The points dark stands on. */
  readonly dark: readonly PointId[];
  readonly sideToMove: Side;
  /** Left out for a game past the placing phase, where both hands are empty. */
  readonly piecesInHand?: Readonly<Record<Side, number>>;
  /** Moves played since the last capture or placement, for a game near the fifty-move draw. */
  readonly quietMoves?: number;
};

const NO_PIECES_IN_HAND = { light: 0, dark: 0 } as const;

/**
 * The stretch a game of `quietMoves` moves without a capture has behind it. The
 * positions in it are named after their distance back rather than written out:
 * the fifty-move count is all these fixtures ask of it, and a chain of positions
 * none of which repeat is exactly what a game short of the fifty looks like.
 */
const stretchOf = (quietMoves: number): Recent | undefined => {
  let recent: Recent | undefined = undefined;

  for (let move = 0; move <= quietMoves; move += 1) {
    recent = { identity: `fixture ${move}`, quietMoves: move, earlier: recent };
  }

  return recent;
};

/** A game part-played, built from where the pieces stand. */
export const gameOf = ({
  light,
  dark,
  sideToMove,
  piecesInHand = NO_PIECES_IN_HAND,
  quietMoves = 0,
}: GameFixture): Game => {
  let position: Position = new Map<PointId, Side>();
  for (const point of light) position = withPiece(position, point, "light");
  for (const point of dark) position = withPiece(position, point, "dark");

  return {
    position,
    sideToMove,
    placing: piecesInHand.light > 0 || piecesInHand.dark > 0,
    piecesInHand,
    recent: stretchOf(quietMoves),
    result: undefined,
  };
};
