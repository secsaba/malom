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
import { PIECES_PER_SIDE } from "../engine/game";
import { PIECES_TO_LOSE, type Side } from "../engine/position";

/** The side of the square viewBox, in SVG user units. */
export const BOARD_SIZE = 720;

/** Distance between two neighbouring grid positions. */
const STEP = 100;

/** Room left around the board for the coordinate labels. */
const MARGIN = (BOARD_SIZE - (FILES.length - 1) * STEP) / 2;

/** How far outside the board the coordinate labels sit. */
const LABEL_OFFSET = 40;

/**
 * The rounded corner of the ground the board is drawn on. The ground is a shape
 * inside the drawing rather than the element's background, because the element
 * is given whatever room the page has and the drawing centres itself inside it:
 * a background would fill the room around the board as well as the board, and a
 * slab of cream is not what is left over when a board runs out of room.
 */
export const GROUND_CORNER = 16;

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

/**
 * The ring inside the piece that moved last, marking where the move came to
 * rest. It goes inside rather than around it because everything around a point
 * is already spoken for — the marks the game leaves at the piece's own radius
 * and the hint outside them — and because it is the one mark that has to survive
 * a player who has asked for no animation: without it the last move is told only
 * by the movement, and a board that has stopped moving stops saying it.
 */
export const LAST_MOVE_RADIUS = 14;

/** How much of the board around a point takes a tap meant for it. */
export const TARGET_RADIUS = STEP / 2;

/**
 * The square drawn round the point the keyboard has reached. It is a square
 * because nothing else on the board is one: every mark the game leaves is a
 * ring, and a ring here would sit within a few units of the hint's and be told
 * from it by colour alone — which is the one thing the board must not need. It
 * spans a whole step, so it meets the squares its neighbours would draw rather
 * than overlapping them.
 */
export const FOCUS_SIZE = STEP;

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

/**
 * The outline left on the point a piece was taken from.
 * Its radius is its own —
 * bigger than the empty point still drawn inside it, smaller than the piece that
 * stood there and smaller than the outline of a piece that could land there — so
 * that the board never has to tell two marks apart by their ink alone. What it
 * is drawn as, dotted and in the taken piece's own colour rather than in any of
 * the three inks the game's states are marked in, is the stylesheet's business.
 */
export const GHOST_RADIUS = 26;

/**
 * How big a captured piece is drawn where it comes to rest. It is half a piece,
 * because a heap of seven has to fit in the hole in the middle of the board, and
 * because a captured piece is not one anybody can play — the stylesheet draws it
 * flat, with none of the light or the shadow that make a piece on the board an
 * object standing on it.
 */
export const TROPHY_RADIUS = 16;

/**
 * The most pieces a side can lose: it started with nine and the game is over the
 * moment it is down to two, so a heap is never asked to hold more than seven.
 */
export const MOST_CAPTURED = PIECES_PER_SIDE - PIECES_TO_LOSE;

/**
 * The middle of the board, which is the hole the heaps lie in. It is the one
 * place on the drawing that holds nothing: d4 is not a point, no line crosses it,
 * and on a wooden board it is where the taken pieces go.
 */
const CENTRE: Centre = { x: xOf("d"), y: yOf(4) };

/**
 * How far a heap's row sits from the middle line: far enough for the two rows to
 * clear each other, near enough for both to stay inside the hole. Pushing them
 * apart buys length as well as room — a row further from the middle passes the
 * pieces either side of it at a greater distance, so it may reach further before
 * it touches them.
 */
const HEAP_ROW_OFFSET = TROPHY_RADIUS + 14;

/**
 * How far along its row the outermost trophy of a full heap sits. It is as far as
 * it can go without touching the pieces standing on the two points either side of
 * the middle — c4 and e4, one step out — so the length of a row is settled by the
 * board rather than by a number picked to look right.
 */
const HEAP_REACH = Math.floor(
  STEP - Math.sqrt((PIECE_RADIUS + TROPHY_RADIUS) ** 2 - HEAP_ROW_OFFSET ** 2),
);

/** The gap between one trophy and the next, which overlaps them into a pile. */
const TROPHY_STEP = (2 * HEAP_REACH) / (MOST_CAPTURED - 1);

/** How much of the ground shows around a trophy lying in its rack. */
const RACK_PADDING = 3;

/**
 * The rack a heap lies in: a shallow groove in the ground, as long as a full
 * heap and drawn whether or not anything is in it yet.
 *
 * It is there so that a heap of one is a rack with one piece in it rather than a
 * disc sitting at an arbitrary spot in the middle of the board — and so that an
 * empty rack says what the middle of the board is for before the first capture
 * rather than after it. The slots fill from one end, so the rack is also how far
 * there is left to go.
 */
export type HeapRack = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly corner: number;
};

export const rackFor = (side: Side): HeapRack => {
  const height = 2 * (TROPHY_RADIUS + RACK_PADDING);

  return {
    x: CENTRE.x - HEAP_REACH - TROPHY_RADIUS - RACK_PADDING,
    y: HEAP_ROW[side] - height / 2,
    width: 2 * (HEAP_REACH + TROPHY_RADIUS + RACK_PADDING),
    height,
    corner: height / 2,
  };
};

/**
 * Which way up the two heaps lie: each side's own losses on its own side of the
 * middle line, so a heap answers one question — how much of this side is gone —
 * and never two.
 */
const HEAP_ROW: Readonly<Record<Side, number>> = {
  light: CENTRE.y - HEAP_ROW_OFFSET,
  dark: CENTRE.y + HEAP_ROW_OFFSET,
};

/**
 * Where the nth piece a side has lost lies. The slots are fixed rather than
 * spread over however many pieces are in the heap, so a piece that has landed
 * never shifts again when the next one lands beside it: a heap grows, it does not
 * rearrange itself.
 */
export const trophyAt = (side: Side, nth: number): Centre => ({
  x: CENTRE.x - HEAP_REACH + nth * TROPHY_STEP,
  y: HEAP_ROW[side],
});
