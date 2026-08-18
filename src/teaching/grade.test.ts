import { describe, expect, it } from "vitest";

import { DEFAULT_WEIGHTS } from "../ai/evaluation";
import { type ScoredMove, type SearchResult, WIN_SCORE } from "../ai/search";
import { type Game, NEW_GAME, PHASES, type Phase, phaseOf } from "../engine/game";
import { DIFFICULTY_SETTINGS } from "../opponent/difficulty";
import type { RunSearch, SearchRequest } from "../opponent/opponent";
import { gameOf } from "../../tests/fixtures/games";
import { BANDS, GRADES, LOST_POSITION, createGrader, gradeOf, isNoWorseThan } from "./grade";

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
    for (const phase of PHASES) {
      expect(gradeOf(phase, { preferred: 40, played: 40 }), phase).toBe("best");
    }
  });

  it("grades a move by what it lost against the move the engine preferred", () => {
    for (const phase of PHASES) {
      for (const { grade, loss } of BANDS[phase]) {
        expect(gradeOf(phase, { preferred: 0, played: -loss }), `${phase}: ${grade}`).toBe(grade);
      }
    }
  });

  it("puts a move that lost less than a band asks for in the band above it", () => {
    for (const phase of PHASES) {
      for (const { grade, loss } of BANDS[phase]) {
        const better = GRADES[GRADES.indexOf(grade) - 1];
        const just = gradeOf(phase, { preferred: 0, played: 1 - loss });

        expect(just, `${phase}: ${grade}`).toBe(better);
      }
    }
  });

  /**
   * The evaluation's units are not the same size in all three phases — a piece
   * is worth 8 while pieces are being placed and 300 while they fly — so one
   * table read in all three would call the same loss a blunder in one phase and
   * nothing at all in another. Each phase therefore has bands of its own.
   */
  it("weighs a loss against the bands of the phase it was played in", () => {
    const tables = PHASES.map((phase) => BANDS[phase].map(({ loss }) => loss).join());

    expect(new Set(tables).size, "the phases share a table").toBe(PHASES.length);
  });

  /**
   * The loss is in the evaluation's own units, so what a band comes to can be
   * said in pieces and mills rather than in numbers. This is the loss the moving
   * phase's bands were first placed around by intuition, and the calibration
   * (#12) had to keep it true.
   */
  it("calls a move that hands a piece over while pieces move a blunder", () => {
    expect(gradeOf("moving", { preferred: 0, played: -DEFAULT_WEIGHTS.moving.material })).toBe(
      "blunder",
    );
  });

  it("calls a mill missed while pieces move something short of a blunder", () => {
    expect(gradeOf("moving", { preferred: 0, played: -DEFAULT_WEIGHTS.moving.mills })).not.toBe(
      "blunder",
    );
  });

  /**
   * A clearly good move is never called a mistake (#12). A move that gave up
   * less than a mill in the phase it was played in has given up nothing a player
   * could name — not a piece, not a mill — and Hiba is a word a learner reads as
   * an accusation. It is a live constraint rather than a comfortable one: while
   * pieces move, the corpus put Hiba at 40 and a mill is worth 34.
   */
  it("calls a move that gave up less than a mill no worse than an inaccuracy", () => {
    for (const phase of PHASES) {
      const grade = gradeOf(phase, { preferred: 0, played: 1 - DEFAULT_WEIGHTS[phase].mills });

      expect(isNoWorseThan(grade, "inaccuracy"), `${phase}: ${grade}`).toBe(true);
    }
  });

  /**
   * The other half of the same claim, and the half that says what the worst word
   * means: Súlyos hiba is a piece's worth or more, in the units of the phase the
   * move was played in. This is what one table read in all three phases could
   * not keep. While flying, where a piece is worth 300, its Súlyos hiba began at
   * a third of one, so a loss of 240 — four fifths of a piece, and a size the
   * corpus finds a real cluster of flying moves at — meant the same word as
   * handing a piece over.
   */
  it("keeps Súlyos hiba for a piece's worth and more", () => {
    for (const phase of PHASES) {
      const short = gradeOf(phase, { preferred: 0, played: 1 - DEFAULT_WEIGHTS[phase].material });

      expect(short, phase).not.toBe("blunder");
    }
  });

  it("calls a move that throws a won game a blunder", () => {
    for (const phase of PHASES) {
      expect(gradeOf(phase, { preferred: WIN_SCORE - 3, played: 1 - WIN_SCORE }), phase).toBe(
        "blunder",
      );
    }
  });
});

describe("a move played in a position already lost", () => {
  /**
   * A player whose game had gone before they moved is not the one to be told
   * about it: the mistake was made further back, and grading this move as the
   * blunder it arithmetically is would point at the wrong move.
   */
  it("is graded no worse than an inaccuracy, whatever it lost", () => {
    for (const phase of PHASES) {
      const lost = -LOST_POSITION[phase];

      expect(gradeOf(phase, { preferred: lost, played: lost - 900 }), phase).toBe("inaccuracy");
    }
  });

  it("is still the best move where it is the best move — the cap is a ceiling", () => {
    for (const phase of PHASES) {
      const lost = -LOST_POSITION[phase];

      expect(gradeOf(phase, { preferred: lost, played: lost }), phase).toBe("best");
    }
  });

  it("is not what a position merely a piece down is", () => {
    const behind = -DEFAULT_WEIGHTS.moving.material;

    expect(gradeOf("moving", { preferred: behind, played: behind - 900 })).toBe("blunder");
  });

  /** A game the search has seen lost outright is lost by any measure. */
  it("takes in a game the search has seen lost outright", () => {
    for (const phase of PHASES) {
      expect(
        gradeOf(phase, { preferred: 5 - WIN_SCORE, played: 1 - WIN_SCORE - 900 }),
        phase,
      ).toBe("inaccuracy");
    }
  });
});

describe("grading the move a player has just played", () => {
  it("weighs it against the moves the engine ranked in the position it was played in", async () => {
    const search = rankedSearch([
      { move: { to: "d2" }, score: 30 },
      { move: { to: "a1" }, score: 30 - BANDS.placing[0].loss },
    ]);

    const grade = await createGrader(search.runSearch)(NEW_GAME, { to: "a1" });

    expect(grade).toBe(BANDS.placing[0].grade);
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
      { move: { to: "g1", capture: "d7" }, score: 30 - BANDS.placing[0].loss },
    ]);
    const grade = createGrader(search.runSearch);

    expect(await grade(NEW_GAME, { to: "g1", capture: "a7" })).toBe("best");
    expect(await grade(NEW_GAME, { to: "g1", capture: "d7" })).toBe(BANDS.placing[0].grade);
  });

  it("gives no grade for a move the search did not rank", async () => {
    const search = rankedSearch([
      { move: { to: "d2" }, score: 30 },
      { move: { to: "a1" }, score: 10 },
    ]);

    expect(await createGrader(search.runSearch)(NEW_GAME, { to: "g7" })).toBeUndefined();
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

    expect(await createGrader(rankedSearch(candidates).runSearch)(NEW_GAME, { to: "a1" })).toBe(
      "blunder",
    );
    expect(
      await createGrader(rankedSearch(candidates).runSearch)(IN_EACH_PHASE.flying, { to: "a1" }),
    ).not.toBe("blunder");
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
