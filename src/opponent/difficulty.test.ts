import { describe, expect, it } from "vitest";

import type { ScoredMove } from "../ai/search";
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  DIFFICULTY_SETTINGS,
  type Difficulty,
  NEAR_BEST_MARGIN,
  moveAtDifficulty,
} from "./difficulty";

/**
 * A source of numbers that answers with what the test wrote down, in order, and
 * with nought once it runs out. What it stands in for is chance, so a test that
 * writes nothing down is a test that says chance is never consulted.
 */
const answering = (...numbers: readonly number[]) => {
  let asked = 0;
  return () => {
    asked += 1;
    return numbers[asked - 1] ?? 0;
  };
};

/** Every ticket a blundering opponent could draw, spread evenly over the range. */
const everyTicket = (count: number) =>
  Array.from({ length: count }, (_, drawn) => (drawn + 0.5) / count);

/**
 * A root the search has ranked: the best move, one a whisker behind it, one at
 * the far end of what still counts as near-best, and one that hands a piece
 * away. The last is the point of the fixture — it is legal, and no difficulty
 * may ever play it on purpose.
 */
const A_RANKED_ROOT: readonly ScoredMove[] = [
  { move: { to: "a1" }, score: 100 },
  { move: { to: "a4" }, score: 100 - Math.round(NEAR_BEST_MARGIN / 4) },
  { move: { to: "a7" }, score: 100 - NEAR_BEST_MARGIN },
  { move: { to: "b2" }, score: 100 - NEAR_BEST_MARGIN * 10 },
];

const BEST = { to: "a1" };
const BLUNDER = { to: "b2" };

/** Everything a difficulty plays over a whole sweep of the chance it is given. */
const playedOver = (difficulty: Difficulty, tickets: readonly number[]) =>
  tickets.map((ticket) => moveAtDifficulty(difficulty, A_RANKED_ROOT, answering(0, ticket)));

describe("the four difficulties", () => {
  it("run from the weakest to the strongest, ending at Mester", () => {
    expect(DIFFICULTIES).toEqual(["beginner", "intermediate", "strong", "master"]);
    expect(DIFFICULTIES).toContain(DEFAULT_DIFFICULTY);
  });

  it("look deeper and blunder less at every step up", () => {
    const tiers = DIFFICULTIES.map((difficulty) => DIFFICULTY_SETTINGS[difficulty]);

    for (const [step, tier] of tiers.entries()) {
      const below = tiers[step - 1];
      if (!below) continue;

      expect(tier.depth, `depth at step ${step}`).toBeGreaterThan(below.depth);
      expect(tier.blunderRate, `blunder rate at step ${step}`).toBeLessThan(below.blunderRate);
    }
  });

  it("play the strongest of them with no deliberate mistake in it at all", () => {
    expect(DIFFICULTY_SETTINGS.master.blunderRate).toBe(0);
  });

  it("all look at least one move ahead, so none of them plays blind", () => {
    for (const difficulty of DIFFICULTIES) {
      expect(DIFFICULTY_SETTINGS[difficulty].depth).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("the move Mester plays", () => {
  it("is the one the search preferred", () => {
    expect(moveAtDifficulty("master", A_RANKED_ROOT, answering())).toEqual(BEST);
  });

  it("is the same one however chance falls, because it never asks", () => {
    let asked = 0;
    const counted = () => {
      asked += 1;
      return 0; // the number that would make any other difficulty blunder
    };

    for (let again = 0; again < 10; again += 1) {
      expect(moveAtDifficulty("master", A_RANKED_ROOT, counted)).toEqual(BEST);
    }

    expect(asked).toBe(0);
  });
});

describe("the move a difficulty below Mester plays", () => {
  it("is the best one whenever the chance to blunder does not come up", () => {
    const { blunderRate } = DIFFICULTY_SETTINGS.beginner;

    expect(moveAtDifficulty("beginner", A_RANKED_ROOT, answering(blunderRate))).toEqual(BEST);
    expect(moveAtDifficulty("beginner", A_RANKED_ROOT, answering(0.999))).toEqual(BEST);
  });

  it("is a weaker one when it does, rather than the best one again", () => {
    const { blunderRate } = DIFFICULTY_SETTINGS.beginner;
    const played = moveAtDifficulty(
      "beginner",
      A_RANKED_ROOT,
      answering(blunderRate - 0.001, 0.5),
    );

    expect(played).not.toEqual(BEST);
  });

  it("comes up as often as its blunder rate says, over a run of games", () => {
    for (const difficulty of ["beginner", "intermediate", "strong"] as const) {
      const { blunderRate } = DIFFICULTY_SETTINGS[difficulty];
      const tickets = everyTicket(1000);
      const weakened = tickets.filter(
        (chance) =>
          moveAtDifficulty(difficulty, A_RANKED_ROOT, answering(chance, 0.5))?.to !== BEST.to,
      );

      expect(weakened.length / tickets.length, difficulty).toBeCloseTo(blunderRate, 2);
    }
  });

  /**
   * The acceptance criterion this repo's whole difficulty design turns on: a
   * weakened opponent picks among the moves the search ranked near the best one,
   * never among the legal moves at large. A move that hands a piece away is
   * legal, and it is never played.
   */
  it("is never one the search ranked outside the near-best margin", () => {
    for (const difficulty of DIFFICULTIES) {
      expect(playedOver(difficulty, everyTicket(500)), difficulty).not.toContainEqual(BLUNDER);
    }
  });

  it("is a nearer move more often than a further one, rather than either alike", () => {
    const played = playedOver("beginner", everyTicket(500));
    const nearer = played.filter((move) => move?.to === "a4").length;
    const further = played.filter((move) => move?.to === "a7").length;

    expect(nearer).toBeGreaterThan(further);
    expect(further).toBeGreaterThan(0); // the far edge is still somewhere it goes
  });

  it("is the best move after all when nothing else is near enough to it", () => {
    const runaway: readonly ScoredMove[] = [
      { move: { to: "a1" }, score: 100 },
      { move: { to: "b2" }, score: 100 - NEAR_BEST_MARGIN * 10 },
    ];

    expect(moveAtDifficulty("beginner", runaway, answering(0, 0.5))).toEqual(BEST);
  });

  it("is nothing at all in a game with no move left in it", () => {
    expect(moveAtDifficulty("beginner", [], answering(0, 0.5))).toBeUndefined();
    expect(moveAtDifficulty("master", [], answering())).toBeUndefined();
  });
});
