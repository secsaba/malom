/**
 * The assessment: everything the engine has to say about a move once it has been
 * played — what it cost, what it did, and which one of those the player is told.
 *
 * The three are worked out independently and on purpose. The grade comes from
 * the search, in the evaluation's own units; the patterns come from the rules,
 * and are either on the board or are not; the reason is the choice between them.
 * Nothing here infers a pattern from a grade or a grade from a pattern, which is
 * what keeps a reason something the engine detected rather than something it
 * assumed from a number (ADR-0003).
 *
 * It runs the engine at full strength whatever difficulty is being played
 * (ADR-0001), for the same reason a hint does: a verdict handed down by the
 * weakened opponent would call the opponent's own mistakes good moves. Where the
 * search runs is handed in, exactly as it is for the hint and the opponent.
 */

import type { ScoredMove } from "../ai/search";
import { type Game, type Move, phaseOf } from "../engine/game";
import { FULL_STRENGTH, depthAt } from "../opponent/difficulty";
import type { RunSearch } from "../opponent/opponent";
import type { AssessMove } from "../session/game-session";
import { type Grade, gradeOf, isTheSameMove } from "./grade";
import { type Pattern, patternsIn } from "./patterns";
import { type Reason, reasonFor } from "./reason";

/**
 * What the engine made of a move: the grade, everything it detected in the move,
 * and the one thing the player is told.
 *
 * The patterns are carried whole rather than only the one the reason names,
 * because a game is more than a move: the summary at the end of it counts which
 * mistake the player keeps making, and a criticism that went unsaid on the move
 * it happened on is still one they made.
 */
export type Assessment = {
  readonly grade: Grade;
  /** Everything the engine detected, in the order the catalogue ranks it. */
  readonly patterns: readonly Pattern[];
  readonly reason: Reason;
};

/** What the search made of the move actually played, where it ranked it at all. */
const asPlayed = (candidates: readonly ScoredMove[], move: Move): ScoredMove | undefined =>
  candidates.find(({ move: candidate }) => isTheSameMove(candidate, move));

/**
 * An engine to assess moves with, thinking wherever the search it is given
 * thinks. A move the rules left no choice about is not assessed — a player
 * forced into it has told nobody anything — and neither is a move the search did
 * not rank, which is a question about a position other than the one it was
 * asked.
 */
export const createAssessor =
  (runSearch: RunSearch): AssessMove =>
  async (game: Game, move: Move) => {
    const { candidates } = await runSearch({ game, depth: depthAt(FULL_STRENGTH, game) });

    const [preferred] = candidates;
    if (preferred === undefined || candidates.length < 2) return undefined;

    const played = asPlayed(candidates, move);
    if (played === undefined) return undefined;

    const grade = gradeOf(phaseOf(game), { preferred: preferred.score, played: played.score });
    const patterns = patternsIn(game, move);

    return { grade, patterns, reason: reasonFor(grade, patterns, { played: move, preferred: preferred.move }) };
  };
