/**
 * The opponent: the computer as a player.
 *
 * What it takes to answer "what would you play here" lives here — how deep to
 * look, which of the moves it looked at to play, and how long to hold the answer
 * back so a move that took no time at all still arrives as a move rather than as
 * a flicker. Where the search actually runs does not: it is handed in, so the
 * same opponent thinks in a Web Worker in the browser and in this process in a
 * test.
 *
 * How strongly it plays is a difficulty (#8), asked for with every move rather
 * than fixed when the opponent is made — which is what lets a player change it
 * in the middle of a game. The depth comes from the difficulty and the choice
 * among the moves the search ranked comes from it too; nothing here decides
 * either, and `./difficulty` decides both.
 *
 * There is no clock anywhere in this. A search bounded by time answers one thing
 * on a desktop and another on a phone, and an opponent whose moves depend on the
 * machine it runs on cannot be the fixed thing a learner measures themselves
 * against. It is bounded by depth alone, at depths chosen per phase so that even
 * the widest position the board reaches is answered inside about half a second.
 */

import { type SearchResult, search } from "../ai/search";
import type { Game } from "../engine/game";
import type { ChooseMove } from "../session/game-session";
import { type Difficulty, depthAt, moveAtDifficulty } from "./difficulty";

/**
 * How long its move is held back, in milliseconds, however quickly it was found.
 * An opponent that answers instantly reads as a board that moved by itself; the
 * pause is what makes it read as somebody playing.
 */
export const MINIMUM_DELAY = 500;

/** A question for the search: a game, and how far to look into it. */
export type SearchRequest = {
  readonly game: Game;
  readonly depth: number;
};

/** A search run somewhere — in this process, or off the thread in a worker. */
export type RunSearch = (request: SearchRequest) => Promise<SearchResult>;

/** What the worker is sent. The id is what pairs an answer with its question. */
export type WorkerRequest = SearchRequest & { readonly id: number };

/** What the worker sends back. */
export type WorkerReply = { readonly id: number; readonly result: SearchResult };

/** The search, run here and now. It is what the worker runs too. */
export const searchInProcess: RunSearch = ({ game, depth }) =>
  Promise.resolve(search(game, { limits: { depth } }));

export type OpponentOptions = {
  readonly minimumDelay?: number;
  /**
   * Where the weaker difficulties' mistakes come from. Handed in rather than
   * reached for, so that a test can hold it still.
   */
  readonly random?: () => number;
};

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/**
 * An opponent that answers with a move at the difficulty it is asked to play at,
 * no sooner than the minimum delay. The search and the delay run alongside each
 * other, so thinking for longer than the delay costs nothing beyond the thinking.
 */
export const createOpponent = (runSearch: RunSearch, options: OpponentOptions = {}): ChooseMove => {
  const { minimumDelay = MINIMUM_DELAY, random = Math.random } = options;

  return async (game: Game, difficulty: Difficulty) => {
    // The depth is settled here rather than where the search runs, so that what
    // crosses into the worker stays the plain question of how deep to look.
    const depth = depthAt(difficulty, game);

    const [result] = await Promise.all([runSearch({ game, depth }), wait(minimumDelay)]);

    return moveAtDifficulty(difficulty, result.candidates, random);
  };
};
