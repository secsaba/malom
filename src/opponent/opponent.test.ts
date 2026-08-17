import { afterEach, describe, expect, it, vi } from "vitest";

import { gameOf } from "../../tests/fixtures/games";
import { type SearchResult, search } from "../ai/search";
import { type Game, type Move, NEW_GAME } from "../engine/game";
import { DEFAULT_DIFFICULTY, DIFFICULTIES, DIFFICULTY_SETTINGS, NEAR_BEST_MARGIN } from "./difficulty";
import {
  type RunSearch,
  type SearchRequest,
  createOpponent,
  searchInProcess,
} from "./opponent";

/** A search that has already made up its mind. */
const answering = (result: SearchResult): RunSearch => () => Promise.resolve(result);

const A_MOVE: SearchResult = {
  move: { to: "d2" },
  evaluation: 12,
  depth: 3,
  candidates: [{ move: { to: "d2" }, score: 12 }],
};

/**
 * A position with room in it: light and dark two pieces each and seven still in
 * hand, so there are twenty points to place on and plenty of them are worth
 * almost as much as the best. It is what a weakened opponent needs to be weak
 * in, and what the strongest one has to be shown answering the same way twice.
 */
const A_POSITION = gameOf({
  light: ["a1", "d1"],
  dark: ["a4", "d2"],
  sideToMove: "light",
  piecesInHand: { light: 7, dark: 7 },
});

const sameMove = (one: Move | undefined, other: Move | undefined) =>
  one?.to === other?.to && one?.from === other?.from && one?.capture === other?.capture;

/** What the opponent played over a run of turns in the same position. */
const playedRepeatedly = async (
  chooseMove: (game: Game) => Promise<Move | undefined>,
  turns: number,
) => {
  const played: (Move | undefined)[] = [];
  for (let turn = 0; turn < turns; turn += 1) played.push(await chooseMove(A_POSITION));
  return played;
};

afterEach(() => {
  vi.useRealTimers();
});

describe("the opponent", () => {
  it("plays the move the search came back with", async () => {
    const chooseMove = createOpponent(answering(A_MOVE), { minimumDelay: 0 });

    expect(await chooseMove(NEW_GAME, "master")).toEqual({ to: "d2" });
  });

  it("looks as far ahead as the difficulty it is asked to play at", async () => {
    const asked: SearchRequest[] = [];
    const chooseMove = createOpponent(
      (request) => {
        asked.push(request);
        return Promise.resolve(A_MOVE);
      },
      { minimumDelay: 0 },
    );

    for (const difficulty of DIFFICULTIES) await chooseMove(NEW_GAME, difficulty);

    expect(asked).toEqual(
      DIFFICULTIES.map((difficulty) => ({
        game: NEW_GAME,
        depth: DIFFICULTY_SETTINGS[difficulty].depth.placing,
      })),
    );
  });

  /**
   * A flying side reaches every empty point, so the phase it is in decides how
   * much there is to look at — and the difficulty says how deep to look at each.
   */
  it("looks as far ahead as the phase the game is in calls for", async () => {
    const asked: SearchRequest[] = [];
    const chooseMove = createOpponent(
      (request) => {
        asked.push(request);
        return Promise.resolve(A_MOVE);
      },
      { minimumDelay: 0 },
    );

    const moving = gameOf({
      light: ["a1", "b4", "c5", "e3", "g4"],
      dark: ["a7", "b2", "c4", "e5", "g1"],
      sideToMove: "light",
    });
    const flying = gameOf({
      light: ["a1", "c5", "e3"],
      dark: ["a7", "b2", "d7", "e5", "g4"],
      sideToMove: "light",
    });

    await chooseMove(moving, "master");
    await chooseMove(flying, "master");

    expect(asked.map(({ depth }) => depth)).toEqual([
      DIFFICULTY_SETTINGS.master.depth.moving,
      DIFFICULTY_SETTINGS.master.depth.flying,
    ]);
  });

  it("holds a move that took no time at all back, so it never merely flickers", async () => {
    vi.useFakeTimers();
    const chooseMove = createOpponent(answering(A_MOVE), { minimumDelay: 500 });
    let played = false;

    void chooseMove(NEW_GAME, "master").then(() => {
      played = true;
    });

    await vi.advanceTimersByTimeAsync(499);
    expect(played).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(played).toBe(true);
  });

  it("waits no longer than the search itself once that is the slower of the two", async () => {
    vi.useFakeTimers();
    const chooseMove = createOpponent(
      () => new Promise<SearchResult>((resolve) => setTimeout(() => resolve(A_MOVE), 900)),
      { minimumDelay: 500 },
    );
    let played = false;

    void chooseMove(NEW_GAME, "master").then(() => {
      played = true;
    });

    await vi.advanceTimersByTimeAsync(899);
    expect(played).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(played).toBe(true);
  });

  it("has nothing to play in a game that is already over", async () => {
    const overAlready: SearchResult = { move: undefined, evaluation: 0, depth: 0, candidates: [] };
    const chooseMove = createOpponent(answering(overAlready), { minimumDelay: 0 });

    expect(await chooseMove(NEW_GAME, DEFAULT_DIFFICULTY)).toBeUndefined();
  });
});

/**
 * The whole opponent, chance and search and all, run against the same position
 * over and over. This is the difficulty acceptance criterion as a player would
 * meet it: Mester answers the same way every time, and the tiers below it do not.
 */
describe("the same position put to the opponent again and again", () => {
  const opponent = createOpponent(searchInProcess, { minimumDelay: 0 });

  it("is answered by Mester with the same move every time", async () => {
    const played = await playedRepeatedly((game) => opponent(game, "master"), 5);
    const [first] = played;

    expect(first).toBeDefined();
    for (const move of played) expect(sameMove(move, first)).toBe(true);
  });

  it("is answered by Erős with the same move too, whenever it does not blunder", async () => {
    // Chance that never comes up under any blunder rate: the difficulties below
    // Mester are deterministic in everything but when to be weak.
    const steady = createOpponent(searchInProcess, { minimumDelay: 0, random: () => 0.999 });
    const played = await playedRepeatedly((game) => steady(game, "strong"), 3);

    for (const move of played) expect(sameMove(move, played[0])).toBe(true);
  });

  it("is answered by Kezdő with more than one move over a run of them", async () => {
    const played = await playedRepeatedly((game) => opponent(game, "beginner"), 40);
    const distinct = new Set(played.map((move) => JSON.stringify(move)));

    expect(distinct.size).toBeGreaterThan(1);
  });

  /**
   * And the moves it varies between are near-best ones, not legal ones: a weak
   * opponent plays worse, and never plays a move the search ranked far behind.
   */
  it("is answered by Kezdő only with moves the search ranked near the best one", async () => {
    const played = await playedRepeatedly((game) => opponent(game, "beginner"), 40);
    const { candidates } = search(A_POSITION, {
      limits: { depth: DIFFICULTY_SETTINGS.beginner.depth.placing },
    });
    const [best] = candidates;

    for (const move of played) {
      const scored = candidates.find((candidate) => sameMove(candidate.move, move));

      expect(scored, JSON.stringify(move)).toBeDefined();
      expect((best?.score ?? 0) - (scored?.score ?? 0)).toBeLessThanOrEqual(NEAR_BEST_MARGIN);
    }
  });
});

describe("the search the opponent runs in this process", () => {
  it("is the engine itself: it closes the mill in front of it", async () => {
    // Light holds a1 and d1, so g1 makes a mill and earns a capture; dark's a4
    // and d2 kill the other line through each of light's pieces.
    const { move } = await searchInProcess({
      game: A_POSITION,
      depth: DIFFICULTY_SETTINGS.master.depth.placing,
    });

    expect(move?.to).toBe("g1");
    expect(move?.capture).toBeDefined();
  });
});
