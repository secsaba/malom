/**
 * The tuning run: candidate weight sets played against the set that ships, at
 * the depths Mester really plays at, until the games say which of them is best.
 * Its result is a number written into `src/ai/evaluation.ts` and a table written
 * into `docs/tuning/weights.md`; nothing here is a check, and `pnpm test` never
 * runs it.
 *
 *     pnpm tune
 *
 * It is a harness driven by the test runner because Vitest is what runs
 * TypeScript in this repo. The one thing it asserts is that it played the games
 * it said it would — a run with unfinished games in it has measured nothing, and
 * should fail rather than print a table.
 *
 * **The baseline is whatever ships.** Candidates are variations of
 * `DEFAULT_WEIGHTS`, so a later run measures later candidates against the later
 * default rather than against a set nobody uses any more. The price is that a
 * run cannot be reproduced across a change to the default: the table in the
 * document names the commit it was produced at, and reproducing it means
 * checking that commit out.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_WEIGHTS, type Tally, type Weights } from "../../src/ai/evaluation";
import { type Scoreline, playMatch, playerSearching, shareOf } from "../../src/ai/self-play";
import type { Phase } from "../../src/engine/game";
import { DIFFICULTY_SETTINGS } from "../../src/opponent/difficulty";

/**
 * How many openings each candidate is measured over. Each is played twice, so a
 * candidate plays twice this many games — about three minutes of them at the
 * depths below, which is what a whole gauntlet can afford to spend on one set.
 */
const OPENINGS = 12;

/**
 * Where the openings come from. Written down because a run nobody can repeat
 * measures nothing — and it is the one thing here worth changing by hand. The
 * recorded gauntlet was three rounds at three seeds, `20260817`, `424242` and
 * `77777`; every table in `docs/tuning/weights.md` comes back by putting one of
 * those here. That a candidate must win at more than one of them is the whole
 * method: over 24 games the standard error on a share is about a tenth, and the
 * joint top scorer of the first round came back at 0.417 on the second.
 */
const SEED = 20260817;

/**
 * The depths every game is played at: Mester's own, per phase. A set of weights
 * tuned at a depth nothing plays at is tuned for a player that does not exist —
 * a term that only pays off three moves further on is worth nothing to a search
 * that stops two moves short of it.
 */
const DEPTHS = DIFFICULTY_SETTINGS.master.depth;

/**
 * The set every candidate is a variation on and every match is played against:
 * the reasoned guesses this project shipped before any of them had been played
 * for. It is written out rather than read from `DEFAULT_WEIGHTS` on purpose. A
 * baseline that moves when the winner is committed takes the whole run with it —
 * the candidates become deltas on a different table, the winning set turns into
 * the default playing itself for a guaranteed half, and the tables below stop
 * meaning what they say. Written out, the gauntlet answers the same way at every
 * commit, for ever.
 *
 * A later round that wants to challenge what ships rather than what shipped
 * first copies today's `DEFAULT_WEIGHTS` in here and starts a new record.
 */
const BASELINE: Weights = {
  placing: {
    material: 8,
    mills: 30,
    runningMills: 0,
    potentialMills: 14,
    forks: 30,
    blocked: -10,
    mobility: 2,
    degree: 6,
  },
  moving: {
    material: 100,
    mills: 34,
    runningMills: 40,
    potentialMills: 14,
    forks: 30,
    blocked: -12,
    mobility: 3,
    degree: 4,
  },
  flying: {
    material: 300,
    mills: 30,
    runningMills: 20,
    potentialMills: 20,
    forks: 30,
    blocked: -30,
    mobility: 1,
    degree: 2,
  },
};

/** A weight set to be measured, and the reasoning that made it worth measuring. */
type Candidate = {
  readonly name: string;
  readonly idea: string;
  readonly weights: Weights;
};

/** The baseline with a few of its weights moved, phase by phase. */
const varying = (
  name: string,
  idea: string,
  moved: Partial<Record<Phase, Partial<Tally>>>,
): Candidate => ({
  name,
  idea,
  weights: {
    placing: { ...BASELINE.placing, ...moved.placing },
    moving: { ...BASELINE.moving, ...moved.moving },
    flying: { ...BASELINE.flying, ...moved.flying },
  },
});

/**
 * The candidates, each one a guess in the provisional weights taken seriously
 * enough to be played out. They move one idea at a time rather than several at
 * once, so that a set that wins says which guess was wrong.
 */
const CANDIDATES: readonly Candidate[] = [
  varying(
    "material-heavier",
    "A piece is underpriced: closing a mill for the shape of it is worth less than the piece it takes.",
    { placing: { material: 20 }, moving: { material: 140 } },
  ),
  varying(
    "material-lighter-while-placing",
    "A piece is overpriced while placing, where the shape of the position is the whole game.",
    { placing: { material: 2, mills: 36, potentialMills: 18 } },
  ),
  varying(
    "mobility-heavier",
    "Room to move is underpriced: a side with none has lost, and the terms that see it coming are the smallest on the table.",
    { placing: { mobility: 5, blocked: -18 }, moving: { mobility: 8, blocked: -22 } },
  ),
  varying(
    "degree-cheaper",
    "The intersection premium is noise: it was set to break ties and may be deciding more than ties.",
    { placing: { degree: 2 }, moving: { degree: 1 }, flying: { degree: 0 } },
  ),
  varying(
    "threats-heavier",
    "Threats are underpriced: a fork the opponent cannot block both halves of is worth more than the mill it becomes.",
    { placing: { potentialMills: 22, forks: 48 }, moving: { potentialMills: 22, forks: 48 } },
  ),
  varying(
    "running-mills-heavier",
    "A csikicsuki is close to a won game and is priced at about one mill.",
    { moving: { runningMills: 70 }, flying: { runningMills: 40 } },
  ),
  // The two below were not first-round candidates. They were built out of the
  // sets that survived it — the second and third rounds each combined the
  // leaders to see whether two good ideas compound, and neither did. They are
  // kept because a round nobody can re-run is a round nobody can check.
  varying(
    "shape-over-material",
    "Round two: the two leaders of round one at once, shape bought at material's expense.",
    {
      placing: { material: 2, mills: 36, potentialMills: 22, forks: 48 },
      moving: { potentialMills: 22, forks: 48 },
    },
  ),
  varying(
    "lighter-and-freer",
    "Round three: the two sets that won both earlier rounds, folded together.",
    {
      placing: { material: 2, mills: 36, potentialMills: 18, mobility: 5, blocked: -18 },
      moving: { mobility: 8, blocked: -22 },
    },
  ),
];

/** One line of the table, ready to be read off into the document. */
const rowOf = (name: string, scoreline: Scoreline, seconds: number): string => {
  const { wins, draws, losses } = scoreline;
  const share = shareOf(scoreline);

  return [
    name.padEnd(30),
    `${wins}`.padStart(3),
    `${draws}`.padStart(3),
    `${losses}`.padStart(3),
    (share === undefined ? "—" : share.toFixed(3)).padStart(7),
    `  (${seconds}s)`,
  ].join(" ");
};

/**
 * One test per candidate rather than one for the gauntlet, for two reasons: a
 * row is printed as its match ends instead of every row appearing at the end of
 * a run that takes half an hour, and a candidate can be run on its own —
 * `pnpm tune -- -t material-heavier` — which is also how a whole gauntlet is
 * spread over the cores of a machine, one process per candidate, rather than
 * played out one match at a time.
 */
describe(`the tuning gauntlet, ${OPENINGS * 2} games a candidate at seed ${SEED}`, () => {
  it.each(CANDIDATES)("$name", ({ name, weights }) => {
    const started = Date.now();

    const scoreline = playMatch(
      playerSearching(weights, DEPTHS),
      playerSearching(BASELINE, DEPTHS),
      { openings: OPENINGS, seed: SEED },
    );

    console.log(rowOf(name, scoreline, Math.round((Date.now() - started) / 1000)));

    // A run with a game nobody finished in it has measured nothing.
    expect(scoreline.unfinished).toBe(0);
  });
});

/** A seed none of the rounds that chose the shipping weights was run at. */
const CONFIRMATION_SEED = 31415926;

/**
 * The check on the whole exercise. A candidate is picked by winning matches, and
 * a candidate picked that way can always have been picked by the openings it
 * happened to be given — so the set that won plays the baseline once more, over
 * openings that had no hand in choosing it. A set that only wins on the seeds it
 * was chosen on was chosen by the seeds, and this is what says so.
 *
 * It is the one claim in this file that can fail, and it is worth being clear
 * about what that is worth: `pnpm tune` is a tool run by hand and no part of CI
 * runs it, so this catches a weight change on the way in, when whoever is making
 * it runs the gauntlet, rather than afterwards. It also measures against a fixed
 * baseline rather than against whatever shipped most recently, so once a second
 * round of tuning moves that baseline this becomes a record of the first round
 * rather than a live check on the latest one.
 */
describe("the set that ships against the baseline it replaced", () => {
  it(`wins over ${OPENINGS * 2} games at a seed that did not choose it`, () => {
    const started = Date.now();

    const scoreline = playMatch(
      playerSearching(DEFAULT_WEIGHTS, DEPTHS),
      playerSearching(BASELINE, DEPTHS),
      { openings: OPENINGS, seed: CONFIRMATION_SEED },
    );

    console.log(rowOf("confirmation", scoreline, Math.round((Date.now() - started) / 1000)));

    expect(scoreline.unfinished).toBe(0);
    expect(shareOf(scoreline)).toBeGreaterThan(0.5);
  });
});
