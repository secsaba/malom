/**
 * The search, run the way it will be run everywhere except in the browser: in
 * this process, synchronously, with no Web Worker anywhere near it. The worker
 * (#7) only passes a game in and a result out; what it calls is exactly this.
 */

import { describe, expect, it } from "vitest";

import { gameOf } from "../../tests/fixtures/games";
import { type Game, NEW_GAME, afterMove, legalMovesOf } from "../engine/game";
import { WIN_SCORE, search } from "./search";

/** Deep enough to see a capture answered, shallow enough to keep the suite fast. */
const SHALLOW = { depth: 3 };

describe("a position with a move that is plainly the best one", () => {
  it("closes the mill in front of it while placing", () => {
    // Light holds a1 and d1, so g1 makes a mill and earns a capture. Dark's a4
    // and d2 kill the other line through each of them — a1-a4-a7 and d1-d2-d3 —
    // so light cannot instead build the fork it would otherwise prefer, and dark
    // holds no line two-deep to block or to race for.
    const game = gameOf({
      light: ["a1", "d1"],
      dark: ["a4", "d2"],
      sideToMove: "light",
      piecesInHand: { light: 7, dark: 7 },
    });

    const { move } = search(game, { limits: SHALLOW });

    expect(move?.to).toBe("g1");
    expect(move?.capture).toBeDefined();
  });

  it("blocks the mill the opponent is one piece from closing", () => {
    // Dark holds a7 and d7, so g7 is the only point that stops the mill. Light's
    // a1 and b6 share no line, so it has no mill of its own to race for.
    const game = gameOf({
      light: ["a1", "b6"],
      dark: ["a7", "d7"],
      sideToMove: "light",
      piecesInHand: { light: 7, dark: 7 },
    });

    const { move } = search(game, { limits: SHALLOW });

    expect(move?.to).toBe("g7");
    expect(move?.capture).toBeUndefined();
  });

  it("slides a piece into a mill once the pieces are all down", () => {
    // Light holds e4 and f4 with g4 empty, and g1 is the one piece that can step
    // into it. The move is not merely good but forced: g7 is dark's, and g4 is
    // next door to it too, so a light piece that goes anywhere else this move
    // comes back to find the mill blocked. Dark holds no line two-deep of its own.
    const game = gameOf({
      light: ["c5", "e4", "f4", "g1"],
      dark: ["a1", "b4", "d3", "g7"],
      sideToMove: "light",
    });

    const { move } = search(game, { limits: SHALLOW });

    expect(move).toMatchObject({ from: "g1", to: "g4" });
    expect(move?.capture).toBeDefined();
  });

  it("takes the piece that was one move from a mill, not the one that was harmless", () => {
    // The same mill again, and this time the capture it earns is the decision:
    // dark's b2 and b4 are a potential mill waiting on b6, while its d3 and g7
    // sit on no line with anything. Taking a harmless one leaves dark — down to
    // three pieces, and so flying — able to reach b6 from anywhere and take a
    // piece straight back.
    const game = gameOf({
      light: ["c5", "e4", "f4", "g1"],
      dark: ["b2", "b4", "d3", "g7"],
      sideToMove: "light",
    });

    const { move } = search(game, { limits: SHALLOW });

    expect(move).toMatchObject({ from: "g1", to: "g4" });
    expect(["b2", "b4"]).toContain(move?.capture);
  });

  it("jumps into a mill from across the board once it is down to flying", () => {
    // Light's three pieces fly, so c5 can go straight to g1 and close a1-d1-g1
    // — and, once it has, light's whole force stands in a mill it can run.
    const game = gameOf({
      light: ["a1", "c5", "d1"],
      dark: ["a7", "b2", "e5", "f6", "g4"],
      sideToMove: "light",
    });

    const { move } = search(game, { limits: SHALLOW });

    expect(move).toMatchObject({ from: "c5", to: "g1" });
    expect(move?.capture).toBeDefined();
  });
});

describe("a game neither side can win any more", () => {
  /**
   * Light is four pieces against eight and losing badly, and the ninety-ninth
   * move since the last capture has just been played: whatever either side does
   * next is the hundredth, and draws. Neither can close a mill in one move — the
   * points that would do it are all reachable only from the line itself — so
   * neither can capture its way out of the count.
   */
  const onTheHundredthMove = (sideToMove: "light" | "dark") =>
    gameOf({
      light: ["a1", "a7", "d1", "g7"],
      dark: ["b2", "b4", "c3", "c4", "d3", "e3", "e5", "f6"],
      sideToMove,
      quietMoves: 99,
    });

  it("evaluates as a draw for the side that is losing", () => {
    expect(search(onTheHundredthMove("light"), { limits: SHALLOW }).evaluation).toBe(0);
  });

  it("evaluates as a draw, and never as a win, for the side that is winning", () => {
    const winning = onTheHundredthMove("dark");

    // With the count nowhere near the fifty, the same position is worth a great
    // deal to dark. It is the draw that takes it down to nothing, not the pieces.
    expect(search({ ...winning, quietStretch: undefined }, { limits: SHALLOW }).evaluation)
      .toBeGreaterThan(0);
    expect(search(winning, { limits: SHALLOW }).evaluation).toBe(0);
  });

  it("has nothing left to prefer once the fifty moves have run out", () => {
    const drawn = afterMove(onTheHundredthMove("light"), { from: "a1", to: "a4" });

    expect(drawn.result).toEqual({ draw: "fifty-move" });
    expect(search(drawn)).toEqual({ move: undefined, evaluation: 0, depth: 0, candidates: [] });
  });

  /**
   * Light steps a1 out to a4 and back while dark does the same with b4 and b6.
   * Neither point closes a mill on the way out or on the way back, so the four
   * moves leave the board exactly as they found it and can be played as often as
   * the rules allow — three times round brings the position they started from up
   * for the third time.
   */
  const CYCLE = [
    { from: "a1", to: "a4" },
    { from: "b4", to: "b6" },
    { from: "a4", to: "a1" },
    { from: "b6", to: "b4" },
  ] as const;

  it("has nothing left to prefer once the same position has come up three times", () => {
    let game: Game = onTheHundredthMove("light");
    // The count the fifty-move rule keeps is the other draw condition's; this is
    // about the position coming round, so it starts the game with the count clear.
    game = { ...game, quietStretch: undefined };

    for (let round = 0; round < 3; round += 1) {
      for (const move of CYCLE) game = afterMove(game, move);
    }

    expect(game.result).toEqual({ draw: "repetition" });
    expect(search(game)).toEqual({ move: undefined, evaluation: 0, depth: 0, candidates: [] });
  });

  it("takes a draw it can repeat its way into rather than the game it is losing", () => {
    let game: Game = { ...onTheHundredthMove("light"), quietStretch: undefined };
    // Twice round the cycle leaves every position of it up for the second time,
    // so the very next move brings one of them up for the third and draws.
    for (let round = 0; round < 2; round += 1) {
      for (const move of CYCLE) game = afterMove(game, move);
    }

    const [drawing] = CYCLE;
    expect(afterMove(game, drawing).result).toEqual({ draw: "repetition" });

    // Light is four pieces against eight, so every other move leaves it the game
    // it is losing, and nothing it can play is worth more than a draw's nought.
    // The search has to see the repetition to prefer that move, and it does.
    expect(search(game, { limits: { depth: 1 } })).toMatchObject({
      move: drawing,
      evaluation: 0,
      depth: 1,
    });
  });
});

describe("a game that is over", () => {
  it("has no move to prefer, and is worth a loss to the side that lost it", () => {
    // Light's three pieces fly; c5 to g1 closes a1-d1-g1 and takes dark's third
    // piece, which leaves dark with two and loses it the game.
    const won = afterMove(
      gameOf({ light: ["a1", "c5", "d1"], dark: ["a7", "e5", "g4"], sideToMove: "light" }),
      { from: "c5", to: "g1", capture: "a7" },
    );

    expect(won.result).toEqual({ winner: "light", ending: "reduced" });
    expect(won.sideToMove).toBe("dark");
    expect(search(won)).toEqual({
      move: undefined,
      evaluation: -WIN_SCORE,
      depth: 0,
      candidates: [],
    });
  });
});

/**
 * The whole root, ranked — what an opponent playing below its best chooses among
 * (#8). The search itself still prefers one move; these are what it had to
 * prefer it over.
 */
describe("the moves the search scored on the way to the one it prefers", () => {
  it("holds every move the rules offer, and nothing else", () => {
    const { candidates } = search(NEW_GAME, { limits: SHALLOW });
    const legal = legalMovesOf(NEW_GAME);

    expect(candidates).toHaveLength(legal.length);
    for (const { move } of candidates) expect(legal).toContainEqual(move);
  });

  it("puts the move it prefers first, and ranks the rest behind it", () => {
    // The mill in front of it again: g1 closes a1-d1-g1 and takes a piece, so it
    // is worth more than anything else on the board and comes back at the head.
    const game = gameOf({
      light: ["a1", "d1"],
      dark: ["a4", "d2"],
      sideToMove: "light",
      piecesInHand: { light: 7, dark: 7 },
    });

    const { move, evaluation, candidates } = search(game, { limits: SHALLOW });
    const [best, ...rest] = candidates;

    expect(best).toEqual({ move, score: evaluation });
    expect(best?.move.to).toBe("g1");

    let behind = best?.score ?? 0;
    for (const { score } of rest) {
      expect(score).toBeLessThanOrEqual(behind);
      behind = score;
    }
  });

  it("has more than one of them to rank, so a weaker opponent has something to choose", () => {
    expect(search(NEW_GAME, { limits: SHALLOW }).candidates.length).toBeGreaterThan(1);
  });
});

describe("how far the search looks", () => {
  it("answers from the depth it was given", () => {
    for (const depth of [1, 2, 3]) {
      expect(search(NEW_GAME, { limits: { depth } }).depth).toBe(depth);
    }
  });

  it("still answers with a move when it is told to stop at once", () => {
    const stopped = search(NEW_GAME, { limits: { depth: 8, shouldStop: () => true } });

    expect(stopped.move).toBeDefined();
    expect(legalMovesOf(NEW_GAME)).toContainEqual(stopped.move);
    // The round that was cut short is thrown away, so the answer is a whole one
    // from a shallower depth rather than half of a deeper one.
    expect(stopped.depth).toBeGreaterThanOrEqual(1);
    expect(stopped.depth).toBeLessThan(8);
  });

  /**
   * A budget the search really has to spend, counted in askings rather than in
   * milliseconds so that the test says the same thing on a fast machine and a
   * slow one. What a clock is for is the worker (#7); what the search needs is
   * only something that eventually answers true.
   */
  const budgetOf = (askings: number) => {
    let asked = 0;
    return () => (asked += 1) > askings;
  };

  it("goes as deep as the budget it is given runs to, and no deeper", () => {
    const brief = search(NEW_GAME, { limits: { depth: 8, shouldStop: budgetOf(1) } });
    const longer = search(NEW_GAME, { limits: { depth: 8, shouldStop: budgetOf(20) } });

    expect(brief.depth).toBeGreaterThanOrEqual(1);
    expect(longer.depth).toBeGreaterThan(brief.depth);
    expect(longer.depth).toBeLessThan(8);
    // Both answers are whole ones: the round the budget cut short is thrown away.
    for (const answer of [brief, longer]) {
      expect(legalMovesOf(NEW_GAME)).toContainEqual(answer.move);
    }
  });

  it("gives the same answer twice, so that the strongest opponent is a fixed one", () => {
    expect(search(NEW_GAME, { limits: SHALLOW })).toEqual(search(NEW_GAME, { limits: SHALLOW }));
  });

  it("prefers a legal move from any position it is given", () => {
    for (const game of [NEW_GAME, afterMove(NEW_GAME, { to: "b4" })]) {
      const { move } = search(game, { limits: { depth: 2 } });

      expect(legalMovesOf(game)).toContainEqual(move);
    }
  });
});
