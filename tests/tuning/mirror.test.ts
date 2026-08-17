/**
 * Mester against Mester: the measurements behind the awkward half of
 * `docs/tuning/weights.md`.
 *
 *     pnpm tune -- -t mirror
 *
 * Malom is a draw with perfect play, so ticket #9 asked for a sanity check —
 * Mester against Mester should draw reliably, and an engine that beats a copy of
 * itself has found something in its own evaluation to exploit. The answer turned
 * out to be no, and a decision was taken on the strength of that answer: the
 * start-position draw was not made an acceptance gate, and the tuned weights
 * ship without it. A decision resting on measurements deserves measurements
 * anyone can take again, which is what this file is. Nothing here asserts a
 * strength claim — it prints, and the reading is in the document.
 *
 * The three runs answer three different objections in turn. **Openings** asks
 * whether the engine only fails to draw from positions no sensible player would
 * reach. **Depths** asks whether it is simply not looking far enough, which is
 * the answer that would make this a scheduling problem rather than an evaluation
 * one. **Sets** asks whether the drawn start-position game says anything about
 * an engine at all, or only about one line — and that is the run that decided
 * the matter.
 *
 * A mirror match is worth half what it looks: both sides are the same
 * deterministic function, so an opening played from both sides is one game
 * played twice, and the pairs always split exactly. These runs therefore play
 * each opening once and count games, not points.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_WEIGHTS, type Tally, type Weights } from "../../src/ai/evaluation";
import { search } from "../../src/ai/search";
import {
  type Depths,
  type Player,
  playGame,
  playerSearching,
  randomOpening,
  seededRandom,
} from "../../src/ai/self-play";
import { NEW_GAME, afterMove, type Move, type Phase } from "../../src/engine/game";
import {
  DIFFICULTY_SETTINGS,
  NEAR_BEST_COUNT,
  NEAR_BEST_MARGIN,
  depthAt,
} from "../../src/opponent/difficulty";

const SEED = 20260817;
const GAMES = 6;
const MESTER = DIFFICULTY_SETTINGS.master.depth;

/** Mester itself, playing the weights that ship. */
const mester = playerSearching(DEFAULT_WEIGHTS, MESTER);

/**
 * An opening Mester would willingly enter: each move drawn from the shortlist it
 * ranked near its own best, which is the same shortlist a weakened difficulty
 * draws its mistakes from. Uniformly random openings are the harsher test and
 * they are run too, but they can hand a side a lost game before either player
 * has chosen anything, and a decisive game from one of those is no evidence at
 * all.
 */
const nearBestOpening = (random: () => number, moves: number): readonly Move[] => {
  const opening: Move[] = [];
  let game = NEW_GAME;

  for (let played = 0; played < moves; played += 1) {
    const { candidates } = search(game, { limits: { depth: depthAt("master", game) } });
    const [best] = candidates;
    if (best === undefined) break;

    const shortlist = candidates
      .filter(({ score }) => best.score - score <= NEAR_BEST_MARGIN)
      .slice(0, NEAR_BEST_COUNT + 1);
    const chosen = shortlist[Math.floor(random() * shortlist.length)];
    if (chosen === undefined) break;

    opening.push(chosen.move);
    game = afterMove(game, chosen.move);
  }

  return opening;
};

/** How a run of mirror games ended, as a line for the document. */
const tally = (played: readonly ReturnType<typeof playGame>[]): string => {
  const drawn = played.filter(({ result }) => result && "draw" in result).length;
  const blocked = played.filter(
    ({ result }) => result && "ending" in result && result.ending === "blocked",
  ).length;

  return `${drawn} drawn of ${played.length}, ${blocked} lost by being shut in`;
};

describe("mirror: how much of an opening it takes to stop Mester drawing itself", () => {
  it.each([0, 1, 2, 3, 4, 6])("%i random moves in", (moves) => {
    const random = seededRandom(SEED);
    const played = Array.from({ length: GAMES }, () =>
      playGame({ light: mester, dark: mester }, { opening: randomOpening(random, moves) }),
    );

    console.log(`random opening of ${moves}: ${tally(played)}`);

    expect(played).toHaveLength(GAMES);
  });

  it.each([2, 4, 6])("%i moves it would have chosen itself", (moves) => {
    const random = seededRandom(SEED);
    const played = Array.from({ length: GAMES }, () =>
      playGame({ light: mester, dark: mester }, { opening: nearBestOpening(random, moves) }),
    );

    console.log(`near-best opening of ${moves}: ${tally(played)}`);

    expect(played).toHaveLength(GAMES);
  });
});

describe("mirror: whether looking further brings the draw back", () => {
  const DEEPER: readonly Depths[] = [
    { placing: 2, moving: 2, flying: 2 },
    { placing: 3, moving: 3, flying: 3 },
    MESTER,
    { placing: 5, moving: 6, flying: 4 },
  ];

  it.each(DEEPER)("at depths %o", (depth) => {
    const random = seededRandom(SEED);
    const player = playerSearching(DEFAULT_WEIGHTS, depth);
    const played = Array.from({ length: GAMES }, () =>
      playGame({ light: player, dark: player }, { opening: nearBestOpening(random, 2) }),
    );

    console.log(`depths ${JSON.stringify(depth)}: ${tally(played)}`);

    expect(played).toHaveLength(GAMES);
  });
});

/**
 * The run the decision rests on. If the drawn start-position game were a
 * property of a sound engine, sound engines would draw it; if it is a property
 * of one line, then nudging any weight that line passes through will break it.
 * It is the second: of the ten sets below, two draw, and the gentlest change on
 * the list — mobility from 3 to 5, on a table where a piece is a hundred — turns
 * a 52-move draw into a win in 85.
 */
describe("mirror: whether the start-position draw survives being nudged", () => {
  const nudged = (name: string, moved: Partial<Record<Phase, Partial<Tally>>>) => ({
    name,
    weights: {
      placing: { ...DEFAULT_WEIGHTS.placing, ...moved.placing },
      moving: { ...DEFAULT_WEIGHTS.moving, ...moved.moving },
      flying: { ...DEFAULT_WEIGHTS.flying, ...moved.flying },
    } satisfies Weights,
  });

  // Stated against the weights that ship, which are the tuned ones — so the set
  // of guesses this all started from is itself one of the nudges now.
  const SETS = [
    nudged("the weights that ship", {}),
    nudged("the guesses they replaced", {
      placing: { mobility: 2, blocked: -10 },
      moving: { mobility: 3, blocked: -12 },
    }),
    nudged("placing-phase mobility only", { moving: { mobility: 3, blocked: -12 } }),
    nudged("moving-phase mobility only", { placing: { mobility: 2, blocked: -10 } }),
    nudged("mobility moved, blocked left alone", {
      placing: { blocked: -10 },
      moving: { blocked: -12 },
    }),
    nudged("blocked moved, mobility left alone", {
      placing: { mobility: 2 },
      moving: { mobility: 3 },
    }),
    nudged("mobility 3/5, blocked -14/-16", {
      placing: { mobility: 3, blocked: -14 },
      moving: { mobility: 5, blocked: -16 },
    }),
    nudged("mobility 3/5, blocked -12/-14", {
      placing: { mobility: 3, blocked: -12 },
      moving: { mobility: 5, blocked: -14 },
    }),
    nudged("mobility 4/6, blocked -16/-18", {
      placing: { mobility: 4, blocked: -16 },
      moving: { mobility: 6, blocked: -18 },
    }),
    nudged("mobility 6/10, blocked -20/-26", {
      placing: { mobility: 6, blocked: -20 },
      moving: { mobility: 10, blocked: -26 },
    }),
  ];

  it.each(SETS)("$name", ({ name, weights }) => {
    const player: Player = playerSearching(weights, MESTER);
    const { result, moves } = playGame({ light: player, dark: player });

    console.log(`${name.padEnd(36)} ${JSON.stringify(result)} in ${moves} moves`);

    expect(moves).toBeGreaterThan(0);
  });
});
