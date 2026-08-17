import { describe, expect, it } from "vitest";

import type { ScoredMove } from "../ai/search";
import { POINTS } from "../engine/board";
import type { Phase } from "../engine/game";
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  DIFFICULTY_SETTINGS,
  type Difficulty,
  FULL_STRENGTH,
  NEAR_BEST_COUNT,
  NEAR_BEST_MARGIN,
  moveAtDifficulty,
} from "./difficulty";

const PHASES = ["placing", "moving", "flying"] as const satisfies readonly Phase[];

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

  /**
   * Deeper in every phase it can be deeper in, and never shallower in any — the
   * flying phase is the one that caps out, being the widest the board ever gets,
   * so the two strongest meet there and are told apart by their blunder rates.
   */
  it("look deeper and blunder less at every step up", () => {
    const steps = DIFFICULTIES.map((difficulty) => DIFFICULTY_SETTINGS[difficulty]);

    for (const [step, above] of steps.entries()) {
      const below = steps[step - 1];
      if (!below) continue;

      const deeper = PHASES.filter((phase) => above.depth[phase] > below.depth[phase]);

      for (const phase of PHASES) {
        expect(above.depth[phase], `${phase} at step ${step}`).toBeGreaterThanOrEqual(
          below.depth[phase],
        );
      }

      expect(deeper.length, `nothing deeper at step ${step}`).toBeGreaterThan(0);
      expect(above.blunderRate, `blunder rate at step ${step}`).toBeLessThan(below.blunderRate);
    }
  });

  it("play the strongest of them with no deliberate mistake in it at all", () => {
    expect(DIFFICULTY_SETTINGS.master.blunderRate).toBe(0);
  });

  /**
   * Full strength is named rather than derived, so that hints and grades can ask
   * for it without knowing the table (ADR-0001). This is what keeps the name
   * pointing at the strongest of them if a fifth is ever added above it.
   */
  it("are led by the one hints and grades are worked out at", () => {
    expect(FULL_STRENGTH).toBe(DIFFICULTIES[DIFFICULTIES.length - 1]);
  });

  it("all look at least one move ahead in every phase, so none of them plays blind", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const phase of PHASES) {
        expect(DIFFICULTY_SETTINGS[difficulty].depth[phase], `${difficulty} ${phase}`)
          .toBeGreaterThanOrEqual(1);
      }
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

  /**
   * The other half of "never uniformly at random among legal moves", and the one
   * the margin alone does not give: on an empty board every placement scores
   * within twenty of every other, so a margin wide enough to be a mistake
   * anywhere admits the lot. A shortlist stays a shortlist all the same.
   */
  it("is drawn from a shortlist even where every legal move is as good as the best", () => {
    // The opening as the search really scores it: 24 placements, none of them a
    // whole point behind the one in front of it, every one inside the margin.
    const openingBoard: readonly ScoredMove[] = POINTS.map((point, nth) => ({
      move: { to: point },
      score: 100 - nth * 0.5,
    }));

    const played = everyTicket(500).map((ticket) =>
      moveAtDifficulty("beginner", openingBoard, answering(0, ticket)),
    );
    const distinct = new Set(played.map((move) => move?.to));

    expect(distinct.size).toBeGreaterThan(1); // it is still a choice
    expect(distinct.size).toBeLessThanOrEqual(NEAR_BEST_COUNT);
    // And a choice out of far fewer moves than the board offered it.
    expect(openingBoard.length).toBeGreaterThan(NEAR_BEST_COUNT * 2);
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
