/**
 * The grade: what the engine makes of a move the moment it has been played, so
 * that a learner is told which move was the problem rather than only that they
 * lost the game.
 *
 * It is one search and not two. The search ranks every move the rules offered in
 * the position the move was played in, each scored from the mover's own side, so
 * the move the engine preferred and the move the player actually played are two
 * entries in one answer and the eval loss is the distance between them. Asking
 * twice — once about the position before the move and once about the position
 * after it — would be asking two different questions and subtracting the answers.
 *
 * It runs the engine at full strength whatever difficulty is being played
 * (ADR-0001), for the same reason a hint does: a grade handed down by the
 * weakened opponent would call the opponent's own mistakes good moves. Where the
 * search runs is handed in, exactly as it is for the hint and the opponent.
 *
 * The bands the loss is read against are calibrated against a corpus of played
 * games rather than picked by intuition, and there is a table of them per phase
 * because the evaluation's units are not the same size in all three;
 * `docs/tuning/grades.md` has the run. No reason is attached to a grade here — a
 * reason may only come from a pattern the engine positively detected
 * (ADR-0003), which is #13's work and not this module's.
 */

import { EVALUATION_LIMIT } from "../ai/evaluation";
import type { ScoredMove } from "../ai/search";
import { type Game, type Move, type Phase, phaseOf } from "../engine/game";
import { FULL_STRENGTH, depthAt } from "../opponent/difficulty";
import type { RunSearch } from "../opponent/opponent";
import type { GradeMove } from "../session/game-session";

/**
 * The five grades, best first. In Hungarian: Legjobb, Jó, Pontatlan, Hiba,
 * Súlyos hiba.
 */
export const GRADES = ["best", "good", "inaccuracy", "mistake", "blunder"] as const;

export type Grade = (typeof GRADES)[number];

/** A band: the least a move has to lose to earn this grade. */
export type Band = {
  readonly grade: Grade;
  readonly loss: number;
};

/**
 * The bands, phase by phase, worst first: what a move has to lose against the
 * move the engine preferred to earn each grade, in the evaluation's own units. A
 * move that lost less than the last of them is the engine's own move or as good
 * as it.
 *
 * **There is a table per phase because the evaluation's units are not the same
 * size in all three.** A piece is worth 8 while pieces are being placed, 100
 * while they move and 300 while they fly, and the other seven terms do not scale
 * with it — so one table read in all three phases means three different scales
 * wearing the same five words. The table that shipped before this was calibrated
 * did exactly that. It was reasoned about in the moving phase and it was close
 * to right there; what it could not do was mean the same thing anywhere else.
 * Its Súlyos hiba began at a third of a piece while flying, so a loss well short
 * of a piece was called as gravely as handing one over — and while placing, its
 * two lower edges were moving-phase numbers landing at the wrong places
 * altogether in a distribution whose median move loses a piece and a quarter.
 *
 * **The numbers came from played games, not from intuition (#12).** An edge sits
 * at a quantile of what a novice's moves actually lose — the median between Jó
 * and Pontatlan, the eightieth between Pontatlan and Hiba, the ninety-fifth
 * between Hiba and Súlyos hiba — measured over a corpus of Kezdő's moves and
 * rounded to a readable number.
 *
 * Two anchors override a quantile where they disagree, because they are what the
 * grades have to *mean* rather than how often they have to fire: a piece handed
 * over while pieces move is Súlyos hiba, and a move that gave up less than a
 * mill in its phase is no worse than Pontatlan. The first of them does override
 * a quantile, and by a long way — the corpus says a novice loses a whole piece
 * on about three of every ten moves it plays while pieces move, so the ninety-
 * fifth sits far above the piece the anchor pins to, and the two edges below are
 * re-read over the moves that lost something but less than the pin. That the
 * losses counted are the ones above nought matters: half a novice's moving moves
 * lose almost nothing, so a subset taking them in would put Pontatlan at nought.
 * The moving phase's table is therefore anchored at the top and measured
 * underneath; the other two are measured throughout, which is where the corpus
 * was needed most — nothing in the placing or the flying phase could be named
 * the way a piece can.
 *
 * `docs/tuning/grades.md` has the corpus, the seeds, the rule, the distribution
 * it produced and how to run it all again.
 */
export const BANDS = {
  placing: [
    { grade: "blunder", loss: 140 },
    { grade: "mistake", loss: 44 },
    { grade: "inaccuracy", loss: 12 },
    { grade: "good", loss: 1 },
  ],
  moving: [
    { grade: "blunder", loss: 100 },
    { grade: "mistake", loss: 40 },
    { grade: "inaccuracy", loss: 20 },
    { grade: "good", loss: 1 },
  ],
  flying: [
    { grade: "blunder", loss: 300 },
    { grade: "mistake", loss: 50 },
    { grade: "inaccuracy", loss: 25 },
    { grade: "good", loss: 1 },
  ],
} as const satisfies Readonly<Record<Phase, readonly Band[]>>;

/**
 * How far behind the mover has to stand for the position to count as already
 * lost, phase by phase. A game the search has seen lost outright scores far
 * below any of them, so one number per phase takes in both — the position that
 * is hopeless and the position that is over bar the playing.
 *
 * These were measured over the same corpus as the bands, against the harder
 * question: not what a move lost but what the game went on to do. Each is the
 * distance behind from which no game in the corpus was ever saved — the reading
 * that survives the corpus's one real weakness, which is that its player is the
 * weakest difficulty and loses from very nearly everywhere. Asking instead where
 * a novice loses nine games in ten answers "from level", which measures Kezdő
 * rather than the position.
 *
 * A number set too low is much the worse mistake, because it would cap an
 * ordinary position at Pontatlan and stop the grading saying anything, so each
 * of these errs outwards. The moving phase's is deep enough that the search has
 * to have seen the loss coming, which is the point: a side that far behind on a
 * five-ply search has lost.
 *
 * **While placing, no distance is hopeless at all.** The corpus was asked at ten
 * distances out to twelve pieces and never found one the game was decided from —
 * a side four pieces behind there is about a mill behind, and eighteen
 * placements is a long time to put it right in. So the placing number is as far
 * as the evaluation can reach, and only a game the search has *seen* lost trips
 * the cap in that phase. Setting it to anything the evaluation can actually
 * produce would be reading the end of the grid the corpus was measured on as
 * though it were the end of the distribution: a hundred is four points past the
 * furthest distance asked about, and three placing moves in ten stand beyond it.
 */
export const LOST_POSITION = {
  placing: EVALUATION_LIMIT,
  moving: 600,
  flying: 450,
} as const satisfies Readonly<Record<Phase, number>>;

/** The worst a move played in a position already lost may be graded. */
const LOST_POSITION_CAP: Grade = "inaccuracy";

/**
 * Whether a grade is the kinder of two, the grades being written best first.
 * The order is what the five words are for, so the comparison belongs here
 * rather than being spelled out again wherever two grades meet.
 */
export const isNoWorseThan = (grade: Grade, than: Grade): boolean =>
  GRADES.indexOf(grade) <= GRADES.indexOf(than);

/** A grade held down to a ceiling. */
const cappedAt = (grade: Grade, cap: Grade): Grade => (isNoWorseThan(grade, cap) ? grade : cap);

/**
 * Whether a score says the game is already lost for the side to move — hopeless
 * by the evaluation, or seen lost outright by the search, which scores an ending
 * far beyond anything an evaluation can reach.
 */
const isLost = (phase: Phase, score: number): boolean => score <= -LOST_POSITION[phase];

/** Which of this phase's bands a loss falls in. */
const gradeAtLoss = (phase: Phase, loss: number): Grade =>
  BANDS[phase].find(({ loss: least }) => loss >= least)?.grade ?? "best";

/**
 * What the engine made of a move: the score of the move it preferred in the
 * position and the score of the move that was played, both from the mover's own
 * side. They are named rather than ordered because two bare numbers either way
 * round would grade a good move as a mistake without complaint.
 */
export type Scores = {
  readonly preferred: number;
  readonly played: number;
};

/**
 * The grade a move earns: the loss between the two scores, read against the
 * bands of the phase the move was played in.
 *
 * A player whose game had already gone before they moved is graded no worse than
 * an inaccuracy: the mistake was made further back, and calling this one a
 * blunder would point at the wrong move. The cap is a ceiling and nothing more,
 * so the best move in a lost position is still the best move.
 */
export const gradeOf = (phase: Phase, { preferred, played }: Scores): Grade => {
  const grade = gradeAtLoss(phase, preferred - played);

  return isLost(phase, preferred) ? cappedAt(grade, LOST_POSITION_CAP) : grade;
};

/**
 * Whether two moves are the same move: the same piece, sent to the same point,
 * taking the same piece. Which piece a mill takes is a decision of its own, so
 * two moves arriving on one point are two different moves.
 *
 * It is exported because the calibration harness has to find a played move
 * among the search's candidates exactly as the grader does; a second copy of
 * this over there could drift from this one without anything noticing.
 */
export const isTheSameMove = (one: Move, other: Move): boolean =>
  one.from === other.from && one.to === other.to && one.capture === other.capture;

/** What the search made of the move actually played, where it ranked it at all. */
const asPlayed = (candidates: readonly ScoredMove[], move: Move): ScoredMove | undefined =>
  candidates.find(({ move: candidate }) => isTheSameMove(candidate, move));

/**
 * An engine to grade moves with, thinking wherever the search it is given
 * thinks. A move the rules left no choice about is not graded — a player forced
 * into it has told nobody anything — and neither is a move the search did not
 * rank, which is a question about a position other than the one it was asked.
 */
export const createGrader =
  (runSearch: RunSearch): GradeMove =>
  async (game: Game, move: Move) => {
    const { candidates } = await runSearch({ game, depth: depthAt(FULL_STRENGTH, game) });

    const [preferred] = candidates;
    if (preferred === undefined || candidates.length < 2) return undefined;

    const played = asPlayed(candidates, move);

    return played && gradeOf(phaseOf(game), { preferred: preferred.score, played: played.score });
  };
