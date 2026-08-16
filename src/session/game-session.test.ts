import { describe, expect, it } from "vitest";

import { LINES, type PointId } from "../engine/board";
import { type GameSession, createGameSession } from "./game-session";

const place = (session: GameSession, ...points: readonly PointId[]) => {
  for (const point of points) session.apply({ type: "place", point });
};

const capture = (session: GameSession, point: PointId) => {
  session.apply({ type: "capture", point });
};

describe("a new game", () => {
  const session = createGameSession();

  it("starts empty, in the placing phase, with light to move", () => {
    expect(session.state.position.size).toBe(0);
    expect(session.state.phase).toBe("placing");
    expect(session.state.sideToMove).toBe("light");
  });

  it("gives both sides nine pieces in hand", () => {
    expect(session.state.piecesInHand).toEqual({ light: 9, dark: 9 });
  });

  it("offers every point of the board as a placement", () => {
    expect(session.state.legalPoints).toHaveLength(24);
    expect(session.state.pendingCapture).toBe(false);
  });
});

describe("placing a piece", () => {
  it("puts the moving side's piece on the point and passes the turn", () => {
    const session = createGameSession();

    place(session, "a1");

    expect(session.state.position.get("a1")).toBe("light");
    expect(session.state.sideToMove).toBe("dark");

    place(session, "g7");

    expect(session.state.position.get("g7")).toBe("dark");
    expect(session.state.sideToMove).toBe("light");
  });

  it("takes the piece out of the placing side's hand", () => {
    const session = createGameSession();

    place(session, "a1", "g7", "d1");

    expect(session.state.piecesInHand).toEqual({ light: 7, dark: 8 });
  });

  it("no longer offers an occupied point", () => {
    const session = createGameSession();

    place(session, "a1");

    expect(session.state.legalPoints).not.toContain("a1");
    expect(session.state.legalPoints).toHaveLength(23);
  });

  it("is rejected on an occupied point, leaving the game untouched", () => {
    const session = createGameSession();
    place(session, "a1");
    const before = session.state;

    place(session, "a1");

    expect(session.state).toBe(before);
  });
});

describe("closing a mill", () => {
  /** Light closes the mill a1-d1-g1 on its third placement; dark fills elsewhere. */
  const upToLightsMill = () => {
    const session = createGameSession();
    place(session, "a1", "a7", "d1", "d7");
    return session;
  };

  it("holds the turn until the capture is taken", () => {
    const session = upToLightsMill();

    place(session, "g1");

    expect(session.state.pendingCapture).toBe(true);
    expect(session.state.sideToMove).toBe("light");
  });

  it("offers the opponent's pieces as the capture", () => {
    const session = upToLightsMill();

    place(session, "g1");

    expect([...session.state.legalPoints].sort()).toEqual(["a7", "d7"]);
  });

  it("takes the captured piece off the board and passes the turn", () => {
    const session = upToLightsMill();
    place(session, "g1");

    capture(session, "a7");

    expect(session.state.position.has("a7")).toBe(false);
    expect(session.state.pendingCapture).toBe(false);
    expect(session.state.sideToMove).toBe("dark");
  });

  it("leaves the capturing side's hand alone — a capture is not a placement", () => {
    const session = upToLightsMill();
    place(session, "g1");
    capture(session, "a7");

    expect(session.state.piecesInHand).toEqual({ light: 6, dark: 7 });
  });

  it("refuses a placement until the capture is taken", () => {
    const session = upToLightsMill();
    place(session, "g1");
    const before = session.state;

    place(session, "b2");

    expect(session.state).toBe(before);
  });

  it("refuses to capture the capturing side's own piece", () => {
    const session = upToLightsMill();
    place(session, "g1");
    const before = session.state;

    capture(session, "d1");

    expect(session.state).toBe(before);
  });

  it("refuses a capture when no mill has been closed", () => {
    const session = createGameSession();
    place(session, "a1", "a7");
    const before = session.state;

    capture(session, "a1");

    expect(session.state).toBe(before);
  });
});

describe("a mill on any of the sixteen lines", () => {
  /** An empty point light is not building its mill on, for dark to fill. */
  const away = (session: GameSession, line: readonly PointId[]) => {
    const filler = session.state.legalPoints.find((point) => !line.includes(point));
    if (!filler) throw new Error("the board ran out of points");
    return filler;
  };

  it.each(LINES.map((line) => ({ line, name: line.join("-") })))(
    "earns light a capture on $name",
    ({ line }) => {
      const session = createGameSession();
      const [first, second, third] = line;
      const dark: PointId[] = [];

      for (const point of [first, second]) {
        place(session, point);
        const filler = away(session, line);
        dark.push(filler);
        place(session, filler);
        expect(session.state.pendingCapture).toBe(false);
      }

      place(session, third);

      expect(session.state.pendingCapture).toBe(true);
      expect([...session.state.legalPoints].sort()).toEqual([...dark].sort());

      capture(session, dark[0] as PointId);

      expect(session.state.position.size).toBe(4);
      expect(session.state.sideToMove).toBe("dark");
    },
  );
});

describe("capturing from a mill", () => {
  /**
   * Dark closes the mill a7-d7-g7 and takes light's f6; light then closes
   * c3-d3-e3. Dark's three pieces all stand in the mill unless `spare` puts a
   * fourth one outside it.
   */
  const upToLightsMill = (spare?: PointId) => {
    const session = createGameSession();

    place(session, "c3", "a7", "d3", "d7", "f6", "g7");
    capture(session, "f6"); // dark's mill takes the light piece that is not part of the plan

    if (spare) place(session, "f6", spare); // light puts it back; dark answers outside its mill
    place(session, "e3");

    return session;
  };

  it("is refused while an opponent piece stands outside a mill", () => {
    const session = upToLightsMill("b2");

    expect(session.state.pendingCapture).toBe(true);
    expect(session.state.legalPoints).toEqual(["b2"]);

    const before = session.state;
    capture(session, "d7");

    expect(session.state).toBe(before);
    expect(session.state.position.get("d7")).toBe("dark");
  });

  it("is allowed once every opponent piece stands in one", () => {
    const session = upToLightsMill();

    expect([...session.state.legalPoints].sort()).toEqual(["a7", "d7", "g7"]);

    capture(session, "d7");

    expect(session.state.position.has("d7")).toBe(false);
    expect(session.state.sideToMove).toBe("dark");
  });
});

describe("a placement closing two mills", () => {
  /** Light takes a1, d1, g4 and g7, so that g1 closes both a1-d1-g1 and g1-g4-g7. */
  const upToTheDoubleMill = () => {
    const session = createGameSession();
    place(session, "a1", "b2", "d1", "c3", "g4", "d5", "g7", "f2");
    return session;
  };

  it("earns exactly one capture", () => {
    const session = upToTheDoubleMill();

    place(session, "g1");

    expect(session.state.pendingCapture).toBe(true);

    capture(session, "b2");

    expect(session.state.pendingCapture).toBe(false);
    expect(session.state.sideToMove).toBe("dark");
    expect(session.state.position.size).toBe(8);
  });
});

describe("the placing phase as a whole", () => {
  /**
   * Eighteen placements, light first, in which light never closes a mill and
   * dark closes exactly one — a1-a4-a7, with its last piece, so that the final
   * placement of the phase is also the one that earns a capture.
   */
  const WHOLE_PHASE = [
    "b2", "a1", "c3", "a4", "c4", "d1", "d2", "b4", "d3",
    "c5", "d5", "e4", "d6", "f2", "f4", "g7", "g1", "a7",
  ] as const satisfies readonly PointId[];

  it("alternates the sides and empties both hands", () => {
    const session = createGameSession();

    place(session, ...WHOLE_PHASE.slice(0, 17));

    expect(session.state.piecesInHand).toEqual({ light: 0, dark: 1 });
    expect(session.state.position.size).toBe(17);
    expect(session.state.sideToMove).toBe("dark");
  });

  it("stays in the placing phase until the last placement's capture is taken", () => {
    const session = createGameSession();

    place(session, ...WHOLE_PHASE);

    expect(session.state.piecesInHand).toEqual({ light: 0, dark: 0 });
    expect(session.state.pendingCapture).toBe(true);
    expect(session.state.phase).toBe("placing");

    capture(session, "b2");

    expect(session.state.phase).toBe("moving");
    expect(session.state.position.size).toBe(17);
    expect(session.state.sideToMove).toBe("light");
  });

  it("offers nothing to play once it is over, until the moving phase arrives", () => {
    const session = createGameSession();

    place(session, ...WHOLE_PHASE);
    capture(session, "b2");

    expect(session.state.legalPoints).toEqual([]);
  });
});
