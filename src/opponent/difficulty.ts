/**
 * The four difficulties, and what each of them comes to.
 *
 * A difficulty is two numbers: how deep the opponent looks, and how often it
 * plays a weaker move on purpose. Both move together — Kezdő looks one move
 * ahead and blunders half the time, Mester looks furthest and never blunders at
 * all — because a weak opponent that merely thinks shallowly plays oddly rather
 * than badly, and a learner beating it learns nothing from having done so.
 *
 * The weaker move is picked from the moves the search itself ranked near the
 * best one, weighted so that a nearly-as-good move comes up far more often than
 * a barely-good-enough one. That is the whole point of it: a mill missed or an
 * opponent's mill let through is a mistake a person makes, and a piece given
 * away for nothing is not, so the second is never played however weak the
 * opponent is.
 *
 * The depths are fixed rather than found by a clock, which is what makes Mester
 * deterministic: the same position gives the same move on a fast desktop and on
 * a slow phone, and the only thing that varies anything below Mester is the
 * chance it is handed. They are chosen so that even the widest position — the
 * opening, with all 24 points to place on — is answered well inside a second.
 */

import type { ScoredMove } from "../ai/search";
import type { Move } from "../engine/game";

/** The difficulties, weakest first. In Hungarian: Kezdő, Haladó, Erős, Mester. */
export const DIFFICULTIES = ["beginner", "intermediate", "strong", "master"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

/** What a difficulty is made of. */
export type DifficultySettings = {
  /** How many moves ahead it looks. */
  readonly depth: number;
  /**
   * How often it plays a weaker move on purpose, as a share of its moves. Nought
   * at Mester, which is what makes Mester deterministic.
   */
  readonly blunderRate: number;
};

export const DIFFICULTY_SETTINGS: Readonly<Record<Difficulty, DifficultySettings>> = {
  beginner: { depth: 1, blunderRate: 0.5 },
  intermediate: { depth: 2, blunderRate: 0.3 },
  strong: { depth: 3, blunderRate: 0.1 },
  master: { depth: 4, blunderRate: 0 },
};

/**
 * Where a player who has not chosen starts. The weakest of the four: this is a
 * game for somebody learning it, and a first game they can win is worth more
 * than a first game that shows them how far they have to go.
 */
export const DEFAULT_DIFFICULTY: Difficulty = "beginner";

/**
 * How much worse than the best move a move may be and still be one a weakened
 * opponent will play, in the evaluation's own units — where a piece in the
 * moving phase is worth a hundred and a mill about a third of that.
 *
 * It is wide enough to take in a mill missed or an opponent's mill let through,
 * and narrow enough to leave a piece handed over for nothing outside it.
 */
export const NEAR_BEST_MARGIN = 40;

/**
 * The moves a weakened opponent may play instead of the best one: those the
 * search ranked within the margin of it. The best move itself is not among them
 * — a blunder that plays the best move is not a blunder — so an opponent with
 * nothing else near enough plays the best move and no harm is done.
 */
const nearBestOf = (candidates: readonly ScoredMove[]): readonly ScoredMove[] => {
  const [best, ...rest] = candidates;
  if (!best) return [];

  return rest.filter(({ score }) => best.score - score <= NEAR_BEST_MARGIN);
};

/**
 * How likely a near-best move is to be the one played: heaviest where it is as
 * good as the best move, tailing off towards the edge of the margin, and never
 * quite to nothing — a move inside the margin is one this opponent might play.
 */
const weightOf = (best: ScoredMove, near: ScoredMove): number =>
  NEAR_BEST_MARGIN + 1 - (best.score - near.score);

/** One of the weighted moves, drawn with the chance it was given. */
const drawn = (weighted: readonly (readonly [ScoredMove, number])[], chance: number) => {
  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
  let ticket = chance * total;

  for (const [candidate, weight] of weighted) {
    ticket -= weight;
    if (ticket < 0) return candidate;
  }

  // Only a chance of exactly one could land here, and the range it is drawn from
  // stops short of it; the last move is what it would have been either way.
  return weighted[weighted.length - 1]?.[0];
};

/**
 * The move an opponent at this difficulty plays, out of what the search came
 * back with — the best one, or, as often as the difficulty blunders, a weaker
 * one drawn from those near it.
 *
 * Chance is handed in rather than reached for, so that a test can say what it
 * falls out as, and so that Mester can be shown never to consult it.
 */
export const moveAtDifficulty = (
  difficulty: Difficulty,
  candidates: readonly ScoredMove[],
  random: () => number,
): Move | undefined => {
  const [best] = candidates;
  if (!best) return undefined;

  const { blunderRate } = DIFFICULTY_SETTINGS[difficulty];
  // Asked before chance is, so that the strongest opponent is not merely certain
  // to play the best move but never draws a number on the way to it.
  if (blunderRate === 0) return best.move;
  if (random() >= blunderRate) return best.move;

  const weaker = nearBestOf(candidates);
  if (weaker.length === 0) return best.move;

  return (drawn(weaker.map((near) => [near, weightOf(best, near)] as const), random()) ?? best).move;
};
