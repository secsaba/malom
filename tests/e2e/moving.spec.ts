import { type Page, expect, test } from "@playwright/test";

import type { PointId } from "../../src/engine/board";
import { strings } from "../../src/strings";

const tap = async (page: Page, ...points: readonly PointId[]) => {
  for (const point of points) await page.locator(`[data-target="${point}"]`).click();
};

const pointAt = (page: Page, point: PointId) => page.locator(`[data-point="${point}"]`);

/**
 * Eighteen placements that close no mill, so the placing phase runs to its end
 * uninterrupted and leaves both sides with somewhere to go. Light ends on a1,
 * a7, b2, c3, d1, d5, e3, f6 and g4; b4, c4, d2, d6, e4 and f4 are left empty.
 */
const MILL_FREE_PLACING = [
  "a1", "g1", "d1", "a4", "a7", "d7", "g4", "g7", "c3",
  "d3", "e3", "c5", "d5", "e5", "b2", "b6", "f6", "f2",
] as const satisfies readonly PointId[];

/**
 * Eighteen placements that wall light in: the only empty points left are a1, a4,
 * a7, d1, d7 and g1, and none of them is next to a light piece. Light comes to
 * move with all nine of its pieces and no move, which loses the game.
 */
const WALLED_IN = [
  "b2", "b4", "c4", "b6", "c5", "c3", "d3", "d2", "d5",
  "d6", "e3", "e5", "e4", "f4", "f2", "g4", "f6", "g7",
] as const satisfies readonly PointId[];

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("moves a piece to a neighbouring point once every piece is placed", async ({ page }) => {
  await tap(page, ...MILL_FREE_PLACING);

  await expect(page.getByTestId("phase")).toHaveText(strings.game.phase.moving);
  await expect(page.getByTestId("side-to-move")).toHaveText(strings.game.toMove.light);

  await tap(page, "b2"); // pick it up

  await expect(pointAt(page, "b2")).toHaveAttribute("data-selected", "");
  await expect(pointAt(page, "b4")).toHaveAttribute("data-legal", ""); // where it may go
  await expect(pointAt(page, "d2")).toHaveAttribute("data-legal", "");
  await expect(pointAt(page, "c4")).not.toHaveAttribute("data-legal", ""); // and where it may not

  await tap(page, "c4"); // a tap away from those puts it down again

  await expect(pointAt(page, "b2")).not.toHaveAttribute("data-selected", "");
  await expect(pointAt(page, "b2")).toHaveAttribute("data-occupant", "light");
  await expect(pointAt(page, "c4")).not.toHaveAttribute("data-occupant", /.*/);
  await expect(page.getByTestId("side-to-move")).toHaveText(strings.game.toMove.light);

  await tap(page, "b2", "b4"); // pick it up again, and move it

  await expect(pointAt(page, "b2")).not.toHaveAttribute("data-occupant", /.*/);
  await expect(pointAt(page, "b4")).toHaveAttribute("data-occupant", "light");
  await expect(page.getByTestId("side-to-move")).toHaveText(strings.game.toMove.dark);
});

test("asks for a capture when a mill closes in the moving phase", async ({ page }) => {
  await tap(page, ...MILL_FREE_PLACING);

  await tap(page, "e3", "e4"); // light walks towards e4-f4-g4
  await tap(page, "a4", "b4"); // dark answers out of the way
  await tap(page, "f6", "f4"); // and light closes the mill

  await expect(page.getByTestId("capture-prompt")).toHaveText(strings.game.capture);
  await expect(page.getByTestId("side-to-move")).toHaveText(strings.game.toMove.light);

  await tap(page, "b4"); // take a dark piece

  await expect(pointAt(page, "b4")).not.toHaveAttribute("data-occupant", /.*/);
  await expect(page.getByTestId("capture-prompt")).toHaveCount(0);
  await expect(page.getByTestId("side-to-move")).toHaveText(strings.game.toMove.dark);
});

test("plays a whole game through to a declared result", async ({ page }) => {
  await tap(page, ...WALLED_IN);

  await expect(page.getByTestId("result")).toHaveText(strings.game.result.winner.dark);
  await expect(page.getByTestId("ending")).toHaveText(strings.game.result.ending.blocked.light);
  await expect(page.getByTestId("side-to-move")).toHaveCount(0);

  await tap(page, "a1"); // the board answers nothing now

  await expect(pointAt(page, "a1")).not.toHaveAttribute("data-occupant", /.*/);
});
