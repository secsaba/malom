/**
 * The summary: what a finished game came to for one side — how its moves were
 * graded, and the one mistake it made more than any other.
 *
 * It is the game's shape rather than a move's, and it is the last thing teaching
 * says: a learner who has been told the verdict on eighteen moves one at a time
 * still cannot see which of them were the same mistake. Counting them is what
 * turns a run of verdicts into something to work on next.
 *
 * Nothing here searches and nothing here reads a position. It counts what the
 * assessments already say, which is what keeps a weakness a pattern the engine
 * positively detected rather than a story told about a run of bad grades
 * (ADR-0003) — and it is data, worded in `src/ui` (ADR-0002).
 *
 * Its scope is the one game it is handed. Nothing is carried across games: a
 * weakness is what the player did in the game in front of them, and a tally kept
 * over a session would name a mistake they may have stopped making.
 *
 * It is counted per side rather than for one player, because teaching is a
 * setting rather than a mode for one of them: two people sharing a device are
 * both graded, and one summary over the pair of them would name neither of their
 * weaknesses. Against the computer only one side is ever graded, so only that
 * side is summarised and the question never comes up.
 */

import type { Result } from "../engine/game";
import { SIDES, type Side } from "../engine/position";
import { GRADES, type Grade } from "./grade";
import type { Assessment } from "./assessment";
import { CRITICISM, type Criticism, isCriticism } from "./patterns";

/** How a game ended for the side the summary is about. */
export type Outcome = "won" | "drawn" | "lost";

/** A move the summary counts: who played it, and what the engine made of it. */
export type GradedMove = {
  readonly by: Side;
  /**
   * What the engine made of it, where it had anything to say. The computer's own
   * moves have nothing, and neither do the moves the rules left no choice about.
   */
  readonly assessment: Assessment | undefined;
};

/** How a side's moves were graded, and what its mistakes came to. */
export type Summary = {
  readonly side: Side;
  readonly outcome: Outcome;
  /** How many of the side's moves the engine graded — what the counts add up to. */
  readonly graded: number;
  /** How many of them fell in each of the five grades. */
  readonly counts: Readonly<Record<Grade, number>>;
  /**
   * The criticism the side's moves fired most often, where any fired at all.
   * Ties go to the catalogue's own order, which is the order the criticisms are
   * worth saying in, so the same game always names the same weakness.
   */
  readonly weakness: Criticism | undefined;
};

const NO_MOVES_GRADED: Readonly<Record<Grade, number>> = Object.fromEntries(
  GRADES.map((grade) => [grade, 0]),
) as Record<Grade, number>;

/** How the game ended for this side. A draw is drawn for both of them. */
const outcomeFor = (result: Result, side: Side): Outcome => {
  if ("draw" in result) return "drawn";

  return result.winner === side ? "won" : "lost";
};

/**
 * The criticism these moves fired most often. The catalogue is walked in its own
 * order and a later one has to beat the count rather than match it, which is
 * what settles a tie in favour of the criticism worth saying first.
 */
const weaknessIn = (assessments: readonly Assessment[]): Criticism | undefined => {
  const fired = assessments.flatMap(({ patterns }) => patterns).filter(isCriticism);
  let weakness: Criticism | undefined;
  let most = 0;

  for (const criticism of CRITICISM) {
    const count = fired.filter((pattern) => pattern === criticism).length;
    if (count > most) {
      weakness = criticism;
      most = count;
    }
  }

  return weakness;
};

const summaryOf = (result: Result, side: Side, assessments: readonly Assessment[]): Summary => ({
  side,
  outcome: outcomeFor(result, side),
  graded: assessments.length,
  counts: assessments.reduce<Record<Grade, number>>(
    (counts, { grade }) => ({ ...counts, [grade]: counts[grade] + 1 }),
    { ...NO_MOVES_GRADED },
  ),
  weakness: weaknessIn(assessments),
});

/**
 * What the game came to, one summary per side that has a move in it the engine
 * graded. A side with nothing graded is left out rather than summarised as
 * nought of everything: the computer played no move anybody is learning from,
 * and an empty tally beside a full one reads as a player who did nothing wrong.
 */
export const summariesOf = (
  result: Result,
  moves: readonly GradedMove[],
): readonly Summary[] =>
  SIDES.flatMap((side) => {
    const assessments = moves
      .filter((move) => move.by === side)
      .map(({ assessment }) => assessment)
      .filter((assessment) => assessment !== undefined);

    return assessments.length === 0 ? [] : [summaryOf(result, side, assessments)];
  });
