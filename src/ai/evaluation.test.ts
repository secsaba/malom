import { describe, expect, it } from "vitest";

import { gameOf } from "../../tests/fixtures/positions";
import type { PointId } from "../engine/board";
import { DEFAULT_WEIGHTS, TERMS, evaluate } from "./evaluation";

/**
 * The board is symmetric under a half turn — a1 goes to g7, d1 to d7, c3 to e5 —
 * so a position and its half turn played by the other side are the same position
 * seen from the other end. Everything below that needs a level position builds it
 * out of a set of points and this map of them, which makes the two sides exactly
 * as well off as each other and leaves whatever the test is about as the only
 * difference between them.
 */
const HALF_TURN = {
  a1: "g7", a4: "g4", a7: "g1", b2: "f6", b4: "f4", b6: "f2",
  c3: "e5", c4: "e4", c5: "e3", d1: "d7", d2: "d6", d3: "d5",
  g7: "a1", g4: "a4", g1: "a7", f6: "b2", f4: "b4", f2: "b6",
  e5: "c3", e4: "c4", e3: "c5", d7: "d1", d6: "d2", d5: "d3",
} as const;

type Mirrored = keyof typeof HALF_TURN;

const mirrorOf = (points: readonly Mirrored[]) => points.map((point) => HALF_TURN[point]);

/** Two hands with the same number of pieces left in them. */
const evenHands = (pieces: number) => ({ light: pieces, dark: pieces });

describe("a position neither side is better off in", () => {
  const LIGHT = ["a1", "d1", "c3", "b2", "a4"] as const satisfies readonly Mirrored[];

  const level = (piecesInHand: { light: number; dark: number }) =>
    gameOf({ light: LIGHT, dark: mirrorOf(LIGHT), sideToMove: "light", piecesInHand });

  it("evaluates as nothing, whichever side is to move", () => {
    expect(evaluate(level(evenHands(4)))).toBe(0);
    expect(evaluate({ ...level(evenHands(4)), sideToMove: "dark" })).toBe(0);
  });

  it("evaluates as nothing once the pieces are all down as well", () => {
    expect(evaluate(level(evenHands(0)))).toBe(0);
  });

  it("counts a piece still in hand, so the side with one more is better off", () => {
    expect(evaluate(level({ light: 5, dark: 4 }))).toBeGreaterThan(0);
    expect(evaluate(level({ light: 3, dark: 4 }))).toBeLessThan(0);
  });
});

/**
 * Three pieces of light's, placed differently in each test, against three of
 * dark's that stay where they are: b6, f2 and c5 lie on six lines between them
 * and share none, so dark has nothing of its own going on to muddy the reading.
 */
const DARK_ELSEWHERE = ["b6", "f2", "c5"] as const;

const lightHolding = (...light: readonly PointId[]) =>
  gameOf({ light, dark: DARK_ELSEWHERE, sideToMove: "light", piecesInHand: evenHands(6) });

describe("what light's three pieces are worth", () => {
  it("counts a closed mill above the potential mill the same pieces would make", () => {
    // a1, d1 and g1 are a mill; a1, d1 and e5 are a1-d1-g1 waiting for its third
    // piece. Both threes stand on points of the same degree, so nothing but the
    // mill separates them.
    expect(evaluate(lightHolding("a1", "d1", "g1"))).toBeGreaterThan(
      evaluate(lightHolding("a1", "d1", "e5")),
    );
  });

  it("counts a potential mill above three pieces on no line together", () => {
    // d1 makes a1-d1-g1 a potential mill; d7 has the same degree and no line in
    // common with either of the others.
    expect(evaluate(lightHolding("a1", "d1", "e5"))).toBeGreaterThan(
      evaluate(lightHolding("a1", "d7", "e5")),
    );
  });

  it("counts a fork above two potential mills the opponent could block one by one", () => {
    // a1, d1, a7 leaves a1 on two potential mills at once, and the two points
    // that would close them are not the same point, so only one can be blocked.
    expect(evaluate(lightHolding("a1", "d1", "a7"))).toBeGreaterThan(
      evaluate(lightHolding("a1", "d1", "e5")),
    );
  });
});

describe("a piece's point", () => {
  it("is worth more on an intersection than in a corner", () => {
    const dark = ["d2", "d5", "f4", "b6"] as const;
    const inTheCorner = gameOf({
      light: ["a1", "c3", "e5", "g7"],
      dark,
      sideToMove: "light",
      piecesInHand: evenHands(5),
    });
    const onTheIntersection = gameOf({
      light: ["b4", "c3", "e5", "g7"],
      dark,
      sideToMove: "light",
      piecesInHand: evenHands(5),
    });

    expect(evaluate(onTheIntersection)).toBeGreaterThan(evaluate(inTheCorner));
  });

  it("is worth less with nowhere to go from it", () => {
    // Dark's fourth piece stands on d2 in one game and on d1 in the other. On d1
    // it shuts light's a1 in, a4 being dark's already; on d2 it does not.
    const light = ["a1", "c3", "e5", "g7"] as const;
    const free = gameOf({ light, dark: ["a4", "d2", "d5", "f4"], sideToMove: "light" });
    const shutIn = gameOf({ light, dark: ["a4", "d1", "d5", "f4"], sideToMove: "light" });

    expect(evaluate(free)).toBeGreaterThan(evaluate(shutIn));
  });
});

describe("a mill in the moving phase", () => {
  const LIGHT = ["e4", "f4", "g4", "a1"] as const;

  it("is worth more with room around it to be run", () => {
    // Dark's four pieces stand next to every one of light's mill in one game and
    // nowhere near it in the other. A mill nobody stands beside can step a piece
    // out and back, closing again — and capturing again — every second move.
    const walledIn = gameOf({ light: LIGHT, dark: ["e5", "f6", "g7", "a4"], sideToMove: "light" });
    const freeToRun = gameOf({ light: LIGHT, dark: ["c5", "d3", "a7", "a4"], sideToMove: "light" });

    expect(evaluate(freeToRun)).toBeGreaterThan(evaluate(walledIn));
  });
});

/**
 * These are the shape the weights have to keep, not the values they have to hold:
 * the numbers themselves are provisional and #9 replaces them, but a set that
 * broke either of these would no longer be playing the game the phases describe.
 */
describe("the provisional weights", () => {
  it("let the shape of the position outweigh a piece while the pieces are being placed", () => {
    const { placing } = DEFAULT_WEIGHTS;

    expect(placing.material).toBeLessThan(placing.mills + placing.potentialMills);
    expect(placing.material).toBeLessThan(DEFAULT_WEIGHTS.moving.material);
  });

  it("let material outweigh everything else put together once a side is flying", () => {
    const { flying } = DEFAULT_WEIGHTS;
    const everythingElse = TERMS.filter((term) => term !== "material").reduce(
      (total, term) => total + Math.abs(flying[term]),
      0,
    );

    expect(flying.material).toBeGreaterThan(everythingElse);
    expect(flying.material).toBeGreaterThan(DEFAULT_WEIGHTS.moving.material);
  });
});
