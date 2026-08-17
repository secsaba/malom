/**
 * The harness itself, checked with players that answer in no time at all: what
 * they play is beside the point here, and how the games are run is the whole of
 * it. The games that take real thinking — the strength regression and the tuning
 * run — are slow and statistical and live outside the fast suite, in
 * `tests/slow` and `tests/tuning`.
 */

import { describe, expect, it } from "vitest";

import { type Game, type Move, NEW_GAME, afterMove, legalMovesOf } from "../engine/game";
import {
  type Player,
  type Scoreline,
  playGame,
  playMatch,
  randomOpening,
  seededRandom,
  shareOf,
} from "./self-play";

/** A player that takes the first move the rules offer it, whatever it is worth. */
const firstLegal: Player = (game) => legalMovesOf(game)[0];

/** A player with nothing to say, which stops a game where it stands. */
const silent: Player = () => undefined;

/** A player that keeps every game it was asked about, and answers as another would. */
const watching = (answer: Player) => {
  const seen: Game[] = [];

  return { seen, player: ((game) => (seen.push(game), answer(game))) satisfies Player };
};

const AN_OPENING: readonly Move[] = [{ to: "a1" }, { to: "a4" }];

describe("a game played out", () => {
  it("reaches a result", () => {
    const { result, moves } = playGame({ light: firstLegal, dark: firstLegal });

    expect(result).toBeDefined();
    expect(moves).toBeGreaterThan(0);
  });

  it("starts from the opening it was given", () => {
    const { seen, player } = watching(silent);

    const { moves } = playGame({ light: player, dark: player }, { opening: AN_OPENING });

    expect(moves).toBe(AN_OPENING.length);
    expect(seen[0]?.position.get("a1")).toBe("light");
    expect(seen[0]?.position.get("a4")).toBe("dark");
  });

  it("stops at the move cap, with nothing decided", () => {
    const { result, moves } = playGame({ light: firstLegal, dark: firstLegal }, { moveCap: 3 });

    expect(moves).toBe(3);
    expect(result).toBeUndefined();
  });
});

describe("an opening drawn at random", () => {
  it("is the same opening again from the same seed", () => {
    expect(randomOpening(seededRandom(7), 4)).toEqual(randomOpening(seededRandom(7), 4));
  });

  it("is another one from another seed", () => {
    expect(randomOpening(seededRandom(7), 4)).not.toEqual(randomOpening(seededRandom(8), 4));
  });

  it("is as many moves long as it was asked for, and every one of them legal", () => {
    const opening = randomOpening(seededRandom(1), 6);

    expect(opening).toHaveLength(6);
    // Walked through the rules rather than taken on trust: an opening is played
    // into a game before either player is asked, so a move the rules would not
    // have offered would be played all the same.
    let game: Game = NEW_GAME;
    for (const move of opening) {
      expect(legalMovesOf(game)).toContainEqual(move);
      game = afterMove(game, move);
    }
  });
});

describe("a match", () => {
  it("plays each opening twice, once from each side", () => {
    const { seen, player } = watching(firstLegal);

    playMatch(player, firstLegal, { openings: 1, openingMoves: 0, moveCap: 2 });

    expect(seen.map((game) => game.sideToMove)).toEqual(["light", "dark"]);
  });

  it("accounts for every game it played", () => {
    const scoreline = playMatch(firstLegal, firstLegal, { openings: 3 });
    const { wins, draws, losses, unfinished } = scoreline;

    expect(wins + draws + losses + unfinished).toBe(6);
  });

  it("counts a game nobody finished as unfinished rather than as a draw", () => {
    const scoreline = playMatch(firstLegal, firstLegal, { openings: 2, moveCap: 4 });

    expect(scoreline).toEqual({ wins: 0, draws: 0, losses: 0, unfinished: 4 });
  });

  it("is the same match again from the same seed", () => {
    const played = () => playMatch(firstLegal, firstLegal, { openings: 2, seed: 3 });

    expect(played()).toEqual(played());
  });
});

describe("a scoreline", () => {
  const scoreline = (partial: Partial<Scoreline>): Scoreline => ({
    wins: 0,
    draws: 0,
    losses: 0,
    unfinished: 0,
    ...partial,
  });

  it("gives every point to a challenger that won everything", () => {
    expect(shareOf(scoreline({ wins: 4 }))).toBe(1);
  });

  it("splits the points where every game was drawn", () => {
    expect(shareOf(scoreline({ draws: 4 }))).toBe(0.5);
  });

  it("counts a draw as half a win", () => {
    expect(shareOf(scoreline({ wins: 1, draws: 1, losses: 2 }))).toBe(0.375);
  });

  it("leaves the games nobody finished out of it", () => {
    expect(shareOf(scoreline({ wins: 1, losses: 1, unfinished: 6 }))).toBe(0.5);
  });

  it("has nothing to say about a match in which nothing was decided", () => {
    expect(shareOf(scoreline({ unfinished: 4 }))).toBeUndefined();
  });
});
