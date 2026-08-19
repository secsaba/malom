import { describe, expect, it } from "vitest";

import type { Move } from "../engine/game";
import { strings } from "../strings";
import { BETWEEN, type PointState, hintedAt, pointLabel } from "./point-state";

const { point } = strings.board;

/** A point with nothing to say about itself: empty, and part of nothing. */
const PLAIN: PointState = {
  occupant: undefined,
  legal: false,
  selected: false,
  hint: undefined,
  lastMove: false,
};

describe("what a hinted move has a point doing", () => {
  const move: Move = { from: "a1", to: "a4", capture: "g7" };

  it("names all three points the move touches", () => {
    expect(hintedAt(move, "a1")).toBe("from");
    expect(hintedAt(move, "a4")).toBe("to");
    expect(hintedAt(move, "g7")).toBe("capture");
  });

  it("has nothing to say about a point the move leaves alone", () => {
    expect(hintedAt(move, "d1")).toBeUndefined();
  });

  it("has nothing to say where no hint was asked for", () => {
    expect(hintedAt(undefined, "a1")).toBeUndefined();
  });
});

describe("announcing a point", () => {
  it("opens with the coordinate, whatever else it says", () => {
    for (const state of [PLAIN, { ...PLAIN, occupant: "light" as const }]) {
      expect(pointLabel("c5", state).startsWith("c5")).toBe(true);
    }
  });

  it("says an empty point is empty", () => {
    expect(pointLabel("a1", PLAIN)).toBe(`a1${BETWEEN}${point.empty}`);
  });

  it("names the side whose piece stands on the point", () => {
    expect(pointLabel("a1", { ...PLAIN, occupant: "light" })).toContain(point.piece.light);
    expect(pointLabel("a1", { ...PLAIN, occupant: "dark" })).toContain(point.piece.dark);
    expect(pointLabel("a1", { ...PLAIN, occupant: "dark" })).not.toContain(point.empty);
  });

  it("says a point the side to move may act on is theirs to choose", () => {
    expect(pointLabel("a1", { ...PLAIN, legal: true })).toContain(point.legal);
    expect(pointLabel("a1", PLAIN)).not.toContain(point.legal);
  });

  it("says which piece has been picked up", () => {
    const label = pointLabel("a1", { ...PLAIN, occupant: "light", selected: true });

    expect(label).toContain(point.piece.light);
    expect(label).toContain(point.selected);
  });

  it("says what the hint has the point doing", () => {
    expect(pointLabel("a1", { ...PLAIN, hint: "from" })).toContain(point.hint.from);
    expect(pointLabel("a4", { ...PLAIN, hint: "to" })).toContain(point.hint.to);
    expect(pointLabel("g7", { ...PLAIN, hint: "capture" })).toContain(point.hint.capture);
  });

  it("says where the piece that moved last came to rest", () => {
    expect(pointLabel("a4", { ...PLAIN, occupant: "light", lastMove: true })).toContain(
      point.lastMove,
    );
  });

  // Everything true of a point at once is still one sentence, in one order, so a
  // player hearing it twice hears the same thing said the same way.
  it("says everything the point is, occupancy first", () => {
    const label = pointLabel("a4", {
      occupant: "light",
      legal: true,
      selected: true,
      hint: "to",
      lastMove: true,
    });

    expect(label).toBe(
      [
        "a4",
        point.piece.light,
        point.selected,
        point.legal,
        point.hint.to,
        point.lastMove,
      ].join(BETWEEN),
    );
  });
});
