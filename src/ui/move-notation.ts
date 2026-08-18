/**
 * A move written down the way it is read out: the coordinates of the points it
 * touched.
 *
 * Coordinates are notation rather than language — they read the same in
 * Hungarian and in English — so this is the one piece of visible text that does
 * not come from the strings module, and it lives in `src/ui` because writing a
 * move down is something an interface does rather than something the rules know.
 *
 * A placement is the point it landed on; a piece that moved is written from-to,
 * along the same hyphen the lines are written with; and a capture is added with
 * an `x`, because which piece a mill took is part of the move.
 */

import type { Move } from "../engine/game";

export const notationOf = ({ from, to, capture }: Move): string => {
  const arrival = from === undefined ? to : `${from}-${to}`;

  return capture === undefined ? arrival : `${arrival}x${capture}`;
};
