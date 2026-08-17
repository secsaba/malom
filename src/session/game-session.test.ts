import { describe, expect, it } from "vitest";

import { LINES, type PointId } from "../engine/board";
import { type Game, type Move, legalMovesOf } from "../engine/game";
import { pointsHeldBy } from "../engine/position";
import {
  DARK_PICKINGS,
  MILL_FREE_PLACING,
  REPETITION_CYCLE,
  WALLED_IN,
} from "../../tests/fixtures/games";
import { DEFAULT_DIFFICULTY } from "../opponent/difficulty";
import { createOpponent, searchInProcess } from "../opponent/opponent";
import {
  type ChooseHint,
  type ChooseMove,
  type Difficulty,
  type GameSession,
  createGameSession,
} from "./game-session";

const place = (session: GameSession, ...points: readonly PointId[]) => {
  for (const point of points) session.apply({ type: "place", point });
};

const capture = (session: GameSession, point: PointId) => {
  session.apply({ type: "capture", point });
};

const select = (session: GameSession, point: PointId) => {
  session.apply({ type: "select", point });
};

/** A whole move in the moving phase: pick the piece up, then put it down. */
const slide = (session: GameSession, from: PointId, to: PointId) => {
  select(session, from);
  session.apply({ type: "move", point: to });
};

/** A game played to the end of the placing phase, with light to move. */
const upToTheMovingPhase = () => {
  const session = createGameSession();
  place(session, ...MILL_FREE_PLACING);
  return session;
};

/** Everything queued behind the answer an opponent has just given. */
const settled = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * A stand-in for the engine: it writes down the game it was asked about and
 * answers only when the test says so, which is what a search running off the
 * thread looks like from here.
 */
const askedOpponent = () => {
  const asked: Game[] = [];
  const askedAt: Difficulty[] = [];
  let answer: ((move: Move | undefined) => void) | undefined;

  const chooseMove: ChooseMove = (game, difficulty) => {
    asked.push(game);
    askedAt.push(difficulty);
    return new Promise((resolve) => {
      answer = resolve;
    });
  };

  return {
    asked,
    /** How strongly it was asked to play, one per question. */
    askedAt,
    chooseMove,
    /** Hand back the move the opponent settled on, and let the session act on it. */
    reply: async (move: Move | undefined) => {
      answer?.(move);
      answer = undefined;
      await settled();
    },
  };
};

/**
 * A stand-in for the engine asked for a hint: it writes down the game it was
 * asked about and answers only when the test says so, which is what a
 * full-strength search running off the thread looks like from here.
 */
const askedEngine = () => {
  const asked: Game[] = [];
  let answer: ((move: Move | undefined) => void) | undefined;

  const chooseHint: ChooseHint = (game) => {
    asked.push(game);
    return new Promise((resolve) => {
      answer = resolve;
    });
  };

  return {
    asked,
    chooseHint,
    /** Hand back the move the engine prefers, and let the session act on it. */
    reply: async (move: Move | undefined) => {
      answer?.(move);
      answer = undefined;
      await settled();
    },
  };
};

/** An opponent that plays the first move the rules offer, as soon as it is asked. */
const firstLegalMove: ChooseMove = (game) => Promise.resolve(legalMovesOf(game)[0]);

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
  it("puts the moving side's piece on the point and hands over to the opponent", () => {
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

  it("holds the move open until the capture is taken", () => {
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

  it("takes the captured piece off the board and ends the move", () => {
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
   * Dark closes the mill a7-d7-g7 and takes light's f6; light then answers with
   * c3-d3-e3. Dark's three pieces all stand in the mill unless `spare` puts a
   * fourth one outside it.
   */
  const upToTheAnsweringMill = (spare?: PointId) => {
    const session = createGameSession();

    place(session, "c3", "a7", "d3", "d7", "f6", "g7");
    capture(session, "f6"); // dark's mill takes the light piece that is not part of the plan

    if (spare) place(session, "f6", spare); // light puts it back; dark answers outside its mill
    place(session, "e3");

    return session;
  };

  it("is refused while an opponent piece stands outside a mill", () => {
    const session = upToTheAnsweringMill("b2");

    expect(session.state.pendingCapture).toBe(true);
    expect(session.state.legalPoints).toEqual(["b2"]);

    const before = session.state;
    capture(session, "d7");

    expect(session.state).toBe(before);
    expect(session.state.position.get("d7")).toBe("dark");
  });

  it("is allowed once every opponent piece stands in one", () => {
    const session = upToTheAnsweringMill();

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
});

describe("the moving phase", () => {
  it("offers the side to move the pieces that have somewhere to go", () => {
    const session = upToTheMovingPhase();

    expect(session.state.phase).toBe("moving");
    expect(session.state.sideToMove).toBe("light");

    // Light's a1 and a7 are hemmed in by their own neighbours; the rest can move.
    expect([...session.state.legalPoints].sort()).toEqual([
      "b2",
      "c3",
      "d1",
      "d5",
      "e3",
      "f6",
      "g4",
    ]);
  });

  it("offers only the selected piece's adjacent empty points", () => {
    const session = upToTheMovingPhase();

    select(session, "b2");

    expect(session.state.selection).toBe("b2");
    expect([...session.state.legalPoints].sort()).toEqual(["b4", "d2"]);
  });

  it("slides the selected piece to the point it is sent to and hands over", () => {
    const session = upToTheMovingPhase();

    slide(session, "b2", "b4");

    expect(session.state.position.has("b2")).toBe(false);
    expect(session.state.position.get("b4")).toBe("light");
    expect(session.state.selection).toBeUndefined();
    expect(session.state.sideToMove).toBe("dark");
  });

  it("puts a picked-up piece down again when the tap lands away from it", () => {
    const session = upToTheMovingPhase();
    select(session, "b2");

    select(session, "c4"); // empty, but nowhere b2 can go

    expect(session.state.selection).toBeUndefined();
    expect(session.state.position.get("b2")).toBe("light");
    expect(session.state.position.has("c4")).toBe(false);
    expect(session.state.sideToMove).toBe("light");
  });

  it("puts a picked-up piece down again when it is tapped a second time", () => {
    const session = upToTheMovingPhase();
    select(session, "b2");

    select(session, "b2");

    expect(session.state.selection).toBeUndefined();
    expect(session.state.legalPoints).toContain("b2"); // back to the pieces that can move
  });

  it("picks up another piece instead when that is what the tap lands on", () => {
    const session = upToTheMovingPhase();
    select(session, "b2");

    select(session, "d5");

    expect(session.state.selection).toBe("d5");
    expect(session.state.legalPoints).toEqual(["d6"]);
  });

  it("picks up neither the opponent's pieces nor its own hemmed-in ones", () => {
    const session = upToTheMovingPhase();
    const before = session.state;

    select(session, "a4"); // dark's
    select(session, "a1"); // light's, but with nowhere to go

    expect(session.state).toBe(before);
  });

  it("sends nothing anywhere until a piece has been picked up", () => {
    const session = upToTheMovingPhase();
    const before = session.state;

    session.apply({ type: "move", point: "d2" });

    expect(session.state).toBe(before);
  });
});

describe("a mill closed in the moving phase", () => {
  /**
   * Light walks e3 and f6 in to close e4-f4-g4 on its second move; dark answers
   * out of the way, on the far side of the board.
   */
  const upToLightsMovingMill = () => {
    const session = upToTheMovingPhase();

    slide(session, "e3", "e4");
    slide(session, "a4", "b4");
    slide(session, "f6", "f4");

    return session;
  };

  it("earns a capture, on the same terms as one closed by a placement", () => {
    const session = upToLightsMovingMill();

    expect(session.state.pendingCapture).toBe(true);
    expect(session.state.sideToMove).toBe("light");
    expect(session.state.selection).toBeUndefined();
    expect(session.state.legalPoints).toHaveLength(9); // no dark piece stands in a mill
  });

  it("ends the move once the capture is taken", () => {
    const session = upToLightsMovingMill();

    capture(session, "b4");

    expect(session.state.position.has("b4")).toBe(false);
    expect(session.state.pendingCapture).toBe(false);
    expect(session.state.sideToMove).toBe("dark");
  });
});

/**
 * Light closes e4-f4-g4 and then runs it — stepping f4 out to f6 and back again
 * — so that every second move earns another capture, while dark shuffles
 * harmlessly between a4 and b4. Dark closes no mill of its own along the way, so
 * every one of its pieces stays capturable.
 */
const upToTheRunningMill = () => {
  const session = upToTheMovingPhase();

  slide(session, "e3", "e4");
  slide(session, "a4", "b4");
  slide(session, "f6", "f4"); // closes e4-f4-g4

  return session;
};

const runTheMill = (session: GameSession, pickings: readonly PointId[]) => {
  const [first, ...rest] = pickings;
  if (!first) throw new Error("the mill has nothing to capture");

  capture(session, first);

  for (const picking of rest) {
    slide(session, "b4", "a4"); // dark
    slide(session, "f4", "f6"); // light steps out of the mill
    slide(session, "a4", "b4"); // dark
    slide(session, "f6", "f4"); // and back in, closing it again
    capture(session, picking);
  }
};

describe("wearing the opponent down", () => {
  it("lets a side reduced to three pieces jump to any empty point", () => {
    const session = upToTheRunningMill();

    runTheMill(session, DARK_PICKINGS.slice(0, 6));

    expect(session.state.sideToMove).toBe("dark");
    expect(pointsHeldBy(session.state.position, "dark")).toHaveLength(3);
    expect(session.state.phase).toBe("flying");

    select(session, "g7");

    expect(session.state.legalPoints).toHaveLength(12); // every empty point
    expect(session.state.legalPoints).toContain("a4"); // nowhere near g7
  });

  it("ends the game when a side is reduced to two pieces", () => {
    const session = upToTheRunningMill();

    runTheMill(session, DARK_PICKINGS);

    expect(pointsHeldBy(session.state.position, "dark")).toHaveLength(2);
    expect(session.state.result).toEqual({ winner: "light", ending: "reduced" });
  });
});

describe("a side with nowhere to go", () => {
  const upToTheWall = () => {
    const session = createGameSession();
    place(session, ...WALLED_IN);
    return session;
  };

  it("loses the game however many pieces it still has", () => {
    const session = upToTheWall();

    expect(session.state.sideToMove).toBe("light");
    expect(pointsHeldBy(session.state.position, "light")).toHaveLength(9);
    expect(session.state.result).toEqual({ winner: "dark", ending: "blocked" });
  });

  it("is offered nothing to play, and plays nothing", () => {
    const session = upToTheWall();
    const before = session.state;

    expect(before.legalPoints).toEqual([]);

    select(session, "b2");
    place(session, "a1");
    capture(session, "g7");

    expect(session.state).toBe(before);
  });
});

describe("a position that comes up three times", () => {
  /** Both sides step a piece out and back again, leaving the position they found. */
  const shuffle = (session: GameSession, times: number) => {
    for (let time = 0; time < times; time += 1) {
      for (const [from, to] of REPETITION_CYCLE) slide(session, from, to);
    }
  };

  it("is still a game to play the second time round", () => {
    const session = upToTheMovingPhase();

    shuffle(session, 1);

    expect(session.state.result).toBeUndefined();
    expect(session.state.legalPoints.length).toBeGreaterThan(0);
  });

  it("draws the game", () => {
    const session = upToTheMovingPhase();

    shuffle(session, 2);

    expect(session.state.result).toEqual({ draw: "repetition" });
  });

  it("leaves nothing to play once it has drawn it", () => {
    const session = upToTheMovingPhase();
    shuffle(session, 2);
    const before = session.state;

    expect(before.legalPoints).toEqual([]);

    slide(session, "b2", "d2");

    expect(session.state).toBe(before);
  });
});

describe("fifty moves by each player without a capture", () => {
  /**
   * Two orbits of empty points for dark's wanderers, five points and six, so the
   * pair of them comes back round only after thirty turns each — longer than the
   * fifty moves played here, and so a game in which no position ever comes up
   * twice. Neither orbit touches c3 or c4, which light shuffles between.
   */
  const [FIVE, SIX] = [
    ["d2", "d3", "d6", "d7", "f2"],
    ["a4", "b6", "c5", "e3", "e5", "f6"],
  ] as const satisfies readonly (readonly PointId[])[];

  /** One of dark's loose pieces: where it stands, and the orbit it is going round. */
  type Wanderer = { at: PointId; readonly orbit: readonly PointId[] };

  /** Where a wanderer goes on its nth turn: one point further round its orbit. */
  const around = (orbit: readonly PointId[], turn: number): PointId => {
    const point = orbit[turn % orbit.length];
    if (!point) throw new Error("the wanderer has no orbit to go round");
    return point;
  };

  const MOVES_EACH = 50;

  /**
   * Dark, worn down to three pieces and flying, sends its two loose pieces round
   * their orbits turn and turn about while light shuffles c3 out to c4 and back.
   * Dark's third piece stays on b4, which no line joins to g1, so dark cannot
   * close a mill however it flies; light's mill is closed already and shuffling
   * c3 does not close another. Nothing is captured for a hundred moves.
   */
  it("draws the game, counting from the last capture rather than from the first move", () => {
    const session = upToTheRunningMill();
    runTheMill(session, DARK_PICKINGS.slice(0, 6));

    expect(session.state.phase).toBe("flying");
    expect(session.state.sideToMove).toBe("dark");

    const five: Wanderer = { at: "g1", orbit: FIVE };
    const six: Wanderer = { at: "g7", orbit: SIX };
    let light: PointId = "c3";

    for (let move = 0; move < MOVES_EACH; move += 1) {
      const wanderer = move % 2 === 0 ? five : six;
      const flyTo = around(wanderer.orbit, Math.floor(move / 2));
      slide(session, wanderer.at, flyTo);
      wanderer.at = flyTo;

      // Dark's move is never the hundredth: light plays that one.
      expect(session.state.result, `after dark's move ${move + 1}`).toBeUndefined();

      const stepTo: PointId = light === "c3" ? "c4" : "c3";
      slide(session, light, stepTo);
      light = stepTo;

      if (move < MOVES_EACH - 1) {
        expect(session.state.result, `after light's move ${move + 1}`).toBeUndefined();
      }
    }

    expect(session.state.result).toEqual({ draw: "fifty-move" });
  });
});

describe("playing the computer", () => {
  it("asks nobody anything in a game two people are playing", () => {
    const opponent = askedOpponent();

    const session = createGameSession({ chooseMove: opponent.chooseMove });
    place(session, "a1");

    expect(opponent.asked).toEqual([]);
    expect(session.state.thinking).toBe(false);
    expect(session.state.opponentSide).toBeUndefined();
  });

  it("asks for a move straight away where the game starts with the computer to move", () => {
    const opponent = askedOpponent();

    const session = createGameSession({
      chooseMove: opponent.chooseMove,
      players: { opponentSide: "light" },
    });

    expect(opponent.asked).toHaveLength(1);
    expect(session.state.thinking).toBe(true);
  });

  it("plays the move it is given and stops thinking", async () => {
    const opponent = askedOpponent();
    const session = createGameSession({
      chooseMove: opponent.chooseMove,
      players: { opponentSide: "light" },
    });

    await opponent.reply({ to: "d2" });

    expect(session.state.position.get("d2")).toBe("light");
    expect(session.state.sideToMove).toBe("dark");
    expect(session.state.thinking).toBe(false);
  });

  it("plays the capture the move it is given earned, in the one move", async () => {
    const opponent = askedOpponent();
    const session = createGameSession({
      chooseMove: opponent.chooseMove,
      players: { opponentSide: "dark" },
    });

    place(session, "b2"); // light, the player
    await opponent.reply({ to: "a1" });
    place(session, "b4");
    await opponent.reply({ to: "d1" });
    place(session, "c5"); // three light pieces, no two of them on a line
    await opponent.reply({ to: "g1", capture: "b2" }); // dark closes a1-d1-g1

    expect(session.state.position.has("b2")).toBe(false);
    expect(session.state.pendingCapture).toBe(false);
    expect(session.state.sideToMove).toBe("light");
  });

  it("offers the player nothing to act on while the computer is to move", () => {
    const opponent = askedOpponent();
    const session = createGameSession({
      chooseMove: opponent.chooseMove,
      players: { opponentSide: "light" },
    });

    expect(session.state.legalPoints).toEqual([]);
  });

  it("ignores what the player taps while the computer is to move", async () => {
    const opponent = askedOpponent();
    const session = createGameSession({
      chooseMove: opponent.chooseMove,
      players: { opponentSide: "light" },
    });
    const before = session.state;

    place(session, "a1");
    select(session, "a1");

    expect(session.state).toBe(before);

    await opponent.reply({ to: "d2" });

    expect(session.state.position.size).toBe(1);
  });

  it("asks again as soon as the player has moved", async () => {
    const opponent = askedOpponent();
    const session = createGameSession({
      chooseMove: opponent.chooseMove,
      players: { opponentSide: "dark" },
    });

    expect(opponent.asked).toEqual([]);

    place(session, "a1");

    expect(opponent.asked).toHaveLength(1);
    expect(opponent.asked[0]?.position.get("a1")).toBe("light");
    expect(session.state.thinking).toBe(true);

    await opponent.reply({ to: "g7" });

    expect(session.state.sideToMove).toBe("light");
    expect(session.state.legalPoints).toHaveLength(22);
  });

  it("waits for the player rather than playing on where the move ends the game", async () => {
    const opponent = askedOpponent();
    const session = createGameSession({
      chooseMove: opponent.chooseMove,
      players: { opponentSide: "dark" },
    });

    for (let index = 0; index < WALLED_IN.length; index += 2) {
      const [forLight, forDark] = WALLED_IN.slice(index, index + 2);
      if (!forLight || !forDark) throw new Error("the placing order has an odd number of points");

      place(session, forLight);
      await opponent.reply({ to: forDark }); // dark's nine wall light in
    }

    expect(session.state.result).toEqual({ winner: "dark", ending: "blocked" });
    expect(session.state.thinking).toBe(false);
    expect(opponent.asked).toHaveLength(9);
  });
});

describe("how strongly the computer plays", () => {
  const playingTheComputer = (difficulty?: Difficulty) => {
    const opponent = askedOpponent();
    const session = createGameSession({
      chooseMove: opponent.chooseMove,
      players: { opponentSide: "dark" },
      ...(difficulty ? { difficulty } : {}),
    });

    return { opponent, session };
  };

  it("starts where a player who has chosen nothing would want it", () => {
    expect(createGameSession().state.difficulty).toBe(DEFAULT_DIFFICULTY);
  });

  it("is whatever the game was started at, and is what the computer is asked for", () => {
    const { opponent, session } = playingTheComputer("strong");

    place(session, "a1");

    expect(session.state.difficulty).toBe("strong");
    expect(opponent.askedAt).toEqual(["strong"]);
  });

  it("changes to the one the player picked, and the interface hears about it", () => {
    const { session } = playingTheComputer("beginner");
    let told = 0;
    session.subscribe(() => {
      told += 1;
    });

    session.playAt("master");

    expect(session.state.difficulty).toBe("master");
    expect(told).toBe(1);
  });

  /** The acceptance criterion: nobody gives up a game by changing difficulty. */
  it("changes in the middle of a game without disturbing the game", async () => {
    const { opponent, session } = playingTheComputer("beginner");
    place(session, "a1");
    await opponent.reply({ to: "g7" });
    place(session, "d1");
    await opponent.reply({ to: "d7" });

    session.playAt("master");

    expect(session.state.position.get("a1")).toBe("light");
    expect(session.state.position.get("g7")).toBe("dark");
    expect(session.state.position.size).toBe(4);
    expect(session.state.sideToMove).toBe("light");
    expect(session.state.piecesInHand).toEqual({ light: 7, dark: 7 });
  });

  it("is what the computer is asked for from its next move on", async () => {
    const { opponent, session } = playingTheComputer("beginner");
    place(session, "a1");
    await opponent.reply({ to: "g7" });

    session.playAt("master");
    place(session, "d1");

    expect(opponent.askedAt).toEqual(["beginner", "master"]);
  });

  it("is a setting rather than part of a game, so another game is played at it too", () => {
    const { opponent, session } = playingTheComputer("beginner");

    session.playAt("strong");
    session.start({ opponentSide: "light" });

    expect(session.state.difficulty).toBe("strong");
    expect(opponent.askedAt).toEqual(["strong"]);
  });

  it("leaves everything as it was when the player picks the one already being played", () => {
    const { session } = playingTheComputer("strong");
    const before = session.state;
    let told = 0;
    session.subscribe(() => {
      told += 1;
    });

    session.playAt("strong");

    expect(session.state).toBe(before);
    expect(told).toBe(0);
  });
});

/**
 * The difficulties as a player meets them: through the facade, with the real
 * engine behind it rather than a stand-in. Nothing here says what the computer
 * should play — only that Mester plays the same thing twice and that Kezdő does
 * not, which is what the four difficulties are for.
 */
describe("the game a difficulty actually produces", () => {
  const engine = createOpponent(searchInProcess, { minimumDelay: 0 });

  /** The point the computer opened on, playing light at this difficulty. */
  const openedBy = async (difficulty: Difficulty) => {
    const session = createGameSession({
      chooseMove: engine,
      players: { opponentSide: "light" },
      difficulty,
    });

    while (session.state.thinking) await settled();

    return [...session.state.position.keys()][0];
  };

  it("opens the same way every time at Mester", async () => {
    const opened: (PointId | undefined)[] = [];
    for (let again = 0; again < 3; again += 1) opened.push(await openedBy("master"));

    expect(opened[0]).toBeDefined();
    expect(new Set(opened).size).toBe(1);
  });

  it("opens more than one way over a run of games at Kezdő", async () => {
    const opened = new Set<PointId | undefined>();
    for (let again = 0; again < 40; again += 1) opened.add(await openedBy("beginner"));

    expect(opened.size).toBeGreaterThan(1);
  });
});

/**
 * Teaching is a setting rather than a mode, so it is on offer whoever is playing.
 * Where the player has not said either way, who is playing decides it: somebody
 * who has sat down against the computer is learning, and two people sharing a
 * device have not asked to be taught.
 */
describe("teaching", () => {
  it("is off in a game two people are sharing a device for", () => {
    expect(createGameSession().state.teaching).toBe(false);
  });

  it("is on in a game against the computer", () => {
    const session = createGameSession({
      chooseMove: askedOpponent().chooseMove,
      players: { opponentSide: "dark" },
    });

    expect(session.state.teaching).toBe(true);
  });

  it("switches on where two people ask to be taught, and the interface hears about it", () => {
    const session = createGameSession();
    let told = 0;
    session.subscribe(() => {
      told += 1;
    });

    session.teach(true);

    expect(session.state.teaching).toBe(true);
    expect(told).toBe(1);
  });

  it("leaves everything as it was when the player asks for what is already on", () => {
    const session = createGameSession();
    const before = session.state;

    session.teach(false);

    expect(session.state).toBe(before);
  });

  /** A setting, like difficulty: a choice the player made outlives the game they made it in. */
  it("stays where the player put it when another game is started", () => {
    const session = createGameSession();

    session.teach(true);
    session.start({});

    expect(session.state.teaching).toBe(true);
  });

  it("follows who is playing until the player has said, and their word after that", () => {
    const session = createGameSession();

    session.start({ opponentSide: "dark" });
    expect(session.state.teaching).toBe(true);

    session.start({});
    expect(session.state.teaching).toBe(false);

    session.teach(true);
    session.start({});

    expect(session.state.teaching).toBe(true);
  });
});

describe("asking for a hint", () => {
  /** A game two people are playing, with teaching switched on. */
  const beingTaught = () => {
    const engine = askedEngine();
    const session = createGameSession({ chooseHint: engine.chooseHint });
    session.teach(true);

    return { engine, session };
  };

  it("asks the engine about the game as it stands, and shows what it comes back with", async () => {
    const { engine, session } = beingTaught();
    place(session, "a1");

    session.askForHint();

    expect(engine.asked).toHaveLength(1);
    expect(engine.asked[0]?.position.get("a1")).toBe("light");
    expect(session.state.hinting).toBe(true);
    expect(session.state.hint).toBeUndefined();

    await engine.reply({ to: "d2" });

    expect(session.state.hint).toEqual({ to: "d2" });
    expect(session.state.hinting).toBe(false);
  });

  it("shows the whole move it prefers, the capture it earns included", async () => {
    const { engine, session } = beingTaught();
    place(session, "a1", "a7", "d1", "d7");

    session.askForHint();
    await engine.reply({ to: "g1", capture: "a7" });

    expect(session.state.hint).toEqual({ to: "g1", capture: "a7" });
  });

  it("asks once while the engine is working one out", () => {
    const { engine, session } = beingTaught();

    session.askForHint();
    session.askForHint();

    expect(engine.asked).toHaveLength(1);
  });

  it("shows nothing where the engine came back with no move", async () => {
    const { engine, session } = beingTaught();

    session.askForHint();
    await engine.reply(undefined);

    expect(session.state.hint).toBeUndefined();
    expect(session.state.hinting).toBe(false);
  });

  /** Advice about one position, and only about that one. */
  it("goes off the board as soon as a move is played", async () => {
    const { engine, session } = beingTaught();
    session.askForHint();
    await engine.reply({ to: "d2" });

    place(session, "d2");

    expect(session.state.hint).toBeUndefined();
  });

  it("stays while the player picks up the piece it named", async () => {
    const engine = askedEngine();
    const session = createGameSession({ chooseHint: engine.chooseHint });
    session.teach(true);
    place(session, ...MILL_FREE_PLACING);

    session.askForHint();
    await engine.reply({ from: "b2", to: "b4" });
    select(session, "b2");

    expect(session.state.selection).toBe("b2");
    expect(session.state.hint).toEqual({ from: "b2", to: "b4" });
  });

  it("goes off the board when teaching does, and does not come back with it", async () => {
    const { engine, session } = beingTaught();
    session.askForHint();
    await engine.reply({ to: "d2" });

    session.teach(false);

    expect(session.state.hint).toBeUndefined();

    session.teach(true);

    expect(session.state.hint).toBeUndefined();
  });

  it("is neither offered nor asked for while teaching is off", () => {
    const engine = askedEngine();
    const session = createGameSession({ chooseHint: engine.chooseHint });

    expect(session.state.hintOffered).toBe(false);

    session.askForHint();

    expect(engine.asked).toEqual([]);
    expect(session.state.hinting).toBe(false);
  });

  it("is not offered by a session with no engine to ask", () => {
    const session = createGameSession();
    session.teach(true);

    expect(session.state.hintOffered).toBe(false);
  });

  /** The acceptance criterion: a hint is about the move the player is looking at. */
  it("is neither offered nor asked for while the computer is to move", () => {
    const engine = askedEngine();
    const session = createGameSession({
      chooseMove: askedOpponent().chooseMove,
      chooseHint: engine.chooseHint,
      players: { opponentSide: "light" },
    });

    expect(session.state.teaching).toBe(true);
    expect(session.state.thinking).toBe(true);
    expect(session.state.hintOffered).toBe(false);

    session.askForHint();

    expect(engine.asked).toEqual([]);
  });

  it("is not offered with a capture owed — half a move is not a move to prefer", () => {
    const { session } = beingTaught();

    place(session, "a1", "a7", "d1", "d7", "g1"); // light closes a1-d1-g1

    expect(session.state.pendingCapture).toBe(true);
    expect(session.state.hintOffered).toBe(false);
  });

  it("is not offered in a game that is over", () => {
    const engine = askedEngine();
    const session = createGameSession({ chooseHint: engine.chooseHint });
    session.teach(true);

    place(session, ...WALLED_IN);

    expect(session.state.result).toBeDefined();
    expect(session.state.hintOffered).toBe(false);
  });

  it("discards the answer to a game that has been thrown away", async () => {
    const { engine, session } = beingTaught();
    session.askForHint();

    session.start({});
    await engine.reply({ to: "d2" });

    expect(session.state.hint).toBeUndefined();
    expect(session.state.hinting).toBe(false);
  });
});

describe("starting another game", () => {
  it("puts the board back and hands the first move to the player", () => {
    const session = createGameSession();
    place(session, "a1", "g7");

    session.start({});

    expect(session.state.position.size).toBe(0);
    expect(session.state.sideToMove).toBe("light");
    expect(session.state.piecesInHand).toEqual({ light: 9, dark: 9 });
    expect(session.state.lastArrival).toBeUndefined();
  });

  it("hands the first move to the computer where the player took dark", () => {
    const opponent = askedOpponent();
    const session = createGameSession({ chooseMove: opponent.chooseMove });

    session.start({ opponentSide: "light" });

    expect(session.state.opponentSide).toBe("light");
    expect(opponent.asked).toHaveLength(1);
    expect(session.state.thinking).toBe(true);
  });

  it("plays the sides the other way round for a rematch", async () => {
    const opponent = askedOpponent();
    const session = createGameSession({
      chooseMove: opponent.chooseMove,
      players: { opponentSide: "dark" },
    });
    place(session, "a1");
    await opponent.reply({ to: "g7" });

    session.start({ opponentSide: "light" });

    expect(session.state.position.size).toBe(0);
    expect(session.state.opponentSide).toBe("light");
    expect(opponent.asked).toHaveLength(2);
  });

  it("discards the move the game before was still thinking about", async () => {
    const opponent = askedOpponent();
    const session = createGameSession({
      chooseMove: opponent.chooseMove,
      players: { opponentSide: "light" },
    });

    session.start({ opponentSide: "dark" });
    await opponent.reply({ to: "d2" }); // the answer to the game that was abandoned

    expect(session.state.position.size).toBe(0);
    expect(session.state.thinking).toBe(false);
    expect(session.state.sideToMove).toBe("light");
  });
});

describe("the piece that came to rest last", () => {
  it("is named by where it was placed", () => {
    const session = createGameSession();

    place(session, "a1");

    expect(session.state.lastArrival).toEqual({ to: "a1" });
  });

  it("is named by where it came from and where it went once pieces move", () => {
    const session = upToTheMovingPhase();

    slide(session, "b2", "b4");

    expect(session.state.lastArrival).toEqual({ from: "b2", to: "b4" });
  });

  it("stays named while the capture it earned is owed", () => {
    const session = createGameSession();
    place(session, "a1", "a7", "d1", "d7");

    place(session, "g1"); // closes a1-d1-g1

    expect(session.state.pendingCapture).toBe(true);
    expect(session.state.lastArrival).toEqual({ to: "g1" });

    capture(session, "a7");

    expect(session.state.lastArrival).toEqual({ to: "g1" });
  });

  it("names the computer's arrival without the piece it took", async () => {
    const session = createGameSession({
      chooseMove: firstLegalMove,
      players: { opponentSide: "light" },
    });
    await settled();

    expect(session.state.lastArrival).toEqual({ to: "a1" }); // the first point the rules offer
  });
});
