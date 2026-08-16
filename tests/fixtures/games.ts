/**
 * Games both test suites play through, so the browser is driven through the same
 * ones the facade is — and so a position that took working out is written down
 * once, with what makes it worth playing.
 */

import type { PointId } from "../../src/engine/board";

/**
 * Eighteen placements that close no mill, so the placing phase runs to its end
 * uninterrupted and leaves a position both sides can move in. Light ends on a1,
 * a7, b2, c3, d1, d5, e3, f6 and g4; dark on a4, b6, c5, d3, d7, e5, f2, g1 and
 * g7; b4, c4, d2, d6, e4 and f4 are left empty.
 */
export const MILL_FREE_PLACING = [
  "a1", "g1", "d1", "a4", "a7", "d7", "g4", "g7", "c3",
  "d3", "e3", "c5", "d5", "e5", "b2", "b6", "f6", "f2",
] as const satisfies readonly PointId[];

/**
 * Eighteen placements that wall light in. The placing phase closes no mill and
 * leaves a1, a4, a7, d1, d7 and g1 empty; every one of those sits next to dark
 * pieces and to other empty points only, so light comes to move with all nine of
 * its pieces still on the board and not one of them able to go anywhere.
 */
export const WALLED_IN = [
  "b2", "b4", "c4", "b6", "c5", "c3", "d3", "d2", "d5",
  "d6", "e3", "e5", "e4", "f4", "f2", "g4", "f6", "g7",
] as const satisfies readonly PointId[];

/**
 * The dark pieces light captures as it runs the mill e4-f4-g4, in order: one per
 * swing, from the position {@link MILL_FREE_PLACING} leaves. Dark closes no mill
 * of its own along the way, so every one of its pieces stays capturable.
 */
export const DARK_PICKINGS = ["b6", "c5", "d3", "d7", "e5", "f2", "g1"] as const;

/**
 * Four moves that leave the board exactly as they found it, from the position
 * {@link MILL_FREE_PLACING} leaves: light steps b2 out to d2 and back again while
 * dark does the same with d7 and d6. Neither point closes a mill — d2 has dark's
 * d3 and f2 across its lines, d6 light's d5 and f6 — so the cycle can be played
 * as often as the rules allow. Playing it twice brings the position the placing
 * phase ended on back for the third time, which draws the game.
 */
export const REPETITION_CYCLE = [
  ["b2", "d2"],
  ["d7", "d6"],
  ["d2", "b2"],
  ["d6", "d7"],
] as const satisfies readonly (readonly [PointId, PointId])[];
