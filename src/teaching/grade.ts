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
 * The bands the loss is read against are provisional (#12). No reason is
 * attached to a grade here — a reason may only come from a pattern the engine
 * positively detected (ADR-0003), which is #13's work and not this module's.
 */

import type { ScoredMove } from "../ai/search";
import type { Game, Move } from "../engine/game";
import { FULL_STRENGTH, depthAt } from "../opponent/difficulty";
import type { RunSearch } from "../opponent/opponent";
import type { GradeMove } from "../session/game-session";

/**
 * The five grades, best first. In Hungarian: Legjobb, Jó, Pontatlan, Hiba,
 * Súlyos hiba.
 */
export const GRADES = ["best", "good", "inaccuracy", "mistake", "blunder"] as const;

export type Grade = (typeof GRADES)[number];

/**
 * The bands: what a move has to lose against the move the engine preferred to
 * earn each grade, worst first, in the evaluation's own units. A move that lost
 * less than the last of them is the engine's own move or as good as it.
 *
 * PROVISIONAL (#12). They are placed around the two losses that can be named in
 * the moving phase, where a piece is worth a hundred and a mill about a third of
 * that: a piece handed over is a Súlyos hiba and a mill missed is short of one.
 * One table is read in all three phases, and the evaluation's units are not the
 * same size in all three — a piece is worth 8 while pieces are being placed and
 * 300 while they fly — so the same loss means more in one phase than in another,
 * which is among the things calibrating these against played games has to settle.
 */
export const GRADE_LOSSES = [
  { grade: "blunder", loss: 100 },
  { grade: "mistake", loss: 50 },
  { grade: "inaccuracy", loss: 20 },
  { grade: "good", loss: 1 },
] as const satisfies readonly { readonly grade: Grade; readonly loss: number }[];

/**
 * How far behind the mover has to stand for the position to count as already
 * lost: two pieces' worth in the moving phase. A game the search has seen lost
 * outright scores far below this, so one number takes in both — the position
 * that is hopeless and the position that is over bar the playing.
 *
 * PROVISIONAL (#12), like the bands above it.
 */
export const LOST_POSITION = 200;

/** The worst a move played in a position already lost may be graded. */
const LOST_POSITION_CAP: Grade = "inaccuracy";

/** Which of two grades is the kinder one, the grades being written best first. */
const cappedAt = (grade: Grade, cap: Grade): Grade =>
  GRADES.indexOf(grade) > GRADES.indexOf(cap) ? cap : grade;

/**
 * Whether a score says the game is already lost for the side to move — hopeless
 * by the evaluation, or seen lost outright by the search, which scores an ending
 * far beyond anything an evaluation can reach.
 */
const isLost = (score: number): boolean => score <= -LOST_POSITION;

/** Which band a loss falls in. */
const gradeAtLoss = (loss: number): Grade =>
  GRADE_LOSSES.find(({ loss: least }) => loss >= least)?.grade ?? "best";

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
 * bands.
 *
 * A player whose game had already gone before they moved is graded no worse than
 * an inaccuracy: the mistake was made further back, and calling this one a
 * blunder would point at the wrong move. The cap is a ceiling and nothing more,
 * so the best move in a lost position is still the best move.
 */
export const gradeOf = ({ preferred, played }: Scores): Grade => {
  const grade = gradeAtLoss(preferred - played);

  return isLost(preferred) ? cappedAt(grade, LOST_POSITION_CAP) : grade;
};

/**
 * Whether two moves are the same move: the same piece, sent to the same point,
 * taking the same piece. Which piece a mill takes is a decision of its own, so
 * two moves arriving on one point are two different moves.
 */
const isTheSame = (one: Move, other: Move): boolean =>
  one.from === other.from && one.to === other.to && one.capture === other.capture;

/** What the search made of the move actually played, where it ranked it at all. */
const asPlayed = (candidates: readonly ScoredMove[], move: Move): ScoredMove | undefined =>
  candidates.find(({ move: candidate }) => isTheSame(candidate, move));

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

    return played && gradeOf({ preferred: preferred.score, played: played.score });
  };
