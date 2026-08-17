import { describe, expect, it } from "vitest";

import type { SearchResult } from "../ai/search";
import { NEW_GAME, type Game, type Phase, phaseOf } from "../engine/game";
import { DIFFICULTIES, DIFFICULTY_SETTINGS, depthAt } from "../opponent/difficulty";
import type { RunSearch, SearchRequest } from "../opponent/opponent";
import { gameOf } from "../../tests/fixtures/games";
import { createHint } from "./hint";

/**
 * One game in each phase, so what a hint asks for can be read off all three. The
 * two past the placing phase are positions a game reaches: both sides have their
 * pieces down, and the flying one is light worn to the three pieces the rules let
 * jump.
 */
const IN_EACH_PHASE: Readonly<Record<Phase, Game>> = {
  placing: NEW_GAME,
  moving: gameOf({
    light: ["a1", "a4", "a7", "b2"],
    dark: ["g1", "g4", "g7", "f6"],
    sideToMove: "light",
  }),
  flying: gameOf({
    light: ["a1", "a4", "a7"],
    dark: ["g1", "g4", "g7", "f6"],
    sideToMove: "light",
  }),
};

/** What the search comes back with when a test does not care what is in it. */
const A_RESULT: SearchResult = {
  move: { to: "d2" },
  evaluation: 12,
  depth: 4,
  candidates: [{ move: { to: "d2" }, score: 12 }],
};

/**
 * A search that writes down what it was asked and answers with what the test
 * wrote down, so that what a hint asks for can be read without searching
 * anything.
 */
const askedSearch = (result: SearchResult = A_RESULT) => {
  const asked: SearchRequest[] = [];

  const runSearch: RunSearch = (request) => {
    asked.push(request);
    return Promise.resolve(result);
  };

  return { asked, runSearch };
};

describe("the hint the engine offers", () => {
  it("is the move the search prefers", async () => {
    const search = askedSearch();

    expect(await createHint(search.runSearch)(NEW_GAME)).toEqual({ to: "d2" });
    expect(search.asked[0]?.game).toBe(NEW_GAME);
  });

  it("is nothing at all where the search found no move to prefer", async () => {
    const search = askedSearch({ move: undefined, evaluation: 0, depth: 0, candidates: [] });

    expect(await createHint(search.runSearch)(NEW_GAME)).toBeUndefined();
  });

  /** ADR-0001: the engine that teaches is never the weakened one that plays. */
  it("is searched for as deeply as the strongest difficulty looks, in every phase", async () => {
    for (const [phase, game] of Object.entries(IN_EACH_PHASE)) {
      const search = askedSearch();
      expect(phaseOf(game), phase).toBe(phase);

      await createHint(search.runSearch)(game);

      expect(search.asked[0]?.depth, phase).toBe(DIFFICULTY_SETTINGS.master.depth[phase as Phase]);
    }
  });

  it("is never searched for less deeply than the computer plays at any difficulty", () => {
    for (const [phase, game] of Object.entries(IN_EACH_PHASE)) {
      for (const difficulty of DIFFICULTIES) {
        expect(depthAt("master", game), `${difficulty} in ${phase}`).toBeGreaterThanOrEqual(
          depthAt(difficulty, game),
        );
      }
    }
  });
});
