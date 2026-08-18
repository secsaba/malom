import { describe, expect, it } from "vitest";

import { notationOf } from "./move-notation";

describe("a move written down", () => {
  it("is the point a placement landed on", () => {
    expect(notationOf({ to: "d2" })).toBe("d2");
  });

  it("is where a piece came from and where it went", () => {
    expect(notationOf({ from: "b4", to: "c4" })).toBe("b4-c4");
  });

  /** Which piece a mill took is part of the move, so it is part of the notation. */
  it("names the piece a capture took", () => {
    expect(notationOf({ to: "g1", capture: "a7" })).toBe("g1xa7");
    expect(notationOf({ from: "d7", to: "a7", capture: "f2" })).toBe("d7-a7xf2");
  });
});
