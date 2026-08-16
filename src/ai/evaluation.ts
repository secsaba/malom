/**
 * How good a position is, as a single number seen from the side to move.
 *
 * The evaluation is a weighted sum of eight terms, each counted for both sides
 * and taken as the difference between them. The weights depend on the phase,
 * because the same feature is worth different amounts at different points in the
 * game: an extra piece is almost nothing while there are still nine to place and
 * very nearly everything once a side is down to flying.
 *
 * **The weights are provisional.** They are the reasoning below written down as
 * numbers, not measurements, and they are meant to be replaced by a set played
 * out by the self-play harness (#9). Nothing here should be read as tuned.
 */

import { LINES, type Line, type PointId, neighboursOf } from "../engine/board";
import { type Game, type Phase, fliesIn, roomAround } from "../engine/game";
import { type Position, SIDES, type Side, opponentOf, pointsHeldBy } from "../engine/position";

/**
 * What an evaluation is made of. Each is counted for one side, and the score is
 * the weighted difference between the two counts — so a term that is bad to have
 * carries a negative weight rather than being counted the other way round.
 */
export const TERMS = [
  /** Pieces the side still has: those on the board and those left in its hand. */
  "material",
  /** Lines it holds all three points of. */
  "mills",
  /** Mills it can step a piece out of and back into, closing them again — csikicsuki. */
  "runningMills",
  /** Lines it holds two points of, with the third empty. */
  "potentialMills",
  /** Its pieces standing on two potential mills at once, which the opponent cannot both block. */
  "forks",
  /** Its pieces with nowhere to go. */
  "blocked",
  /** Points its pieces can move to, counted over all of them. */
  "mobility",
  /** The degrees of the points it stands on — the four intersections are worth most. */
  "degree",
] as const;

export type Term = (typeof TERMS)[number];

/** One side's count of each term. */
export type Tally = Readonly<Record<Term, number>>;

/** What each term is worth, in each phase. */
export type Weights = Readonly<Record<Phase, Tally>>;

/**
 * The largest magnitude an evaluation is allowed to reach. It sits far below the
 * score the search gives a win, so that no heap of positional advantage can ever
 * be mistaken for one — and, the other way round, so that a drawn game scoring
 * nought is unambiguously worse than any win and better than any loss.
 */
export const EVALUATION_LIMIT = 100_000;

/**
 * Provisional weights, in units of roughly a hundredth of a piece in the moving
 * phase. The reasoning, all of it to be checked by #9 rather than trusted:
 *
 * - **Material** is the smallest thing on the board while placing — both sides
 *   will have nine pieces out and a one-piece deficit is ordinary — and dominant
 *   while flying, where three pieces against four is the whole game. It is not
 *   quite nothing during the placing phase, because a capture there is still a
 *   capture; but a mill is worth several pieces, so the search closes one for
 *   the shape of it rather than for the piece it takes.
 * - **Mills and potential mills** matter most during the placing phase, where
 *   the shape of the position is being decided and there is nothing else to play
 *   for.
 * - **Forks** are worth about as much as the mill they will become, because the
 *   opponent can only block one of the two.
 * - **Running mills** only exist once pieces move, and a side that has one has
 *   something close to a won game, so they are weighted near a mill of their own.
 * - **Blocked** pieces cost, because a side with none that can move has lost;
 *   **mobility** is the same idea counted the gentler way round. Both are small
 *   while flying, where a side reaches everywhere anyway.
 * - **Degree** prices the intersections above the corners at a level low enough
 *   that it only decides between moves the other terms think alike.
 */
export const DEFAULT_WEIGHTS: Weights = {
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

/** Whether a line is a mill this side holds. */
const isMill = (position: Position, line: Line, side: Side): boolean =>
  line.every((point) => position.get(point) === side);

/** The lines this side holds two points of, with the third empty. */
const potentialMillsOf = (position: Position, side: Side): readonly Line[] =>
  LINES.filter((line) => {
    const held = line.filter((point) => position.get(point) === side);

    return held.length === 2 && line.some((point) => !position.has(point));
  });

/**
 * The mills this side can run: a closed mill with a piece that can step out to an
 * empty point beside it and step back next move, closing the mill again and
 * earning another capture every second move.
 *
 * The step back only works while the opponent cannot take the point that was
 * left, so the piece stepping out must have no opponent piece next to it — and a
 * side that flies reaches every point, which is why an opponent down to three
 * pieces ends the running of mills altogether.
 */
const runningMillsOf = (game: Game, side: Side): number => {
  const { position } = game;
  const opponent = opponentOf(side);
  if (fliesIn(game, opponent)) return 0;

  return LINES.filter((line) => isMill(position, line, side)).filter((line) =>
    line.some(
      (member) =>
        // Every empty neighbour is off the mill's own line: the other two points
        // of a mill are held by this very side, so neither of them is empty.
        neighboursOf(member).some((next) => !position.has(next)) &&
        neighboursOf(member).every((next) => position.get(next) !== opponent),
    ),
  ).length;
};

/** How much of each term one side has. */
const tallyFor = (game: Game, side: Side): Tally => {
  const { position } = game;
  const held = pointsHeldBy(position, side);
  const potential = potentialMillsOf(position, side);
  const room = held.map((point) => roomAround(game, point));

  return {
    material: held.length + game.piecesInHand[side],
    mills: LINES.filter((line) => isMill(position, line, side)).length,
    runningMills: runningMillsOf(game, side),
    potentialMills: potential.length,
    // Each point lies on exactly two lines, so a piece on two potential mills is
    // one fork and never more. The two lines meet only at that piece, so the
    // points that would close them are different ones and cannot both be blocked.
    forks: held.filter(
      (point) =>
        potential.filter((line) => (line as readonly PointId[]).includes(point)).length === 2,
    ).length,
    blocked: room.filter((points) => points.length === 0).length,
    mobility: room.reduce((total, points) => total + points.length, 0),
    degree: held.reduce((total, point) => total + neighboursOf(point).length, 0),
  };
};

/**
 * The phase the weights are read off, which is the game's rather than one
 * player's: the engine's `phaseOf` answers for the side to move, and weighing the same
 * position by one table on one move and another on the next would make the
 * search chase the change rather than the position. A game where either side
 * flies is weighed as a flying one, because that is the game both are playing.
 */
const weighingPhase = (game: Game): Phase => {
  if (game.placing) return "placing";

  return SIDES.some((side) => fliesIn(game, side)) ? "flying" : "moving";
};

/**
 * How good the position is for the side to move, in the units the weights are
 * written in. A game that is over is not asked: the search scores endings itself,
 * on a scale far above this one.
 */
export const evaluate = (game: Game, weights: Weights = DEFAULT_WEIGHTS): number => {
  const phase = weighingPhase(game);
  const mine = tallyFor(game, game.sideToMove);
  const theirs = tallyFor(game, opponentOf(game.sideToMove));

  const score = TERMS.reduce(
    (total, term) => total + weights[phase][term] * (mine[term] - theirs[term]),
    0,
  );

  return Math.max(-EVALUATION_LIMIT, Math.min(EVALUATION_LIMIT, score));
};
