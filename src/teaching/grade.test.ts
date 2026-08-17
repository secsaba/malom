import { describe, expect, it } from "vitest";

import { DEFAULT_WEIGHTS } from "../ai/evaluation";
import { type ScoredMove, type SearchResult, WIN_SCORE } from "../ai/search";
import { type Game, NEW_GAME, type Phase, phaseOf } from "../engine/game";
import { DIFFICULTY_SETTINGS } from "../opponent/difficulty";
import type { RunSearch, SearchRequest } from "../opponent/opponent";
import { gameOf } from "../../tests/fixtures/games";
import { GRADES, GRADE_LOSSES, LOST_POSITION, createGrader, gradeOf } from "./grade";

/** One game in each phase, so what grading asks for can be read off all three. */
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
 * in, and the only thing grading reads off them.
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

describe("what the engine makes of a move", () => {
  it("calls the move it would have played itself the best one", () => {
    expect(gradeOf({ preferred: 40, played: 40 })).toBe("best");
  });

  it("grades a move by what it lost against the move the engine preferred", () => {
    for (const { grade, loss } of GRADE_LOSSES) {
      expect(gradeOf({ preferred: 0, played: -loss }), grade).toBe(grade);
    }
  });

  it("puts a move that lost less than a band asks for in the band above it", () => {
    for (const { grade, loss } of GRADE_LOSSES) {
      const better = GRADES[GRADES.indexOf(grade) - 1];

      expect(gradeOf({ preferred: 0, played: 1 - loss }), grade).toBe(better);
    }
  });

  /**
   * The loss is in the evaluation's own units, so what the bands come to can be
   * said in pieces and mills rather than in numbers. These are the two the bands
   * are placed around, and they are what a recalibration (#12) has to keep true.
   */
  it("calls a move that hands a piece over while pieces move a blunder", () => {
    expect(gradeOf({ preferred: 0, played: -DEFAULT_WEIGHTS.moving.material })).toBe("blunder");
  });

  it("calls a mill missed while pieces move something short of a blunder", () => {
    expect(gradeOf({ preferred: 0, played: -DEFAULT_WEIGHTS.moving.mills })).not.toBe("blunder");
  });

  it("calls a move that throws a won game a blunder", () => {
    expect(gradeOf({ preferred: WIN_SCORE - 3, played: 1 - WIN_SCORE })).toBe("blunder");
  });
});

describe("a move played in a position already lost", () => {
  /**
   * A player whose game had gone before they moved is not the one to be told
   * about it: the mistake was made further back, and grading this move as the
   * blunder it arithmetically is would point at the wrong move.
   */
  it("is graded no worse than an inaccuracy, whatever it lost", () => {
    expect(gradeOf({ preferred: -LOST_POSITION, played: -LOST_POSITION - 900 })).toBe("inaccuracy");
  });

  it("is still the best move where it is the best move — the cap is a ceiling", () => {
    expect(gradeOf({ preferred: -LOST_POSITION, played: -LOST_POSITION })).toBe("best");
  });

  it("is not what a position merely a piece down is", () => {
    const behind = -DEFAULT_WEIGHTS.moving.material;

    expect(gradeOf({ preferred: behind, played: behind - 900 })).toBe("blunder");
  });

  /** A game the search has seen lost outright is lost by any measure. */
  it("takes in a game the search has seen lost outright", () => {
    expect(gradeOf({ preferred: 5 - WIN_SCORE, played: 1 - WIN_SCORE - 900 })).toBe("inaccuracy");
  });
});

describe("grading the move a player has just played", () => {
  it("weighs it against the moves the engine ranked in the position it was played in", async () => {
    const search = rankedSearch([
      { move: { to: "d2" }, score: 30 },
      { move: { to: "a1" }, score: -GRADE_LOSSES[0].loss + 30 },
    ]);

    expect(await createGrader(search.runSearch)(NEW_GAME, { to: "a1" })).toBe(GRADE_LOSSES[0].grade);
    expect(search.asked[0]?.game).toBe(NEW_GAME);
  });

  it("calls the move the engine preferred the best one", async () => {
    const search = rankedSearch([
      { move: { to: "d2" }, score: 30 },
      { move: { to: "a1" }, score: -900 },
    ]);

    expect(await createGrader(search.runSearch)(NEW_GAME, { to: "d2" })).toBe("best");
  });

  /** A move nobody had a choice about says nothing about the player who played it. */
  it("gives no grade where the rules offered one move and no other", async () => {
    const search = rankedSearch([{ move: { from: "a1", to: "a4" }, score: 30 }]);

    expect(await createGrader(search.runSearch)(NEW_GAME, { from: "a1", to: "a4" })).toBeUndefined();
  });

  it("gives no grade where the search ranked nothing at all", async () => {
    const search = rankedSearch([]);

    expect(await createGrader(search.runSearch)(NEW_GAME, { to: "a1" })).toBeUndefined();
  });

  /**
   * Which piece to take is a decision of its own, so two moves arriving on the
   * same point are two moves and are told apart by the piece they took.
   */
  it("tells one capture from another out of the same arrival", async () => {
    const search = rankedSearch([
      { move: { to: "g1", capture: "a7" }, score: 30 },
      { move: { to: "g1", capture: "d7" }, score: 30 - GRADE_LOSSES[0].loss },
    ]);
    const grade = createGrader(search.runSearch);

    expect(await grade(NEW_GAME, { to: "g1", capture: "a7" })).toBe("best");
    expect(await grade(NEW_GAME, { to: "g1", capture: "d7" })).toBe(GRADE_LOSSES[0].grade);
  });

  it("gives no grade for a move the search did not rank", async () => {
    const search = rankedSearch([
      { move: { to: "d2" }, score: 30 },
      { move: { to: "a1" }, score: 10 },
    ]);

    expect(await createGrader(search.runSearch)(NEW_GAME, { to: "g7" })).toBeUndefined();
  });

  /** ADR-0001: the engine that teaches is never the weakened one that plays. */
  it("is searched for as deeply as the strongest difficulty looks, in every phase", async () => {
    for (const [phase, game] of Object.entries(IN_EACH_PHASE)) {
      const search = rankedSearch([{ move: { to: "d2" }, score: 0 }]);
      expect(phaseOf(game), phase).toBe(phase);

      await createGrader(search.runSearch)(game, { to: "d2" });

      expect(search.asked[0]?.depth, phase).toBe(DIFFICULTY_SETTINGS.master.depth[phase as Phase]);
    }
  });
});
