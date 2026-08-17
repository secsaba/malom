/**
 * The search: given a game, the move it prefers and how good the position is.
 *
 * Alpha-beta over negamax, deepened one move at a time. The deepening is for the
 * move ordering it leaves behind: each round starts with what the round before it
 * preferred, and alpha-beta cuts away the most when the best move is tried first.
 * How far it goes is the caller's depth and nothing else — there is no clock in
 * here, and a search that cannot be cut short is a search that answers the same
 * way on every machine (#8).
 *
 * It is synchronous and it holds no state between calls. Nothing here knows what
 * a Web Worker is: the worker (#7) is an adapter that passes a game in and a
 * result out, and everything it calls is this, run in-process and testable
 * without one.
 *
 * It is deterministic — the same game, the same weights and the same depth give
 * the same move, every time, on any machine. Playing a weaker move on purpose is
 * the opponent's difficulty setting (#8) and belongs to choosing a move, not to
 * searching for one; what the weaker difficulties choose among is the ranked root
 * moves this returns alongside the one it prefers.
 */

import { type Game, type Move, type Result, afterMove, legalMovesOf } from "../engine/game";
import type { Side } from "../engine/position";
import { DEFAULT_WEIGHTS, EVALUATION_LIMIT, type Weights, evaluate } from "./evaluation";

/**
 * What a won game scores, seen from the winner. It is a multiple of the furthest
 * an evaluation can reach rather than a number of its own, so that a win always
 * outranks any position that is merely good and a draw's nought always outranks
 * any loss — which is what keeps a game neither side can win from ever being
 * scored as one either side has won.
 */
export const WIN_SCORE = EVALUATION_LIMIT * 10;

/** How far to look. */
export type Limits = {
  /** How many moves deep to search. The first move is depth one. */
  readonly depth?: number;
};

export type SearchOptions = {
  readonly limits?: Limits;
  readonly weights?: Weights;
};

/** A move at the root, with what the search made of the position it leads to. */
export type ScoredMove = {
  readonly move: Move;
  /** How good the position is for the side to move, once this move is played. */
  readonly score: number;
};

/** What the search made of a position. */
export type SearchResult = {
  /** The move it prefers, or nothing at all where the game is already over. */
  readonly move: Move | undefined;
  /** How good the position is for the side to move, once that move is played. */
  readonly evaluation: number;
  /** How many moves deep the answer comes from. Nought, for a game that is over. */
  readonly depth: number;
  /**
   * Every move the rules offer, best first, each with what the last completed
   * round made of it — which is what an opponent playing below its best picks
   * among (#8), and what makes that pick a choice between moves the search has
   * scored rather than a shot in the dark.
   *
   * It is empty exactly when there is no move to prefer, so a caller that reads
   * the first of these reads the same move as {@link SearchResult.move}.
   */
  readonly candidates: readonly ScoredMove[];
};

/** How deep to look when the caller does not say. */
const DEFAULT_DEPTH = 4;

/**
 * What a finished game is worth to the side to move. A win is worth less the
 * further off it is, so the search takes the shortest win and the longest loss
 * rather than dawdling in front of one; a draw is worth exactly nothing, which is
 * both better than every loss and worse than every win.
 */
const scoreOf = (result: Result, sideToMove: Side, ply: number): number => {
  if ("draw" in result) return 0;

  return result.winner === sideToMove ? WIN_SCORE - ply : lostAt(ply);
};

/**
 * What a game lost this far from the root is worth to the side that lost it.
 *
 * A side to move with nothing to play has been shut in, and a side shut in has
 * lost — so a game offering no move scores this too. The rules end such a game as
 * it is handed over, which means only a position built by hand rather than played
 * into being ever arrives here with no result on it; the answer is still the one
 * the rules would have given, rather than a guess at how the board looks.
 */
const lostAt = (ply: number): number => ply - WIN_SCORE;

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

  const negamax = (node: Game, depth: number, alpha: number, beta: number, ply: number): number => {
    if (node.result) return scoreOf(node.result, node.sideToMove, ply);
    if (depth === 0) return evaluate(node, weights);

    const moves = capturesFirst(legalMovesOf(node));
    if (moves.length === 0) return lostAt(ply);

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
  const rootRound = (moves: readonly Move[], depth: number): readonly ScoredMove[] => {
    const scored = moves.map((move) => ({
      move,
      score: 0 - negamax(afterMove(game, move), depth - 1, -Infinity, Infinity, 1),
    }));

    // Descending, stably, so the next round starts with what this one preferred
    // and ties keep the order the rules generated them in.
    return [...scored].sort((one, other) => other.score - one.score);
  };

  const legal = capturesFirst(legalMovesOf(game));
  const [first] = legal;
  if (first === undefined) {
    return {
      move: undefined,
      evaluation: game.result ? scoreOf(game.result, game.sideToMove, 0) : lostAt(0),
      depth: 0,
      candidates: [],
    };
  }

  // What stands before a round has finished, which only a maximum depth below
  // one could leave standing. An answer with a move in it always has that move
  // among its candidates, which is what lets a caller read the two as saying the
  // same thing.
  let result: SearchResult = {
    move: first,
    evaluation: 0,
    depth: 0,
    candidates: [{ move: first, score: 0 }],
  };
  let order = legal;

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const round = rootRound(order, depth);
    const [best] = round;
    if (!best) break;

    result = { move: best.move, evaluation: best.score, depth, candidates: round };
    order = round.map((scored) => scored.move);
  }

  return result;
};
