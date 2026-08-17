/**
 * Self-play: two players handed the same rules and set to play each other over
 * a run of games, so that a question about which of them is stronger is settled
 * by the games rather than by an opinion. It is what the evaluation's weights
 * were measured with (#9), and what the strength regression watches from one
 * change to the next.
 *
 * A player here is nothing but a function from a game to a move. That is all the
 * harness needs, and keeping it to that is what lets the same runner play one
 * set of weights against another, Mester against Kezdő, or either of them
 * against something written for a test in a line. It searches nothing itself and
 * knows no difficulties: the opponent (#8) is built on top of the search, and
 * this is built beside it.
 *
 * It is synchronous, it holds no state between games, and every scrap of chance
 * in it comes from a seed — so a run is repeatable, and a scoreline in a
 * document can be checked rather than believed.
 *
 * **Openings are drawn at random and played in pairs.** Both parts of that
 * matter. The strongest players are deterministic, so two of them left to
 * themselves play one game and one game only, and a hundred repetitions of it
 * say no more than the first did; a few random moves at the start are what makes
 * the run a sample rather than a single game copied out. Playing each opening
 * twice, with the sides the other way round the second time, is what stops the
 * sample from measuring the openings instead of the players: an opening that
 * hands light a winning position hands it to both players in turn, and cancels.
 */

import {
  type Game,
  type Move,
  NEW_GAME,
  type Phase,
  type Result,
  afterMove,
  legalMovesOf,
  phaseOf,
} from "../engine/game";
import type { Side } from "../engine/position";
import type { Weights } from "./evaluation";
import { search } from "./search";

/**
 * A player: what it would play, given a game. Nothing, where it has no move —
 * which the rules have already ended the game over, so a harness that meets one
 * has been handed a player that gave up rather than a position with nothing in
 * it.
 */
export type Player = (game: Game) => Move | undefined;

/** How deep a player looks, in each phase — the shape a difficulty's depths come in. */
export type Depths = Readonly<Record<Phase, number>>;

/**
 * A player that plays the move the search prefers at these weights, looking as
 * far as the depths say. It never plays a weaker move on purpose: what is being
 * measured is the weights, and a blunder rate laid over them would measure the
 * blunders too.
 */
export const playerSearching =
  (weights: Weights, depth: Depths): Player =>
  (game) =>
    search(game, { limits: { depth: depth[phaseOf(game)] }, weights }).move;

/**
 * Chance from a seed: the same seed gives the same numbers in the same order, on
 * any machine, so a run of games written down can be run again and come back the
 * same. It is mulberry32 — thirty-two bits of state and a handful of arithmetic,
 * which is far more than picking opening moves asks of it.
 */
export const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let drawn = Math.imul(state ^ (state >>> 15), 1 | state);
    drawn = (drawn + Math.imul(drawn ^ (drawn >>> 7), 61 | drawn)) ^ drawn;

    return ((drawn ^ (drawn >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * How many moves a game may run to before the harness stops watching. The rules
 * end every game long before this — fifty quiet moves each and the third
 * repetition see to that — so a game that reaches the cap is a game something is
 * wrong with, and is reported as unfinished rather than quietly called a draw.
 */
const DEFAULT_MOVE_CAP = 400;

/** How many moves of a game are drawn at random before the players take over. */
const DEFAULT_OPENING_MOVES = 4;

/** How many openings a match is played over, each of them twice. */
const DEFAULT_OPENINGS = 8;

/**
 * An opening: moves drawn uniformly from the ones the rules offer, which is the
 * whole point of them. A weighted draw would favour the same opening ideas the
 * evaluation already favours, and the sample would be narrower than the board.
 */
export const randomOpening = (random: () => number, moves: number): readonly Move[] => {
  const opening: Move[] = [];
  let game = NEW_GAME;

  for (let played = 0; played < moves && game.result === undefined; played += 1) {
    const legal = legalMovesOf(game);
    const move = legal[Math.floor(random() * legal.length)];
    if (move === undefined) break;

    opening.push(move);
    game = afterMove(game, move);
  }

  return opening;
};

/** What one game came to. */
export type PlayedGame = {
  /** How it ended, or nothing at all where it ran into the move cap. */
  readonly result: Result | undefined;
  /** How many moves were played, the opening's included. */
  readonly moves: number;
};

export type GameOptions = {
  /** The moves the game starts from. They are played before either player is asked. */
  readonly opening?: readonly Move[];
  readonly moveCap?: number;
};

/** One game, played out between the two players until the rules or the cap end it. */
export const playGame = (
  players: Readonly<Record<Side, Player>>,
  { opening = [], moveCap = DEFAULT_MOVE_CAP }: GameOptions = {},
): PlayedGame => {
  let game = NEW_GAME;
  let played = 0;

  for (const move of opening) {
    if (game.result !== undefined || played >= moveCap) break;

    game = afterMove(game, move);
    played += 1;
  }

  while (game.result === undefined && played < moveCap) {
    const move = players[game.sideToMove](game);
    if (move === undefined) break;

    game = afterMove(game, move);
    played += 1;
  }

  return { result: game.result, moves: played };
};

/** How a run of games went, counted from the challenger's side. */
export type Scoreline = {
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  /** Games that ran into the move cap. Nought, in any run worth reading. */
  readonly unfinished: number;
};

const NOTHING_PLAYED: Scoreline = { wins: 0, draws: 0, losses: 0, unfinished: 0 };

/**
 * The challenger's share of the points at stake: a win a point, a draw half of
 * one, out of the games that were decided. A run in which nothing was decided
 * has no share rather than a share of nought — nought is what losing everything
 * looks like, and the two must not read alike.
 */
export const shareOf = ({ wins, draws, losses }: Scoreline): number | undefined => {
  const played = wins + draws + losses;

  return played === 0 ? undefined : (wins + draws / 2) / played;
};

export type MatchOptions = {
  /** How many openings to play. Each is played twice, once from each side. */
  readonly openings?: number;
  /** How many moves long each opening is. */
  readonly openingMoves?: number;
  /** Where the openings come from. The same seed gives the same match. */
  readonly seed?: number;
  readonly moveCap?: number;
};

/** The game a result belongs in the scoreline of, seen from the challenger's side. */
const scoredFor = (challenger: Side, { result }: PlayedGame): keyof Scoreline => {
  if (result === undefined) return "unfinished";
  if ("draw" in result) return "draws";

  return result.winner === challenger ? "wins" : "losses";
};

/**
 * A match: the two players over a run of games, each opening played from both
 * sides, counted from the challenger's side.
 *
 * The challenger takes light in the first game of every pair, which means it
 * takes the first move exactly half the time. That is the only thing the pairing
 * is for, and it is why a match is quoted in openings rather than in games: an
 * odd number of games would leave one of them handing somebody the first move
 * for nothing.
 */
export const playMatch = (
  challenger: Player,
  incumbent: Player,
  {
    openings = DEFAULT_OPENINGS,
    openingMoves = DEFAULT_OPENING_MOVES,
    seed = 1,
    moveCap = DEFAULT_MOVE_CAP,
  }: MatchOptions = {},
): Scoreline => {
  const random = seededRandom(seed);
  let scoreline = NOTHING_PLAYED;

  for (let pair = 0; pair < openings; pair += 1) {
    const opening = randomOpening(random, openingMoves);

    for (const challengerSide of ["light", "dark"] as const) {
      const played = playGame(
        challengerSide === "light"
          ? { light: challenger, dark: incumbent }
          : { light: incumbent, dark: challenger },
        { opening, moveCap },
      );
      const scored = scoredFor(challengerSide, played);

      scoreline = { ...scoreline, [scored]: scoreline[scored] + 1 };
    }
  }

  return scoreline;
};
