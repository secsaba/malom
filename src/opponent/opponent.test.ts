import { afterEach, describe, expect, it, vi } from "vitest";

import { gameOf } from "../../tests/fixtures/games";
import type { SearchResult } from "../ai/search";
import { NEW_GAME } from "../engine/game";
import {
  type RunSearch,
  type SearchRequest,
  SEARCH_DEPTH,
  THINKING_TIME,
  createOpponent,
  limitsOf,
  searchInProcess,
} from "./opponent";

/** A search that has already made up its mind. */
const answering = (result: SearchResult): RunSearch => () => Promise.resolve(result);

const A_MOVE: SearchResult = { move: { to: "d2" }, evaluation: 12, depth: 3 };

afterEach(() => {
  vi.useRealTimers();
});

describe("the opponent", () => {
  it("plays the move the search came back with", async () => {
    const chooseMove = createOpponent(answering(A_MOVE), { minimumDelay: 0 });

    expect(await chooseMove(NEW_GAME)).toEqual({ to: "d2" });
  });

  it("asks about the game in front of it, at the depth and the time it plays at", async () => {
    const asked: SearchRequest[] = [];
    const chooseMove = createOpponent((request) => {
      asked.push(request);
      return Promise.resolve(A_MOVE);
    }, { minimumDelay: 0 });

    await chooseMove(NEW_GAME);

    expect(asked).toEqual([
      { game: NEW_GAME, depth: SEARCH_DEPTH, thinkingTime: THINKING_TIME },
    ]);
  });

  it("holds a move that took no time at all back, so it never merely flickers", async () => {
    vi.useFakeTimers();
    const chooseMove = createOpponent(answering(A_MOVE), { minimumDelay: 500 });
    let played = false;

    void chooseMove(NEW_GAME).then(() => {
      played = true;
    });

    await vi.advanceTimersByTimeAsync(499);
    expect(played).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(played).toBe(true);
  });

  it("waits no longer than the search itself once that is the slower of the two", async () => {
    vi.useFakeTimers();
    const chooseMove = createOpponent(
      () => new Promise<SearchResult>((resolve) => setTimeout(() => resolve(A_MOVE), 900)),
      { minimumDelay: 500 },
    );
    let played = false;

    void chooseMove(NEW_GAME).then(() => {
      played = true;
    });

    await vi.advanceTimersByTimeAsync(899);
    expect(played).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(played).toBe(true);
  });
});

describe("the time a search is given", () => {
  it("passes the depth to the search untouched", () => {
    expect(limitsOf({ game: NEW_GAME, depth: 5, thinkingTime: 400 }).depth).toBe(5);
  });

  it("is up before a search given none of it has looked at anything", () => {
    const { shouldStop } = limitsOf({ game: NEW_GAME, depth: 5, thinkingTime: 0 });

    expect(shouldStop?.()).toBe(true);
  });

  it("is not up while there is still some of it left", () => {
    const { shouldStop } = limitsOf({ game: NEW_GAME, depth: 5, thinkingTime: 10_000 });

    expect(shouldStop?.()).toBe(false);
  });
});

describe("the search the opponent runs in this process", () => {
  it("is the engine itself: it closes the mill in front of it", async () => {
    // Light holds a1 and d1, so g1 makes a mill and earns a capture; dark's a4
    // and d2 kill the other line through each of light's pieces.
    const game = gameOf({
      light: ["a1", "d1"],
      dark: ["a4", "d2"],
      sideToMove: "light",
      piecesInHand: { light: 7, dark: 7 },
    });

    const { move } = await searchInProcess({ game, depth: 3, thinkingTime: THINKING_TIME });

    expect(move?.to).toBe("g1");
    expect(move?.capture).toBeDefined();
  });
});
