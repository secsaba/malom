import { describe, expect, it } from "vitest";

import type { Result } from "../engine/game";
import type { Side } from "../engine/position";
import type { Grade } from "./grade";
import { CRITICISM, type Pattern } from "./patterns";
import { type GradedMove, summariesOf } from "./summary";

const DRAWN: Result = { draw: "repetition" };
const LIGHT_WON: Result = { winner: "light", ending: "reduced" };

/** A move somebody played and the engine had something to say about. */
const graded = (by: Side, grade: Grade, patterns: readonly Pattern[] = []): GradedMove => ({
  by,
  assessment: {
    grade,
    patterns,
    reason: patterns[0] === undefined ? { kind: "agrees" } : { kind: "pattern", pattern: patterns[0] },
  },
});

/** A move the engine had nothing to say about — the computer's own, or one the rules forced. */
const ungraded = (by: Side): GradedMove => ({ by, assessment: undefined });

const summaryFor = (side: Side, result: Result, moves: readonly GradedMove[]) =>
  summariesOf(result, moves).find((summary) => summary.side === side);

describe("the summary at the end of a game", () => {
  it("counts a side's moves in the bands they were graded in", () => {
    const summary = summaryFor("light", LIGHT_WON, [
      graded("light", "best"),
      graded("light", "best"),
      graded("light", "mistake"),
      graded("dark", "blunder"),
    ]);

    expect(summary?.graded).toBe(3);
    expect(summary?.counts).toEqual({ best: 2, good: 0, inaccuracy: 0, mistake: 1, blunder: 0 });
  });

  it("counts each side apart, so two people sharing a device read their own game", () => {
    const summaries = summariesOf(DRAWN, [graded("light", "good"), graded("dark", "blunder")]);

    expect(summaries.map(({ side }) => side)).toEqual(["light", "dark"]);
    expect(summaries[0]?.counts.good).toBe(1);
    expect(summaries[1]?.counts.blunder).toBe(1);
  });

  /** Against the computer only one side is ever graded, and only that side is summarised. */
  it("leaves out a side the engine graded nothing of", () => {
    const summaries = summariesOf(LIGHT_WON, [graded("light", "good"), ungraded("dark")]);

    expect(summaries.map(({ side }) => side)).toEqual(["light"]);
  });

  it("summarises nothing at all in a game nobody's moves were graded in", () => {
    expect(summariesOf(DRAWN, [ungraded("light"), ungraded("dark")])).toEqual([]);
  });

  it("names the criticism a side's moves fired most often as its weakness", () => {
    const summary = summaryFor("light", LIGHT_WON, [
      graded("light", "mistake", ["mill-missed"]),
      graded("light", "mistake", ["mill-missed"]),
      graded("light", "blunder", ["fork-handed"]),
    ]);

    expect(summary?.weakness).toBe("mill-missed");
  });

  /**
   * The assessment carries every pattern and not only the one the reason named,
   * exactly so that this can count them: a criticism that went unsaid on the
   * move it happened on is still one the player made.
   */
  it("counts a criticism the player was never told about on the move itself", () => {
    const summary = summaryFor("light", LIGHT_WON, [
      graded("light", "blunder", ["mill-let-through", "piece-left-blockable"]),
      graded("light", "mistake", ["piece-left-blockable"]),
    ]);

    expect(summary?.weakness).toBe("piece-left-blockable");
  });

  it("never names something the player did well", () => {
    const summary = summaryFor("light", LIGHT_WON, [
      graded("light", "best", ["mill-closed"]),
      graded("light", "best", ["mill-closed"]),
      graded("light", "mistake", ["mill-missed"]),
    ]);

    expect(summary?.weakness).toBe("mill-missed");
  });

  it("names no weakness where nothing of the side's was criticised", () => {
    const summary = summaryFor("light", LIGHT_WON, [graded("light", "best", ["mill-closed"])]);

    expect(summary?.weakness).toBeUndefined();
  });

  it("counts only the side's own criticisms, and not the ones opposite", () => {
    const summary = summaryFor("light", LIGHT_WON, [
      graded("light", "mistake", ["mill-missed"]),
      graded("dark", "blunder", ["fork-handed"]),
      graded("dark", "blunder", ["fork-handed"]),
    ]);

    expect(summary?.weakness).toBe("mill-missed");
  });

  /**
   * Two mistakes made as often as each other are separated by the catalogue's
   * own order, which is the order they are worth saying in — so the same game
   * always names the same weakness.
   */
  it("settles a tie the way the catalogue ranks the two", () => {
    const [worthSayingFirst, worthSayingSecond] = CRITICISM;
    const summary = summaryFor("light", LIGHT_WON, [
      graded("light", "mistake", [worthSayingSecond]),
      graded("light", "mistake", [worthSayingFirst]),
    ]);

    expect(summary?.weakness).toBe(worthSayingFirst);
  });

  describe("how the game ended", () => {
    it("is read from each side's own point of view", () => {
      expect(
        summaryFor("light", LIGHT_WON, [graded("light", "good")])?.outcome,
      ).toBe("won");
      expect(summaryFor("dark", LIGHT_WON, [graded("dark", "good")])?.outcome).toBe("lost");
    });

    /** A draw is a draw for both of them: it is nobody's failure. */
    it("is drawn for both sides where neither could win it", () => {
      const summaries = summariesOf(DRAWN, [graded("light", "good"), graded("dark", "good")]);

      expect(summaries.map(({ outcome }) => outcome)).toEqual(["drawn", "drawn"]);
    });
  });
});
