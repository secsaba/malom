import { describe, expect, it } from "vitest";

import type { ScoredMove, SearchResult } from "../ai/search";
import { type Game, NEW_GAME, type Phase, phaseOf } from "../engine/game";
import { DIFFICULTY_SETTINGS } from "../opponent/difficulty";
import type { RunSearch, SearchRequest } from "../opponent/opponent";
import { gameOf } from "../../tests/fixtures/games";
import { createAssessor } from "./assessment";
import { BANDS } from "./grade";

/** One game in each phase, so what assessing asks for can be read off all three. */
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

/**
 * A search that writes down what it was asked and answers with the moves the
 * test ranked, best first — which is the order the search itself hands them back
 * in, and the only thing assessing reads off them.
 */
const rankedSearch = (candidates: readonly ScoredMove[]) => {
  const asked: SearchRequest[] = [];
  const result: SearchResult = {
    move: candidates[0]?.move,
    evaluation: candidates[0]?.score ?? 0,
    depth: 4,
    candidates,
  };

  const runSearch: RunSearch = (request) => {
    asked.push(request);
    return Promise.resolve(result);
  };

  return { asked, runSearch };
};

describe("what the engine makes of the move a player has just played", () => {
  it("weighs it against the moves the engine ranked in the position it was played in", async () => {
    const search = rankedSearch([
      { move: { to: "d2" }, score: 30 },
      { move: { to: "a1" }, score: 30 - BANDS.placing[0].loss },
    ]);

    const assessed = await createAssessor(search.runSearch)(NEW_GAME, { to: "a1" });

    expect(assessed?.grade).toBe(BANDS.placing[0].grade);
    expect(search.asked[0]?.game).toBe(NEW_GAME);
  });

  it("calls the move the engine preferred the best one", async () => {
    const search = rankedSearch([
      { move: { to: "d2" }, score: 30 },
      { move: { to: "a1" }, score: -900 },
    ]);

    expect((await createAssessor(search.runSearch)(NEW_GAME, { to: "d2" }))?.grade).toBe("best");
  });

  /**
   * The grade, the patterns and the reason are worked out apart and put together
   * here, so a test that read only the grade would not notice them being put
   * together wrongly — the played move sent to the detectors as the preferred
   * one, or the reason built round the wrong move of the two. This reads all
   * three off a real position.
   */
  it("puts the grade, what it detected and the reason together about the move played", async () => {
    const search = rankedSearch([
      { move: { to: "d2" }, score: 30 },
      { move: { to: "a1" }, score: 30 },
    ]);
    const assess = createAssessor(search.runSearch);

    // a1 is a corner and the first piece on the board: nothing is there to see,
    // so the reason falls back to the move the engine would have played.
    expect(await assess(NEW_GAME, { to: "a1" })).toEqual({
      grade: "best",
      patterns: [],
      reason: { kind: "prefers", move: { to: "d2" } },
    });

    // d2 is one of the four intersections, which is something to see.
    expect(await assess(NEW_GAME, { to: "d2" })).toEqual({
      grade: "best",
      patterns: ["intersection-taken"],
      reason: { kind: "pattern", pattern: "intersection-taken" },
    });
  });

  /** A move nobody had a choice about says nothing about the player who played it. */
  it("gives no grade where the rules offered one move and no other", async () => {
    const search = rankedSearch([{ move: { from: "a1", to: "a4" }, score: 30 }]);

    expect(await createAssessor(search.runSearch)(NEW_GAME, { from: "a1", to: "a4" })).toBeUndefined();
  });

  it("gives no grade where the search ranked nothing at all", async () => {
    const search = rankedSearch([]);

    expect(await createAssessor(search.runSearch)(NEW_GAME, { to: "a1" })).toBeUndefined();
  });

  /**
   * Which piece to take is a decision of its own, so two moves arriving on the
   * same point are two moves and are told apart by the piece they took.
   */
  it("tells one capture from another out of the same arrival", async () => {
    const search = rankedSearch([
      { move: { to: "g1", capture: "a7" }, score: 30 },
      { move: { to: "g1", capture: "d7" }, score: 30 - BANDS.placing[0].loss },
    ]);
    const assess = createAssessor(search.runSearch);

    expect((await assess(NEW_GAME, { to: "g1", capture: "a7" }))?.grade).toBe("best");
    expect((await assess(NEW_GAME, { to: "g1", capture: "d7" }))?.grade).toBe(
      BANDS.placing[0].grade,
    );
  });

  it("gives no grade for a move the search did not rank", async () => {
    const search = rankedSearch([
      { move: { to: "d2" }, score: 30 },
      { move: { to: "a1" }, score: 10 },
    ]);

    expect(await createAssessor(search.runSearch)(NEW_GAME, { to: "g7" })).toBeUndefined();
  });

  /**
   * The bands belong to the phase, so the grader reads them off the game it was
   * handed rather than off one table for the whole match. The same two scores
   * are a blunder while pieces are being placed, where a piece is worth 8, and
   * are not one while they fly, where a piece is worth 300.
   */
  it("reads the bands of the phase the move was played in", async () => {
    const candidates: readonly ScoredMove[] = [
      { move: { to: "d2" }, score: 0 },
      { move: { to: "a1" }, score: -BANDS.placing[0].loss },
    ];

    expect(
      (await createAssessor(rankedSearch(candidates).runSearch)(NEW_GAME, { to: "a1" }))?.grade,
    ).toBe("blunder");
    expect(
      (await createAssessor(rankedSearch(candidates).runSearch)(IN_EACH_PHASE.flying, { to: "a1" }))
        ?.grade,
    ).not.toBe("blunder");
  });

  /** ADR-0001: the engine that teaches is never the weakened one that plays. */
  it("is searched for as deeply as the strongest difficulty looks, in every phase", async () => {
    for (const [phase, game] of Object.entries(IN_EACH_PHASE)) {
      const search = rankedSearch([{ move: { to: "d2" }, score: 0 }]);
      expect(phaseOf(game), phase).toBe(phase);

      await createAssessor(search.runSearch)(game, { to: "d2" });

      expect(search.asked[0]?.depth, phase).toBe(DIFFICULTY_SETTINGS.master.depth[phase as Phase]);
    }
  });
});
