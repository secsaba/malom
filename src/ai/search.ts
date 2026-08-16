/**
 * The search: given a game, the move it prefers and how good the position is.
 *
 * Alpha-beta over negamax, deepened one move at a time. Each round of deepening
 * finishes before its answer is taken, so a search cut short by its time bound
 * still returns the best move of the last depth it completed rather than half of
 * the next one.
 *
 * It is synchronous and it holds no state between calls. Nothing here knows what
 * a Web Worker is: the worker (#7) is an adapter that passes a game in and a
 * result out, and everything it calls is this, run in-process and testable
 * without one.
 *
 * It is deterministic — the same game and the same weights give the same move,
 * every time. Playing a weaker move on purpose is the opponent's difficulty
 * setting (#7) and belongs to choosing a move, not to searching for one.
 */

import { type Game, type Move, type Result, afterMove, legalMovesOf } from "../engine/game";
import type { Side } from "../engine/position";
import { DEFAULT_WEIGHTS, type Weights, evaluate } from "./evaluation";

/**
 * What a won game scores, seen from the winner. It is far above the evaluation's
 * own limit, so a win always outranks any position that is merely good and a
 * draw's nought always outranks any loss — which is what keeps a position
 * neither side can win from being scored as one either side has won.
 */
export const WIN_SCORE = 1_000_000;

/** How far to look, and when to give up looking. */
export type Limits = {
  /** How many moves deep to search. The first move is depth one. */
  readonly depth?: number;
  /**
   * Asked as the search runs. Once it answers true the search stops at the end
   * of the depth it has already completed. It is passed in rather than read off
   * a clock here so that the search stays pure, and so that a test can stop it
   * at a chosen point instead of at a chosen time.
   */
  readonly shouldStop?: () => boolean;
};

export type SearchOptions = {
  readonly limits?: Limits;
  readonly weights?: Weights;
};

/** What the search made of a position. */
export type SearchResult = {
  /** The move it prefers, or nothing at all where the game is already over. */
  readonly move: Move | undefined;
  /** How good the position is for the side to move, once that move is played. */
  readonly evaluation: number;
  /** How many moves deep the answer comes from. Nought, for a game that is over. */
  readonly depth: number;
};

/** How deep to look when the caller does not say. */
const DEFAULT_DEPTH = 4;

/** How many nodes to search between two askings of {@link Limits.shouldStop}. */
const NODES_BETWEEN_CHECKS = 512;

/** Thrown to unwind a search the caller has asked to stop, and caught where it began. */
const ABANDONED = Symbol("abandoned search");

/**
 * What a finished game is worth to the side to move. A win is worth less the
 * further off it is, so the search takes the shortest win and the longest loss
 * rather than dawdling in front of one; a draw is worth exactly nothing, which is
 * both better than every loss and worse than every win.
 */
const scoreOf = (result: Result, sideToMove: Side, ply: number): number => {
  if ("draw" in result) return 0;

  return result.winner === sideToMove ? WIN_SCORE - ply : ply - WIN_SCORE;
};

/**
 * Moves worth looking at first. A move that takes a piece is the likeliest to be
 * the best one, and the sooner the best move is tried the more of the rest the
 * search can leave unexamined. The sort is stable, so everything else keeps the
 * order the rules generated it in and the search stays deterministic.
 */
const capturesFirst = (moves: readonly Move[]): readonly Move[] =>
  [...moves].sort(
    (one, other) => Number(other.capture !== undefined) - Number(one.capture !== undefined),
  );

/**
 * The move the engine prefers in this game, and what it thinks of the position.
 *
 * A game that is over has no move to prefer, and is scored as the ending or the
 * draw that finished it.
 */
export const search = (game: Game, options: SearchOptions = {}): SearchResult => {
  const { limits = {}, weights = DEFAULT_WEIGHTS } = options;
  const maxDepth = Math.max(1, Math.floor(limits.depth ?? DEFAULT_DEPTH));

  let nodesToNextCheck = NODES_BETWEEN_CHECKS;
  // The first round is never abandoned. Whatever the caller's hurry, an answer
  // one move deep is what makes the difference between a move and no move.
  let stoppable = false;

  const checkStop = () => {
    if (!stoppable) return;

    nodesToNextCheck -= 1;
    if (nodesToNextCheck > 0) return;

    nodesToNextCheck = NODES_BETWEEN_CHECKS;
    if (limits.shouldStop?.()) throw ABANDONED;
  };

  const negamax = (node: Game, depth: number, alpha: number, beta: number, ply: number): number => {
    if (node.result) return scoreOf(node.result, node.sideToMove, ply);
    if (depth === 0) return evaluate(node, weights);

    checkStop();

    const moves = capturesFirst(legalMovesOf(node));
    // The rules end a game the side to move cannot play, so this is only reached
    // by a game built by hand rather than played into being. Weigh it as it is.
    if (moves.length === 0) return evaluate(node, weights);

    let best = -Infinity;
    let window = alpha;

    for (const move of moves) {
      // Subtracted from nothing rather than negated, so that a drawn line comes
      // back as nought and not as negative nought.
      const score = 0 - negamax(afterMove(node, move), depth - 1, 0 - beta, 0 - window, ply + 1);

      if (score > best) best = score;
      if (best > window) window = best;
      if (window >= beta) break;
    }

    return best;
  };

  /** One round of deepening, played out over every move at the root. */
  const rootRound = (moves: readonly Move[], depth: number) => {
    const scored = moves.map((move) => ({
      move,
      score: 0 - negamax(afterMove(game, move), depth - 1, -Infinity, Infinity, 1),
    }));

    // Descending, stably, so the next round starts with what this one preferred
    // and ties keep the order the rules generated them in.
    return [...scored].sort((one, other) => other.score - one.score);
  };

  const legal = capturesFirst(legalMovesOf(game));
  if (legal.length === 0) {
    return {
      move: undefined,
      evaluation: game.result
        ? scoreOf(game.result, game.sideToMove, 0)
        : evaluate(game, weights),
      depth: 0,
    };
  }

  let result: SearchResult = { move: legal[0], evaluation: 0, depth: 0 };
  let order = legal;

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    try {
      const round = rootRound(order, depth);
      const [best] = round;
      if (!best) break;

      result = { move: best.move, evaluation: best.score, depth };
      order = round.map((scored) => scored.move);
      stoppable = true;
    } catch (thrown) {
      if (thrown !== ABANDONED) throw thrown;
      // The round was cut short, so its scores are worth nothing; the last one
      // that finished stands.
      break;
    }
  }

  return result;
};
