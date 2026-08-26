/**
 * What one point of the board is, and what it is called.
 *
 * The board draws a state of a point as a mark and reads it out as a word, and
 * both come from here so that the two cannot drift: a mark the board grew
 * without a word would be a state a player who cannot see it is never told
 * about, which is the whole failure this module exists to make impossible.
 *
 * Pure over plain data — no React and no DOM — so every announcement the board
 * can make is tested without rendering one.
 */

import type { PointId } from "../engine/board";
import type { Move } from "../engine/game";
import type { Side } from "../engine/position";
import type { Strings } from "../strings";

/** What a hinted move has a point doing. */
export type HintRole = "from" | "to" | "capture";

/**
 * Everything the board has to say about a point: what stands on it, and which
 * of the states the game can leave it in it is in. A point can be in several at
 * once — a picked-up piece that also moved last — so these are not one field.
 */
export type PointState = {
  /** The side whose piece stands here, where one does. */
  readonly occupant: Side | undefined;
  /** Whether the side to move may act on this point. */
  readonly legal: boolean;
  /** Whether this is the piece the player has picked up. */
  readonly selected: boolean;
  /** What the hint, where one is shown, has this point doing. */
  readonly hint: HintRole | undefined;
  /** Whether the piece that moved last came to rest here. */
  readonly lastMove: boolean;
  /**
   * The side whose piece the last move took off this point, where it took one
   * from here. It is the one state of a point that is about a piece no longer
   * on the board, so it is a side rather than a flag: the mark left behind is
   * drawn in the taken piece's own ink, and there is nothing standing here to
   * ask which that was.
   */
  readonly captured: Side | undefined;
};

/**
 * What a hinted move has this point doing, if anything: the piece to play, where
 * to play it, or the piece the mill it closes takes. All three are named,
 * because all three are what the engine preferred — a hint that showed only
 * where the piece lands would leave the player to guess the capture it earns.
 */
export const hintedAt = (hint: Move | undefined, point: PointId): HintRole | undefined => {
  if (!hint) return undefined;
  if (point === hint.to) return "to";
  if (point === hint.from) return "from";

  return point === hint.capture ? "capture" : undefined;
};

/**
 * How the parts of an announcement are run together. It is punctuation and not
 * language — the strings module holds the things said, and this is only how they
 * are strung into one sentence — so it lives where the sentence is built. A
 * language that punctuates a list some other way would take it with it.
 */
export const BETWEEN = ", ";

/**
 * The states worded, in one fixed order: what stands on the point, and then
 * what the game has made of it. The order is fixed rather than following
 * whatever changed last, because a player hearing the same point twice has to
 * hear it the same way to hear the difference.
 */
const wordsFor = (
  { occupant, legal, selected, hint, lastMove, captured }: PointState,
  strings: Strings,
): readonly string[] => {
  const { point } = strings.board;

  return [
    occupant ? point.piece[occupant] : point.empty,
    ...(selected ? [point.selected] : []),
    ...(legal ? [point.legal] : []),
    ...(hint ? [point.hint[hint]] : []),
    ...(lastMove ? [point.lastMove] : []),
    ...(captured ? [point.captured[captured]] : []),
  ];
};

/**
 * A point read out: its coordinate and then its state. The coordinate leads
 * because it is what tells this point from the other 23, and it is the one part
 * of the sentence that is notation rather than language — `a1` reads the same in
 * either — so it comes from the board and everything after it from the strings
 * given.
 *
 * The strings are a parameter rather than an import, because which language the
 * board is read out in is the interface's answer and this module is pure: the
 * board hands over the strings it is rendering with, and the same state can be
 * announced in either language without rendering anything.
 */
export const pointLabel = (point: PointId, state: PointState, strings: Strings): string =>
  [point, ...wordsFor(state, strings)].join(BETWEEN);
