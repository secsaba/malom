import { describe, expect, it } from "vitest";

import { DEFAULT_WEIGHTS } from "../ai/evaluation";
import { WIN_SCORE } from "../ai/search";
import { PHASES } from "../engine/game";
import { BANDS, GRADES, LOST_POSITION, gradeOf, isNoWorseThan } from "./grade";

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
