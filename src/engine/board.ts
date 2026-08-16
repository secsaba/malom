/**
 * The board a game of malom is played on: its 24 points, the 16 lines a mill
 * can occupy, and which points are adjacent to which.
 *
 * Points are named with the usual notation — a file letter `a`–`g` and a rank
 * digit `1`–`7`, read off the 7x7 grid the board is drawn on. Only 24 of the 49
 * grid positions are points; the rest, including the middle `d4`, are holes.
 *
 * {@link LINES} is the single source of truth. Everything else here is derived
 * from it, so the board can only ever be inconsistent in one place.
 */

/** The 16 lines, each ordered along the board from its lower end to its upper. */
export const LINES = [
  // along the ranks, bottom to top
  ["a1", "d1", "g1"],
  ["b2", "d2", "f2"],
  ["c3", "d3", "e3"],
  ["a4", "b4", "c4"],
  ["e4", "f4", "g4"],
  ["c5", "d5", "e5"],
  ["b6", "d6", "f6"],
  ["a7", "d7", "g7"],
  // along the files, left to right
  ["a1", "a4", "a7"],
  ["b2", "b4", "b6"],
  ["c3", "c4", "c5"],
  ["d1", "d2", "d3"],
  ["d5", "d6", "d7"],
  ["e3", "e4", "e5"],
  ["f2", "f4", "f6"],
  ["g1", "g4", "g7"],
] as const satisfies readonly (readonly [string, string, string])[];

/** One of the 24 positions on the board where a piece can stand. */
export type PointId = (typeof LINES)[number][number];

/** A set of three points that lie in a straight row — the only shape a mill can occupy. */
export type Line = (typeof LINES)[number];

export const FILES = ["a", "b", "c", "d", "e", "f", "g"] as const;
export const RANKS = [1, 2, 3, 4, 5, 6, 7] as const;

export type File = (typeof FILES)[number];
export type Rank = (typeof RANKS)[number];

/** The file a point stands on. */
export const fileOf = (point: PointId): File => point[0] as File;

/** The rank a point stands on. */
export const rankOf = (point: PointId): Rank => Number(point[1]) as Rank;

const byFileThenRank = (a: PointId, b: PointId) =>
  FILES.indexOf(fileOf(a)) - FILES.indexOf(fileOf(b)) || rankOf(a) - rankOf(b);

/** All 24 points, ordered by file and then by rank. */
export const POINTS: readonly PointId[] = [...new Set(LINES.flat())].sort(byFileThenRank);

const POINT_IDS: ReadonlySet<string> = new Set(POINTS);

/** Whether an arbitrary string names a point of the board. */
export const isPointId = (value: string): value is PointId => POINT_IDS.has(value);

// Two points are adjacent when they sit next to each other on a line: a piece
// slides along the lines it could form a mill on, and nowhere else.
const NEIGHBOURS: ReadonlyMap<PointId, readonly PointId[]> = (() => {
  const collected = new Map<PointId, Set<PointId>>(POINTS.map((point) => [point, new Set()]));

  for (const [lower, middle, upper] of LINES) {
    for (const [from, to] of [
      [lower, middle],
      [middle, upper],
    ] as const) {
      collected.get(from)?.add(to);
      collected.get(to)?.add(from);
    }
  }

  return new Map(
    [...collected].map(([point, neighbours]) => [point, [...neighbours].sort(byFileThenRank)]),
  );
})();

/** The points a piece on this point can slide to, ordered by file and then by rank. */
export const neighboursOf = (point: PointId): readonly PointId[] => NEIGHBOURS.get(point) ?? [];
