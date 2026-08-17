/**
 * Where the board's points, lines and coordinate labels sit in the SVG the
 * board is drawn into. Pure geometry over {@link ../engine/board}: no React,
 * no DOM, so it can be tested without rendering anything.
 *
 * The SVG is a square viewBox of {@link BOARD_SIZE} units. Nothing here is in
 * pixels — the board is scaled to whatever room the page gives it.
 */

import {
  FILES,
  type File,
  LINES,
  type Line,
  type PointId,
  RANKS,
  type Rank,
  fileOf,
  rankOf,
} from "../engine/board";

/** The side of the square viewBox, in SVG user units. */
export const BOARD_SIZE = 720;

/** Distance between two neighbouring grid positions. */
const STEP = 100;

/** Room left around the board for the coordinate labels. */
const MARGIN = (BOARD_SIZE - (FILES.length - 1) * STEP) / 2;

/** How far outside the board the coordinate labels sit. */
const LABEL_OFFSET = 40;

/** How big an empty point is drawn. */
export const POINT_RADIUS = 18;

/** How big a piece standing on a point is drawn. */
export const PIECE_RADIUS = 34;

/**
 * How far out the ring marking a hint sits: outside the piece standing on the
 * point, and clear of the point next door. Going round the outside is what makes
 * a hint impossible to mistake for a state of the game — the point underneath
 * keeps every mark it had, and the hint is drawn around it.
 */
export const HINT_RADIUS = 46;

/** How much of the board around a point takes a tap meant for it. */
export const TARGET_RADIUS = STEP / 2;

export type Centre = { readonly x: number; readonly y: number };

const xOf = (file: File) => MARGIN + FILES.indexOf(file) * STEP;

// Rank 1 is the bottom of the board, but SVG's y axis grows downwards.
const yOf = (rank: Rank) => MARGIN + (RANKS.length - rank) * STEP;

/** Where the centre of a point sits in the viewBox. */
export const centreOf = (point: PointId): Centre => ({
  x: xOf(fileOf(point)),
  y: yOf(rankOf(point)),
});

export type LineSegment = {
  readonly line: Line;
  readonly from: Centre;
  readonly to: Centre;
};

/**
 * One straight segment per line, drawn from the line's first point to its last.
 * Because every line's middle point lies halfway between its ends, these 16
 * segments are exactly the board's three squares and the four spokes joining
 * them — there is no separate list of decorative strokes to keep in step.
 */
export const LINE_SEGMENTS: readonly LineSegment[] = LINES.map((line) => ({
  line,
  from: centreOf(line[0]),
  to: centreOf(line[2]),
}));

/**
 * A file letter or a rank digit, placed just outside the board.
 *
 * These are notation rather than language — `a` and `7` read the same in
 * Hungarian and in English — so they come from the board itself and not from
 * the strings module.
 */
export type CoordinateLabel = Centre & { readonly text: string };

/** The file letters below the board, then the rank digits to its left. */
export const COORDINATE_LABELS: readonly CoordinateLabel[] = [
  ...FILES.map((file) => ({ text: file, x: xOf(file), y: yOf(RANKS[0]) + LABEL_OFFSET })),
  ...RANKS.map((rank) => ({ text: String(rank), x: xOf(FILES[0]) - LABEL_OFFSET, y: yOf(rank) })),
];
