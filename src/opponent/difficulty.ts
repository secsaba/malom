/**
 * The four difficulties, and what each of them comes to.
 *
 * A difficulty is two things: how deep the opponent looks, and how often it
 * plays a weaker move on purpose. Both move together — Kezdő looks one move
 * ahead and blunders half the time, Mester looks furthest and never blunders at
 * all — because a weak opponent that merely thinks shallowly plays oddly rather
 * than badly, and a learner beating it learns nothing from having done so.
 *
 * The weaker move is drawn from a shortlist the search itself ranked, weighted
 * so that a nearly-as-good move comes up far more often than a barely-good-
 * enough one. The shortlist is what makes the mistake a mistake and not a
 * random move: it is bounded twice over, by how many moves may be on it and by
 * how far behind the best one they may be.
 *
 * The depths are fixed rather than found by a clock, which is what makes Mester
 * deterministic: the same position gives the same move on a fast desktop and on
 * a slow phone. They are set per phase because the phases are not the same size
 * — a placing phase looks at up to 24 points, a moving piece at four, and a
 * flying side at every empty point on the board — so one depth would be either
 * too slow in the widest phase or needlessly blind in the narrowest.
 */

import type { ScoredMove } from "../ai/search";
import { type Game, type Move, type Phase, phaseOf } from "../engine/game";

/** The difficulties, weakest first. In Hungarian: Kezdő, Haladó, Erős, Mester. */
export const DIFFICULTIES = ["beginner", "intermediate", "strong", "master"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

/** What a difficulty is made of. */
export type DifficultySettings = {
  /** How many moves ahead it looks, in each phase. */
  readonly depth: Readonly<Record<Phase, number>>;
  /**
   * How often it plays a weaker move on purpose, as a share of its moves. Nought
   * at Mester, which is what makes Mester deterministic.
   */
  readonly blunderRate: number;
};

/**
 * The four of them, in numbers.
 *
 * The depths are the deepest that answer inside about half a second, measured
 * rather than guessed, and the phases differ by more than they look: the opening
 * costs 250ms at four moves deep and eight times that at five, while a position
 * with both sides flying — 54 moves each, the widest the board ever gets — costs
 * half a second at three moves deep and ten times that at four. That last cap is
 * why Erős and Mester meet in the flying phase: there is no depth between them
 * to be had there that a player would wait for.
 */
export const DIFFICULTY_SETTINGS: Readonly<Record<Difficulty, DifficultySettings>> = {
  beginner: { depth: { placing: 1, moving: 1, flying: 1 }, blunderRate: 0.5 },
  intermediate: { depth: { placing: 2, moving: 2, flying: 2 }, blunderRate: 0.3 },
  strong: { depth: { placing: 3, moving: 4, flying: 3 }, blunderRate: 0.1 },
  master: { depth: { placing: 4, moving: 5, flying: 3 }, blunderRate: 0 },
};

/**
 * How deep an opponent at this difficulty looks into this game. The phase is the
 * game's own, so a difficulty answers the question every caller has — the one
 * playing a move now, and the harness playing a hundred games of them (#9) —
 * rather than each of them reading the table its own way.
 */
export const depthAt = (difficulty: Difficulty, game: Game): number =>
  DIFFICULTY_SETTINGS[difficulty].depth[phaseOf(game)];

/**
 * How strongly the engine plays when nothing is holding it back: the strongest of
 * the four, which is what makes Mester the thing a learner measures themselves
 * against. Hints and grades run here whatever difficulty the computer is playing
 * at (ADR-0001), and they read the depths off this table rather than keeping a
 * second copy that could quietly fall behind it.
 */
export const FULL_STRENGTH: Difficulty = "master";

/**
 * Where a player who has not chosen starts. The weakest of the four: this is a
 * game for somebody learning it, and a first game they can win is worth more
 * than a first game that shows them how far they have to go.
 */
export const DEFAULT_DIFFICULTY: Difficulty = "beginner";

/**
 * How much worse than the best move a move may be and still reach the shortlist,
 * in the evaluation's own units.
 *
 * What that admits depends on the phase, because the evaluation prices the same
 * feature differently in each. Once pieces move, where a piece is worth a
 * hundred and a mill about a third of that, it takes in a mill missed and leaves
 * a piece handed over well outside. While pieces are being placed, where the
 * evaluation prices shape above material, it takes in the opponent's mill let
 * through — which is the mistake a novice actually makes, and the one worth
 * letting a weak opponent make back.
 */
export const NEAR_BEST_MARGIN = 40;

/**
 * How many moves may be on the shortlist beside the best one.
 *
 * The margin alone is not enough, because it is an absolute distance and some
 * positions are flat: on an empty board all 24 placements score within twenty
 * of each other, and a margin wide enough to be a mistake anywhere admits every
 * legal move there. Drawing from all of them would be the uniform-random
 * opponent this design exists to avoid, so the shortlist is a shortlist however
 * flat the position is.
 */
export const NEAR_BEST_COUNT = 4;

/**
 * The moves a weakened opponent may play instead of the best one: the few the
 * search ranked closest to it, and none further behind it than the margin. The
 * best move itself is not among them — a blunder that plays the best move is not
 * a blunder — so an opponent with nothing else near enough plays the best move
 * and no harm is done.
 */
const nearBestOf = (candidates: readonly ScoredMove[]): readonly ScoredMove[] => {
  const [best, ...rest] = candidates;
  if (!best) return [];

  return rest
    .filter(({ score }) => best.score - score <= NEAR_BEST_MARGIN)
    .slice(0, NEAR_BEST_COUNT);
};

/**
 * How likely a near-best move is to be the one played: heaviest where it is as
 * good as the best move, tailing off towards the edge of the margin, and never
 * quite to nothing — a move on the shortlist is one this opponent might play.
 */
const weightOf = (best: ScoredMove, near: ScoredMove): number =>
  NEAR_BEST_MARGIN + 1 - (best.score - near.score);

/**
 * One of the shortlisted moves, drawn with the chance it was given. A move's
 * share of the draw is its weight's share of the whole.
 */
const drawnFrom = (
  shortlist: readonly ScoredMove[],
  best: ScoredMove,
  chance: number,
): ScoredMove => {
  let ticket = chance * shortlist.reduce((total, near) => total + weightOf(best, near), 0);
  // Where the ticket outlasts every weight — which a chance drawn short of one
  // cannot quite do — the last move on the shortlist is what it comes to.
  let taken = best;

  for (const near of shortlist) {
    taken = near;
    ticket -= weightOf(best, near);
    if (ticket < 0) break;
  }

  return taken;
};

/**
 * The move an opponent at this difficulty plays, out of what the search came
 * back with — the best one, or, as often as the difficulty blunders, a weaker
 * one drawn from the shortlist beside it.
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

  const shortlist = nearBestOf(candidates);
  if (shortlist.length === 0) return best.move;

  return drawnFrom(shortlist, best, random()).move;
};
