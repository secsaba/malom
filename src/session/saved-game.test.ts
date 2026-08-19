import { describe, expect, it } from "vitest";

import type { PointId } from "../engine/board";
import { MILL_FREE_PLACING, WALLED_IN } from "../../tests/fixtures/games";
import type { SavedGame } from "./saved-game";
import { playedBack, savedGameIn, savedSettingsIn } from "./saved-game";

/** The placements as a saved game keeps them: a move apiece, nothing said about any of them. */
const placements = (points: readonly PointId[]): SavedGame => ({
  moves: points.map((to) => ({ move: { to } })),
});

describe("reading a game back", () => {
  it("takes the moves and who was playing", () => {
    const saved = savedGameIn({ opponentSide: "dark", moves: [{ move: { to: "a1" } }] });

    expect(saved).toEqual({ opponentSide: "dark", moves: [{ move: { to: "a1" }, assessment: undefined }] });
  });

  it("takes a game two people played, which nobody was the computer in", () => {
    expect(savedGameIn({ moves: [] })).toEqual({ opponentSide: undefined, moves: [] });
  });

  it("takes a move with everything a move can have", () => {
    const move = { from: "a1", to: "a4", capture: "g7" };

    expect(savedGameIn({ moves: [{ move }] })?.moves[0]?.move).toEqual(move);
  });

  it("takes what the engine made of a move with it", () => {
    const assessment = {
      grade: "blunder",
      patterns: ["mill-let-through"],
      reason: { kind: "pattern", pattern: "mill-let-through" },
    };

    expect(savedGameIn({ moves: [{ move: { to: "a1" }, assessment }] })?.moves[0]?.assessment).toEqual(
      assessment,
    );
  });

  it("takes a reason that names the move the engine would have played", () => {
    const reason = { kind: "prefers", move: { to: "d2" } };
    const assessment = { grade: "mistake", patterns: [], reason };

    expect(savedGameIn({ moves: [{ move: { to: "a1" }, assessment }] })?.moves[0]?.assessment?.reason).toEqual(
      reason,
    );
  });

  it.each([
    { what: "nothing at all", raw: undefined },
    { what: "text", raw: "a1 d2 g7" },
    { what: "an array", raw: [{ move: { to: "a1" } }] },
    { what: "an object with no moves in it", raw: {} },
    { what: "moves that are not a list", raw: { moves: { to: "a1" } } },
    { what: "a move that is not an object", raw: { moves: ["a1"] } },
    { what: "a move going nowhere", raw: { moves: [{ move: {} }] } },
    { what: "a move to a point off the board", raw: { moves: [{ move: { to: "h9" } }] } },
    { what: "a move from a point off the board", raw: { moves: [{ move: { from: "h9", to: "a1" } }] } },
    { what: "a capture off the board", raw: { moves: [{ move: { to: "a1", capture: "h9" } }] } },
    { what: "a side nobody plays", raw: { opponentSide: "green", moves: [] } },
    {
      what: "a grade nobody gives",
      raw: { moves: [{ move: { to: "a1" }, assessment: { grade: "sublime", patterns: [], reason: { kind: "agrees" } } }] },
    },
    {
      what: "a pattern the engine cannot detect",
      raw: { moves: [{ move: { to: "a1" }, assessment: { grade: "best", patterns: ["vibes"], reason: { kind: "agrees" } } }] },
    },
    {
      what: "a reason of a kind nobody wrote",
      raw: { moves: [{ move: { to: "a1" }, assessment: { grade: "best", patterns: [], reason: { kind: "hunch" } } }] },
    },
    {
      what: "a graded move with no reason",
      raw: { moves: [{ move: { to: "a1" }, assessment: { grade: "best", patterns: [] } }] },
    },
  ])("comes to nothing on $what", ({ raw }) => {
    expect(savedGameIn(raw)).toBeUndefined();
  });
});

describe("playing a saved game again", () => {
  it("gives back every move, the side that played it, and the game it led to", () => {
    const played = playedBack(placements(MILL_FREE_PLACING));

    expect(played).toHaveLength(MILL_FREE_PLACING.length);
    expect(played?.[0]?.by).toBe("light");
    expect(played?.[1]?.by).toBe("dark");
    expect(played?.at(-1)?.game.placing).toBe(false);
    expect(played?.at(-1)?.game.position.size).toBe(MILL_FREE_PLACING.length);
  });

  it("gives back a game nobody has played a move in yet", () => {
    expect(playedBack({ moves: [] })).toEqual([]);
  });

  it("carries what the engine made of a move through with it", () => {
    const assessment = {
      grade: "best",
      patterns: [],
      reason: { kind: "agrees" },
    } as const;
    const played = playedBack({ moves: [{ move: { to: "a1" }, assessment }] });

    expect(played?.[0]?.assessment).toEqual(assessment);
  });

  it("comes to nothing on a move the rules do not allow", () => {
    expect(playedBack(placements(["a1", "a1"]))).toBeUndefined();
  });

  it("comes to nothing on a capture the mill never earned", () => {
    expect(playedBack({ moves: [{ move: { to: "a1", capture: "g7" } }] })).toBeUndefined();
  });

  it("comes to nothing on a move played after the game was over", () => {
    expect(playedBack(placements(WALLED_IN))).toHaveLength(WALLED_IN.length);
    expect(playedBack(placements([...WALLED_IN, "a1"]))).toBeUndefined();
  });
});

describe("reading the settings back", () => {
  it("takes every one of them", () => {
    expect(savedSettingsIn({ difficulty: "strong", teaching: true, warnsOfBlunders: true })).toEqual({
      difficulty: "strong",
      teaching: true,
      warnsOfBlunders: true,
    });
  });

  it("leaves teaching unsaid where the player has never said either way", () => {
    expect(savedSettingsIn({ difficulty: "master" }).teaching).toBeUndefined();
  });

  it.each([
    { what: "nothing at all", raw: undefined },
    { what: "text", raw: "master" },
    { what: "an array", raw: [] },
  ])("comes to no setting at all on $what", ({ raw }) => {
    expect(savedSettingsIn(raw)).toEqual({
      difficulty: undefined,
      teaching: undefined,
      warnsOfBlunders: undefined,
    });
  });

  it("keeps the settings it can read and drops the ones it cannot", () => {
    const settings = savedSettingsIn({ difficulty: "unbeatable", teaching: "yes", warnsOfBlunders: true });

    expect(settings).toEqual({ difficulty: undefined, teaching: undefined, warnsOfBlunders: true });
  });
});
