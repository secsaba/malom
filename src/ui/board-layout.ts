/**
 * Where the board's points, lines and coordinate labels sit in the SVG the
 * board is drawn into. Pure geometry over {@link ../engine/board}: no React,
 * no DOM, so it can be tested without rendering anything.
 *
 * The SVG is a square viewBox of {@link BOARD_SIZE} units. Nothing here is in
 * pixels — the board is scaled to whatever room the page gives it.
 */

import { FILES, type File, LINES, type Line, type PointId, RANKS, type Rank, fileOf, rankOf } from "../engine/board";

/** The side of the square viewBox, in SVG user units. */
export const BOARD_SIZE = 720;

/** Distance between two neighbouring grid positions. */
const STEP = 100;

/** Room left around the board for the coordinate labels. */
const MARGIN = (BOARD_SIZE - 6 * STEP) / 2;

/** How far outside the board the coordinate labels sit. */
const LABEL_OFFSET = 40;

export type Position = { readonly x: number; readonly y: number };

const xOf = (file: File) => MARGIN + FILES.indexOf(file) * STEP;

// Rank 1 is the bottom of the board, but SVG's y axis grows downwards.
const yOf = (rank: Rank) => MARGIN + (7 - rank) * STEP;

/** Where a point sits in the viewBox. */
export const positionOf = (point: PointId): Position => ({
  x: xOf(fileOf(point)),
  y: yOf(rankOf(point)),
});

export type LineSegment = {
  readonly line: Line;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
};

/**
 * One straight segment per line, drawn from the line's first point to its last.
 * Because every line's middle point lies halfway between its ends, these 16
 * segments are exactly the board's three squares and the four spokes joining
 * them — there is no separate list of decorative strokes to keep in step.
 */
export const LINE_SEGMENTS: readonly LineSegment[] = LINES.map((line) => {
  const from = positionOf(line[0]);
  const to = positionOf(line[2]);
  return { line, x1: from.x, y1: from.y, x2: to.x, y2: to.y };
});

export type FileLabel = { readonly file: File; readonly x: number; readonly y: number };
export type RankLabel = { readonly rank: Rank; readonly x: number; readonly y: number };

/** The file letters, below the board. */
export const FILE_LABELS: readonly FileLabel[] = FILES.map((file) => ({
  file,
  x: xOf(file),
  y: yOf(1) + LABEL_OFFSET,
}));

/** The rank digits, to the left of the board. */
export const RANK_LABELS: readonly RankLabel[] = RANKS.map((rank) => ({
  rank,
  x: xOf("a") - LABEL_OFFSET,
  y: yOf(rank),
}));
