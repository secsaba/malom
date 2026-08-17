/**
 * The hint: the move the engine prefers in the position in front of the player,
 * worked out because they asked for it.
 *
 * It is the engine at full strength and never anything less (ADR-0001). A hint
 * that came from the weakened opponent the player chose would recommend moves
 * the same app grades as mistakes, and a learner cannot be taught by two
 * different opinions. So no difficulty is passed in here — there is nothing to
 * pass it to — and how deep full strength looks is read off the strongest
 * difficulty's own table rather than written down again, which is what stops the
 * two drifting apart the next time Mester is deepened.
 *
 * Where the search runs is handed in, exactly as it is for the opponent: the same
 * thread thinks about both, and this module knows no more about it than the
 * opponent does. What it holds is the one judgement a hint needs — how far to
 * look — and the answer to the only question it asks.
 */

import type { Game } from "../engine/game";
import { FULL_STRENGTH, depthAt } from "../opponent/difficulty";
import type { RunSearch } from "../opponent/opponent";
import type { ChooseHint } from "../session/game-session";

/**
 * An engine to ask for hints, thinking wherever the search it is given thinks. A
 * game with no move in it — one already over — is answered with nothing, which
 * the interface reads as there being nothing to show.
 */
export const createHint =
  (runSearch: RunSearch): ChooseHint =>
  async (game: Game) => {
    const { move } = await runSearch({ game, depth: depthAt(FULL_STRENGTH, game) });

    return move;
  };
