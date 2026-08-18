/**
 * The grade calibration run: a corpus of novice games, every move in it weighed
 * by the engine at full strength, and the distribution of what those moves lost
 * printed out. Its result is the bands in `src/teaching/grade.ts` and the tables
 * in `docs/tuning/grades.md`; nothing here is a check, and `pnpm test` never
 * runs it.
 *
 *     pnpm tune -t grades
 *
 * Like the weight gauntlet beside it, this is a harness driven by the test
 * runner because Vitest is what runs TypeScript in this repo.
 *
 * **The corpus is Kezdő's moves.** The bands have to be right for the player
 * being taught, and that player is a novice — so what is measured is the moves
 * the weakest difficulty played, in games against itself and against Erős.
 * Kezdő is the closest thing this project has to a novice that can play a
 * thousand moves overnight: it looks one move ahead and plays a weaker move half
 * the time. Its deliberate mistakes are drawn from a shortlist and so are
 * bounded, but its depth of one is not — it hangs pieces to tactics it cannot
 * see, which is the mistake a novice actually makes and the one the worst band
 * has to be placed around.
 *
 * **The rule was fixed before the tables were read.** An edge chosen after
 * looking at what it would produce is an edge chosen by hand with extra steps,
 * so this is written down first and the numbers were fitted to it rather than
 * the other way round.
 *
 * 1. The two calibrating seeds are pooled, and each phase's edges are read off
 *    the quantiles of what the moves played in that phase lost: the median
 *    between Jó and Pontatlan, the eightieth between Pontatlan and Hiba, the
 *    ninety-fifth between Hiba and Súlyos hiba. Anything at all lost is Jó.
 * 2. The quantiles are taken over the moves the evaluation weighed, and not
 *    over the ones the search decided. A move that walks into a game the search
 *    has already seen won or lost loses a mate score rather than a quantity of
 *    position — a million, against an evaluation that cannot pass a hundred
 *    thousand — and quantiles over the two scales mixed are quantiles over
 *    nothing. This was an amendment to the rule, made when the first tables came
 *    back and before any edge was read off one: while flying, a quarter of a
 *    novice's moves throw the game outright, so the eightieth and the ninety-
 *    fifth both landed on a mate score and Hiba and Súlyos hiba would have
 *    meant the same thing. Nothing is lost by leaving them out: a mate-scale
 *    loss is above every band by construction, and is Súlyos hiba whatever the
 *    edges are.
 * 3. Each edge is rounded to something readable — the nearest 2 while placing,
 *    10 while moving, 25 while flying, which is a few per cent of a piece in
 *    each phase. Rounding is cosmetic and may not reorder a table, so an edge
 *    that would round to or below the edge beneath it is rounded away from it
 *    instead. (Amendment: the flying phase's Pontatlan edge measured 9, and the
 *    nearest 25 is nought.)
 * 4. Where an edge would land at or below the edge under it, that phase's
 *    quantiles are taken over the moves that lost anything at all instead.
 * 5. Two anchors override the quantiles wherever they disagree, because they
 *    are what the grades have to mean rather than how often they have to fire:
 *    a piece handed over while pieces move is Súlyos hiba, and a move that gave
 *    up less than a mill in its phase is no worse than Pontatlan. An override
 *    is recorded in the document.
 * 6. An anchor that pins an edge below the quantile under it leaves the table
 *    out of order, and the lower edges are then re-read at the same quantiles
 *    over the moves that lost something but less than the pin. This is the
 *    rule's second amendment, written before the pooled table was read and for
 *    a collision the first table had already made plain: a novice loses a whole
 *    piece on about three of every ten moves it plays while pieces move, so the
 *    ninety-fifth is far above the piece the anchor pins Súlyos hiba to, and the
 *    eightieth is above it too.
 * 7. `LOST_POSITION` for a phase is the smallest of the measured distances
 *    behind from which **no game in the corpus was saved** — the share of them
 *    the mover went on to lose reaching one, out of at least thirty moves, a
 *    draw counting as saved. Where no distance reaches it, the number is set
 *    past the furthest one measured rather than guessed low: capping an
 *    ordinary position at Pontatlan is much the worse mistake. It is read off
 *    the pool, like the bands, and it is always further out than a piece of its
 *    phase, because a side one piece down still has a game.
 *
 *    This is the rule's third amendment, and the only one made after a table
 *    was read rather than before — it is recorded here in the words of what it
 *    replaced, so that anyone can disagree with it against the same numbers.
 *    What it replaced asked for the smallest distance at which the mover lost
 *    nine games in ten. That gate turned out not to discriminate: Kezdő loses
 *    95 of every hundred moving-phase positions it stands in that are merely
 *    *not ahead*, and every flying position it ever reaches. A gate the very
 *    first distance already passes is not measuring the position, it is
 *    measuring the player — and taken at its word it would have capped some
 *    two moves in five at Pontatlan, which is the failure the rule's own second
 *    sentence was written to avoid. Certainty is the reading the confound
 *    cannot corrupt: a distance from which nobody in the corpus ever saved a
 *    game is called lost on the evidence, whoever was playing.
 *
 * **What placed the edges is not what is published.** Edges read off the
 * quantiles of one corpus can always be that corpus's doing, so the seeds that
 * placed them and the seed the published distribution comes from are different —
 * the same precaution the weight gauntlet takes when it plays its confirmation
 * match at a seed that had no hand in choosing the winner. `CALIBRATION_SEEDS`
 * placed the edges; `SEED` had no hand in it, and the tables in the document are
 * read off it.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_WEIGHTS, EVALUATION_LIMIT } from "../../src/ai/evaluation";
import { type ScoredMove, search } from "../../src/ai/search";
import { randomOpening, seededRandom } from "../../src/ai/self-play";
import {
  type Game,
  type Move,
  NEW_GAME,
  PHASES,
  type Phase,
  type Result,
  afterMove,
  phaseOf,
} from "../../src/engine/game";
import type { Side } from "../../src/engine/position";
import {
  type Difficulty,
  FULL_STRENGTH,
  depthAt,
  moveAtDifficulty,
} from "../../src/opponent/difficulty";
import {
  type Band,
  GRADES,
  type Grade,
  gradeOf,
  isNoWorseThan,
  isTheSameMove,
} from "../../src/teaching/grade";

/** The seed the published tables are read off. None of the edges was chosen on it. */
const SEED = 31415926;

/** The seeds the edges were chosen on. Kept so the choosing can be run again. */
const CALIBRATION_SEEDS = [20260817, 424242] as const;

/**
 * How many openings the corpus is played over. Each is played as three games.
 *
 * It is more than the weight gauntlet plays because of the flying phase, which
 * is the scarcest thing here: a novice game reaches it rarely and ends quickly
 * once it does, and half of the moves played there are decided by the search
 * rather than weighed by the evaluation. Twenty openings is what makes that
 * phase enough moves to read rather than a handful; the other two are covered
 * long before it.
 */
const OPENINGS = 20;

/** How many moves of each game are drawn at random before the players take over. */
const OPENING_MOVES = 4;

/** The player being taught. Every move in the corpus is one of its. */
const NOVICE: Difficulty = "beginner";

/**
 * The three games each opening is played as. A novice plays the computer, so the
 * novice is Kezdő in every one of them — against itself, because that is the
 * game a beginner actually plays, and against Erős from both sides, because a
 * novice under pressure reaches positions a novice left alone never does and the
 * bands are read in both. Kezdő against Kezdő is one game with both sides
 * measured rather than two games with one side measured each: the players are
 * the same deterministic pair either way round, so the second game would be the
 * first one over again.
 */
const MATCHUPS: readonly Readonly<Record<Side, Difficulty>>[] = [
  { light: "beginner", dark: "beginner" },
  { light: "beginner", dark: "strong" },
  { light: "strong", dark: "beginner" },
];

/** How many moves a corpus game may run to before it is abandoned. */
const MOVE_CAP = 400;

/** A player at a difficulty, searching and choosing exactly as the opponent does. */
const playerAt =
  (difficulty: Difficulty, random: () => number) =>
  (game: Game): Move | undefined =>
    moveAtDifficulty(
      difficulty,
      search(game, { limits: { depth: depthAt(difficulty, game) } }).candidates,
      random,
    );

/** One move of the corpus, as the engine at full strength found it. */
type Weighed = {
  readonly phase: Phase;
  /** How much worse it was than the move the engine preferred. */
  readonly loss: number;
  /** What the engine made of the position it was played in, from the mover's side. */
  readonly preferred: number;
  /** Whether the mover went on to lose the game. Nothing, where nobody won it. */
  readonly lost: boolean | undefined;
};

/**
 * Whether this side lost the game. A draw counts as not losing it, because a
 * draw is a game saved: counting only the decisive games would say that every
 * position two pieces down was lost, in a corpus where a third of them were
 * held. Nothing, where the game ran into the move cap and nobody finished it.
 */
const lostBy = (side: Side, result: Result | undefined): boolean | undefined => {
  if (result === undefined) return undefined;

  return "draw" in result ? false : result.winner !== side;
};

/**
 * One game, with every move the measured sides played weighed as the grader
 * weighs it: the same search at the same depth over the same candidates, and the
 * same two moves skipped — the one the rules left no choice about, and the one
 * the search did not rank.
 */
const playAndWeigh = (
  difficulties: Readonly<Record<Side, Difficulty>>,
  opening: readonly Move[],
  random: () => number,
): readonly Weighed[] => {
  const players = {
    light: playerAt(difficulties.light, random),
    dark: playerAt(difficulties.dark, random),
  };
  const weighed: { side: Side; phase: Phase; loss: number; preferred: number }[] = [];
  let game = NEW_GAME;
  let played = 0;

  for (const move of opening) {
    if (game.result !== undefined) break;

    game = afterMove(game, move);
    played += 1;
  }

  while (game.result === undefined && played < MOVE_CAP) {
    const side = game.sideToMove;
    const move = players[side](game);
    if (move === undefined) break;

    if (difficulties[side] === NOVICE) {
      const { candidates } = search(game, { limits: { depth: depthAt(FULL_STRENGTH, game) } });
      const [preferred] = candidates;
      const asPlayed: ScoredMove | undefined = candidates.find(({ move: candidate }) =>
        isTheSameMove(candidate, move),
      );

      if (preferred !== undefined && candidates.length > 1 && asPlayed !== undefined) {
        weighed.push({
          side,
          phase: phaseOf(game),
          loss: preferred.score - asPlayed.score,
          preferred: preferred.score,
        });
      }
    }

    game = afterMove(game, move);
    played += 1;
  }

  return weighed.map(({ side, ...move }) => ({ ...move, lost: lostBy(side, game.result) }));
};

/**
 * The whole corpus: every matchup over every opening, at one seed. It is kept
 * once it has been played, because every table below reads the same corpus and
 * playing it again would only cost minutes to arrive at the same moves.
 */
const corpora = new Map<number, readonly Weighed[]>();

const corpusAt = (seed: number): readonly Weighed[] => {
  const already = corpora.get(seed);
  if (already !== undefined) return already;

  const openings = seededRandom(seed);
  const weighed: Weighed[] = [];

  for (let opening = 0; opening < OPENINGS; opening += 1) {
    const moves = randomOpening(openings, OPENING_MOVES);

    for (const difficulties of MATCHUPS) {
      weighed.push(...playAndWeigh(difficulties, moves, seededRandom(seed + opening)));
    }
  }

  corpora.set(seed, weighed);

  return weighed;
};

/**
 * Whether the evaluation weighed this move or the search decided it. A score
 * past what an evaluation can reach is a game seen won or lost outright, and a
 * loss between one of those and anything else is a mate score rather than a
 * quantity of position — so the two are counted apart and only the first are
 * read for edges.
 */
const wasWeighed = ({ preferred, loss }: Weighed): boolean =>
  Math.abs(preferred) <= EVALUATION_LIMIT && Math.abs(preferred - loss) <= EVALUATION_LIMIT;

/** The moves of one phase that the evaluation weighed. */
const weighedIn = (corpus: readonly Weighed[], phase: Phase): readonly Weighed[] =>
  corpus.filter((move) => move.phase === phase && wasWeighed(move));

/** The losses of a set of moves, smallest first. */
const lossesOf = (moves: readonly Weighed[]): readonly number[] =>
  moves.map(({ loss }) => loss).sort((one, other) => one - other);

/** The value at this share of the way through a sorted run of numbers. */
const quantile = (sorted: readonly number[], share: number): number =>
  sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(share * (sorted.length - 1))))] ?? 0;

const QUANTILES = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99, 1] as const;

const cell = (value: string | number, width = 8): string => `${value}`.padStart(width);

/** Where the losses fall in a phase, as the quantiles an edge can be read off. */
const spreadOf = (corpus: readonly Weighed[]): string[] => {
  const rows = [
    `${"phase".padEnd(12)}${cell("moves")}${cell("decided")}${QUANTILES.map((q) => cell(`p${q * 100}`)).join("")}`,
  ];

  for (const phase of PHASES) {
    const all = corpus.filter((move) => move.phase === phase);
    const weighed = weighedIn(corpus, phase);
    const piece = DEFAULT_WEIGHTS[phase].material;
    const spread = (name: string, losses: readonly number[], each: (loss: number) => string) =>
      name.padEnd(12) +
      cell(losses.length) +
      cell("") +
      QUANTILES.map((share) => cell(each(quantile(losses, share)))).join("");

    rows.push(
      phase.padEnd(12) + cell(all.length) + cell(all.length - weighed.length),
      spread("  weighed", lossesOf(weighed), (loss) => `${loss}`),
      spread("  in pieces", lossesOf(weighed), (loss) => (loss / piece).toFixed(2)),
      spread("  lost > 0", lossesOf(weighed.filter(({ loss }) => loss > 0)), (loss) => `${loss}`),
      spread(
        "  0 < x < pc",
        lossesOf(weighed.filter(({ loss }) => loss > 0 && loss < piece)),
        (loss) => `${loss}`,
      ),
    );
  }

  return rows;
};

describe("grades: what a novice's moves lose", () => {
  it(`over ${OPENINGS} openings at the seed the document reports, ${SEED}`, () => {
    const started = Date.now();
    const corpus = corpusAt(SEED);

    console.log(
      `\n${corpus.length} graded moves in ${Math.round((Date.now() - started) / 1000)}s\n` +
        spreadOf(corpus).join("\n"),
    );

    expect(corpus.length).toBeGreaterThan(0);
  });

  it("over the calibrating seeds, apart and pooled — the edges come off the pool", () => {
    const measured = CALIBRATION_SEEDS.map((seed) => corpusAt(seed));
    const pooled = measured.flat();

    for (const [at, corpus] of measured.entries()) {
      console.log(
        `\nseed ${CALIBRATION_SEEDS[at]}: ${corpus.length} graded moves\n${spreadOf(corpus).join("\n")}`,
      );
    }
    console.log(`\npooled: ${pooled.length} graded moves\n${spreadOf(pooled).join("\n")}`);

    expect(pooled.length).toBeGreaterThan(0);
  });
});

/**
 * How far behind the mover stood, in pieces of the phase they stood there in.
 * It runs well past a piece because a piece is not the same thing in all three:
 * while placing, where a piece is 8 and a mill 30, a side four pieces behind is
 * about one mill behind and has a game.
 */
const BEHIND_BY = [0, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12] as const;

/** What became of the games the mover was this far behind in, phase by phase. */
const lostFrom = (corpus: readonly Weighed[]): string[] => {
  const rows = [
    `${"phase".padEnd(10)}${cell("behind")}${cell("score")}${cell("moves")}${cell("lost")}`,
  ];

  for (const phase of PHASES) {
    const piece = DEFAULT_WEIGHTS[phase].material;

    for (const pieces of BEHIND_BY) {
      const behind = weighedIn(corpus, phase).filter(
        (move) => move.lost !== undefined && move.preferred <= -pieces * piece,
      );
      const lost = behind.filter(({ lost }) => lost).length;

      rows.push(
        phase.padEnd(10) +
          cell(`${pieces}pc`) +
          cell(-pieces * piece) +
          cell(behind.length) +
          cell(behind.length === 0 ? "—" : (lost / behind.length).toFixed(2)),
      );
    }
  }

  return rows;
};

describe("grades: how far behind a position is already lost", () => {
  it("over the calibrating seeds pooled — where the number comes from", () => {
    const pooled = CALIBRATION_SEEDS.flatMap((seed) => corpusAt(seed));

    console.log(`\npooled: ${pooled.length} graded moves\n${lostFrom(pooled).join("\n")}`);

    expect(pooled.length).toBeGreaterThan(0);
  });

  it(`over ${OPENINGS} openings at seed ${SEED} — what the document reports`, () => {
    const corpus = corpusAt(SEED);

    console.log(`\n${lostFrom(corpus).join("\n")}`);

    expect(corpus.length).toBeGreaterThan(0);
  });
});

/**
 * The table that shipped before the calibration: one set of edges read in all
 * three phases. It is kept here so that what changed can be counted rather than
 * asserted — a document that says the old bands were wrong should be able to say
 * by how much.
 */
const AS_THEY_WERE: readonly Band[] = [
  { grade: "blunder", loss: 100 },
  { grade: "mistake", loss: 50 },
  { grade: "inaccuracy", loss: 20 },
  { grade: "good", loss: 1 },
];

/** What the old table made of a move, its lost-position cap included, at 200. */
const asItWas = ({ preferred, loss }: Weighed): Grade => {
  const grade = AS_THEY_WERE.find(({ loss: least }) => loss >= least)?.grade ?? "best";
  const capped = isNoWorseThan(grade, "inaccuracy") ? grade : "inaccuracy";

  return preferred <= -200 ? capped : grade;
};

/** How a set of moves came out, as a count and a share for each of the five words. */
const sharesOf = (corpus: readonly Weighed[], grade: (move: Weighed) => Grade): string[] => {
  const rows = [
    `${"phase".padEnd(10)}${cell("moves")}${GRADES.map((one) => cell(one, 12)).join("")}`,
  ];

  const row = (name: string, moves: readonly Weighed[]): string => {
    const graded = moves.map(grade);
    const share = (one: Grade): string => {
      const count = graded.filter((each) => each === one).length;

      return graded.length === 0 ? "—" : `${count} ${((count / graded.length) * 100).toFixed(0)}%`;
    };

    return (
      name.padEnd(10) + cell(graded.length) + GRADES.map((one) => cell(share(one), 12)).join("")
    );
  };

  for (const phase of PHASES) {
    rows.push(
      row(
        phase,
        corpus.filter((move) => move.phase === phase),
      ),
    );
  }
  rows.push(row("all", corpus));

  return rows;
};

describe("grades: what share of a novice's moves each band takes", () => {
  it(`over ${OPENINGS} openings at seed ${SEED}`, () => {
    const corpus = corpusAt(SEED);
    const asItShips = ({ phase, preferred, loss }: Weighed): Grade =>
      gradeOf(phase, { preferred, played: preferred - loss });

    console.log(`\nas they ship\n${sharesOf(corpus, asItShips).join("\n")}`);
    console.log(`\nas they were\n${sharesOf(corpus, asItWas).join("\n")}`);

    expect(corpus.length).toBeGreaterThan(0);
  });
});
