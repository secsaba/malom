import { describe, expect, it } from "vitest";

import type { Move } from "../engine/game";
import { GRADES, type Grade } from "./grade";
import { CRITICISM, PRAISE, type Pattern } from "./patterns";
import { reasonFor } from "./reason";

const PLAYED: Move = { from: "d7", to: "a7", capture: "f2" };
const PREFERRED: Move = { from: "d7", to: "g7" };

const about = (grade: Grade, patterns: readonly Pattern[], played: Move = PLAYED) =>
  reasonFor(grade, patterns, { played, preferred: PREFERRED });

describe("what the player is told about the move they played", () => {
  it("praises a move graded no worse than Jó with the first praise pattern it fired", () => {
    for (const grade of ["best", "good"] as const) {
      expect(about(grade, ["fork-created", "mill-closed"])).toEqual({
        kind: "pattern",
        pattern: "fork-created",
      });
    }
  });

  it("takes a worse move to task with the first criticism pattern it fired", () => {
    for (const grade of ["inaccuracy", "mistake", "blunder"] as const) {
      expect(about(grade, ["mill-let-through", "mill-missed"])).toEqual({
        kind: "pattern",
        pattern: "mill-let-through",
      });
    }
  });

  /**
   * A move can close a mill and still be the wrong move, and it can lose nothing
   * while leaving a piece where it can be shut in. Saying the half that does not
   * match the verdict would read as the engine contradicting itself, so the
   * fallback is used instead — which is what ADR-0003 asks for: no story the
   * evaluation cannot support.
   */
  it("says nothing it detected where none of it matches the verdict", () => {
    expect(about("blunder", ["mill-closed", "intersection-taken"])).toEqual({
      kind: "prefers",
      move: PREFERRED,
    });
    expect(about("best", ["piece-left-blockable"])).toEqual({
      kind: "prefers",
      move: PREFERRED,
    });
  });

  it("names the move the engine would have played when nothing fired at all", () => {
    for (const grade of GRADES) {
      expect(about(grade, [])).toEqual({ kind: "prefers", move: PREFERRED });
    }
  });

  it("says so instead where the move played is the one the engine would have played", () => {
    expect(about("best", [], PREFERRED)).toEqual({ kind: "agrees" });
  });

  it("draws praise only from the praise half and criticism only from the other", () => {
    for (const pattern of PRAISE) {
      expect(about("best", [pattern])).toEqual({ kind: "pattern", pattern });
      expect(about("blunder", [pattern])).toEqual({ kind: "prefers", move: PREFERRED });
    }

    for (const pattern of CRITICISM) {
      expect(about("blunder", [pattern])).toEqual({ kind: "pattern", pattern });
      expect(about("best", [pattern])).toEqual({ kind: "prefers", move: PREFERRED });
    }
  });
});
