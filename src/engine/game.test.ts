/**
 * The whole moves the rules offer and where they lead. How a game is played out
 * — the phases, the mills, the endings and the draws — is tested through the
 * session, which plays it; what is tested here is the shape the search sees it
 * in, because the search is the only thing that asks for whole moves at once.
 */

import { describe, expect, it } from "vitest";

import { gameOf } from "../../tests/fixtures/positions";
import { NEW_GAME, afterMove, legalMovesOf } from "./game";
import { emptyPoints, opponentOf, pointsHeldBy } from "./position";

describe("the moves a game offers", () => {
  it("puts a piece on every empty point while they are still being placed", () => {
    const moves = legalMovesOf(NEW_GAME);

    expect(moves).toHaveLength(24);
    expect(moves.every((move) => move.from === undefined && move.capture === undefined)).toBe(true);
    expect(moves.map((move) => move.to)).toEqual(emptyPoints(NEW_GAME.position));
  });

  it("lists a mill-closing move once for each piece it could take", () => {
    // Light's g1 closes a1-d1-g1; dark's a4 and d2 stand outside mills, so either
    // of them can be the one taken, and which one is a decision of its own.
    const game = gameOf({
      light: ["a1", "d1"],
      dark: ["a4", "d2"],
      sideToMove: "light",
      piecesInHand: { light: 7, dark: 7 },
    });

    const closing = legalMovesOf(game).filter((move) => move.to === "g1");

    expect(closing.map((move) => move.capture)).toEqual(["a4", "d2"]);
    // Every other point is one move, so a mill adds exactly the extra choice.
    expect(legalMovesOf(game)).toHaveLength(emptyPoints(game.position).length + 1);
  });

  it("slides each piece to each of its empty neighbours once the pieces are down", () => {
    // Nine slides: c5 reaches c4 and d5, e4 reaches e3 and e5, f4 reaches f2, f6
    // and g4, and g1 reaches d1 and g4. Only g1's arrival on g4 closes the mill
    // e4-f4-g4 — f4's leaves it a piece short — so only that one is listed four
    // times over, once for each of dark's pieces.
    const game = gameOf({
      light: ["c5", "e4", "f4", "g1"],
      dark: ["a1", "b4", "d3", "g7"],
      sideToMove: "light",
    });

    const moves = legalMovesOf(game);

    expect(moves.filter((move) => move.from === "c5").map((move) => move.to)).toEqual(["c4", "d5"]);
    expect(moves.filter((move) => move.capture !== undefined)).toHaveLength(4);
    expect(moves.filter((move) => move.from === "f4" && move.to === "g4")).toEqual([
      { from: "f4", to: "g4" },
    ]);
    expect(moves).toHaveLength(9 + 3);
  });

  it("offers nothing at all once the game is over", () => {
    const won = afterMove(
      gameOf({ light: ["a1", "c5", "d1"], dark: ["a7", "e5", "g4"], sideToMove: "light" }),
      { from: "c5", to: "g1", capture: "a7" },
    );

    expect(won.result).toEqual({ winner: "light", ending: "reduced" });
    expect(legalMovesOf(won)).toEqual([]);
  });
});

describe("where a move leads", () => {
  it("hands the game over to the opponent, or ends it", () => {
    const game = gameOf({
      light: ["c5", "e4", "f4", "g1"],
      dark: ["a1", "b4", "d3", "g7"],
      sideToMove: "light",
    });

    for (const move of legalMovesOf(game)) {
      const next = afterMove(game, move);

      expect(next.sideToMove).toBe(opponentOf(game.sideToMove));
      expect(next.position.get(move.to)).toBe("light");
      expect(pointsHeldBy(next.position, "dark")).toHaveLength(move.capture ? 3 : 4);
    }
  });

  /**
   * The rules have to run out on their own: a game where both sides always play
   * the first move offered is as dull as one can be, and the point of the draw
   * conditions is that even that one finishes.
   */
  it("brings a game played without a thought to an end", () => {
    const MOVES_ALLOWED = 500;
    let game = NEW_GAME;
    let moves = 0;

    while (game.result === undefined && moves < MOVES_ALLOWED) {
      const [first] = legalMovesOf(game);
      if (!first) throw new Error("a game still to be played offered no move");

      game = afterMove(game, first);
      moves += 1;
    }

    expect(game.result).toBeDefined();
  });
});
