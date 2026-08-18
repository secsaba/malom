/**
 * The reason: the one thing the player is told about the move they just played,
 * beyond the grade itself.
 *
 * It is a choice and not a summary. A move often does several things at once —
 * closes a mill, stands on an intersection, leaves a piece where it can be shut
 * in — and a learner reading a paragraph learns less than a learner reading a
 * sentence. So the catalogue is ordered and the first pattern that matches the
 * verdict is the one that is said.
 *
 * Which half of the catalogue it draws from follows the grade, because a reason
 * that praises a blunder or scolds the engine's own move teaches the learner to
 * stop reading. A move graded no worse than Jó is told what it did well; a move
 * graded worse is told what it did badly.
 *
 * Where no pattern of the right half fired there is a fallback, and the fallback
 * is deliberately thin (ADR-0003): it names the move the engine would have
 * played and says nothing else. It does not say the engine preferred it — the
 * bands call a move within a point of the engine's own the best one, so a player
 * can be graded Legjobb for a different move, and "preferred" would be a claim
 * the evaluation does not support. It names what the engine would have played,
 * which is true either way.
 *
 * Like everything behind the boundary this is data (ADR-0002): `src/ui` turns a
 * reason into a Hungarian sentence, and this module never sees one.
 */

import type { Move } from "../engine/game";
import { type Grade, isNoWorseThan, isTheSameMove } from "./grade";
import { type Pattern, isCriticism } from "./patterns";

/** The worst a move can be graded and still be told what it did well. */
const PRAISED_DOWN_TO: Grade = "good";

/**
 * What the player is told. A pattern where one fired, and otherwise the move the
 * engine would have played — which, where that is the move they played, is worth
 * saying as much as any pattern is.
 */
export type Reason =
  /** Something the engine positively detected in the move. */
  | { readonly kind: "pattern"; readonly pattern: Pattern }
  /** Nothing was detected, and the engine would have played this instead. */
  | { readonly kind: "prefers"; readonly move: Move }
  /** Nothing was detected, and the engine would have played the same move. */
  | { readonly kind: "agrees" };

/**
 * What to tell the player about the move they played: the first pattern in the
 * catalogue that matches the verdict, or the honest fallback where none does.
 *
 * The patterns are taken in the order they come in, which is the order the
 * catalogue puts them in — most instructive first.
 */
export const reasonFor = (
  grade: Grade,
  patterns: readonly Pattern[],
  { played, preferred }: { readonly played: Move; readonly preferred: Move },
): Reason => {
  const scolding = !isNoWorseThan(grade, PRAISED_DOWN_TO);
  const said = patterns.find((pattern) => isCriticism(pattern) === scolding);

  if (said !== undefined) return { kind: "pattern", pattern: said };

  return isTheSameMove(played, preferred) ? { kind: "agrees" } : { kind: "prefers", move: preferred };
};
