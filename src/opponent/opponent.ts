/**
 * The opponent: the computer as a player.
 *
 * What it takes to answer "what would you play here" lives here — how deep to
 * look, how long it may look for, and how long to hold the answer back so a move
 * that took no time at all still arrives as a move rather than as a flicker.
 * Where the search actually runs does not: it is handed in, so the same opponent
 * thinks in a Web Worker in the browser and in this process in a test.
 *
 * How strongly it plays is one setting rather than four (#8): there is a single
 * depth and a single thinking time here, and no move is ever weakened on purpose.
 */

import { type Limits, type SearchResult, search } from "../ai/search";
import type { Game } from "../engine/game";
import type { ChooseMove } from "../session/game-session";

/**
 * How far the opponent looks. It is a ceiling rather than a promise: the search
 * deepens one move at a time and takes the last depth it finished, so what it
 * reaches is whatever {@link THINKING_TIME} allows — around four moves while
 * pieces are being placed and there is most to look at, more once they are down.
 */
export const SEARCH_DEPTH = 6;

/** How long it may look, in milliseconds. */
export const THINKING_TIME = 400;

/**
 * How long its move is held back, in milliseconds, however quickly it was found.
 * An opponent that answers instantly reads as a board that moved by itself; the
 * pause is what makes it read as somebody playing.
 */
export const MINIMUM_DELAY = 500;

/** A question for the search: a game, and how much looking it is worth. */
export type SearchRequest = {
  readonly game: Game;
  readonly depth: number;
  readonly thinkingTime: number;
};

/** A search run somewhere — in this process, or off the thread in a worker. */
export type RunSearch = (request: SearchRequest) => Promise<SearchResult>;

/** What the worker is sent. The id is what pairs an answer with its question. */
export type WorkerRequest = SearchRequest & { readonly id: number };

/** What the worker sends back. */
export type WorkerReply = { readonly id: number; readonly result: SearchResult };

/**
 * The limits a request comes to, built where the search is about to run: a
 * deadline is a clock, and a clock cannot be posted to a worker. The search
 * itself reads no clock at all, which is what keeps it deterministic under a
 * fixed depth.
 */
export const limitsOf = ({ depth, thinkingTime }: SearchRequest): Limits => {
  const until = Date.now() + thinkingTime;

  return { depth, shouldStop: () => Date.now() >= until };
};

/** The search, run here and now. It is what the worker runs too. */
export const searchInProcess: RunSearch = (request) =>
  Promise.resolve(search(request.game, { limits: limitsOf(request) }));

export type OpponentOptions = {
  readonly depth?: number;
  readonly thinkingTime?: number;
  readonly minimumDelay?: number;
};

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/**
 * An opponent that answers with the move the given search prefers, no sooner
 * than the minimum delay. The two run alongside each other, so thinking for
 * longer than the delay costs nothing beyond the thinking.
 */
export const createOpponent = (runSearch: RunSearch, options: OpponentOptions = {}): ChooseMove => {
  const {
    depth = SEARCH_DEPTH,
    thinkingTime = THINKING_TIME,
    minimumDelay = MINIMUM_DELAY,
  } = options;

  return async (game) => {
    const [result] = await Promise.all([
      runSearch({ game, depth, thinkingTime }),
      wait(minimumDelay),
    ]);

    return result.move;
  };
};
