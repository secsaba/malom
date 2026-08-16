import { type Page, expect, test } from "@playwright/test";

import type { PointId } from "../../src/engine/board";
import { strings } from "../../src/strings";
import { DARK_PICKINGS, MILL_FREE_PLACING, WALLED_IN } from "../fixtures/placements";

const tap = async (page: Page, ...points: readonly PointId[]) => {
  for (const point of points) await page.locator(`[data-target="${point}"]`).click();
};

const pointAt = (page: Page, point: PointId) => page.locator(`[data-point="${point}"]`);

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

  await tap(page, "b4"); // capture a dark piece

  await expect(pointAt(page, "b4")).not.toHaveAttribute("data-occupant", /.*/);
  await expect(page.getByTestId("capture-prompt")).toHaveCount(0);
  await expect(page.getByTestId("side-to-move")).toHaveText(strings.game.toMove.dark);
});

test("plays a whole game through to a declared result", async ({ page }) => {
  const [first, ...rest] = DARK_PICKINGS;

  await tap(page, ...MILL_FREE_PLACING);

  await tap(page, "e3", "e4", "a4", "b4", "f6", "f4", first); // light closes e4-f4-g4

  // Light runs the mill — f4 out to f6 and back — while dark shuffles between a4
  // and b4, so every second move captures another dark piece.
  for (const [index, picking] of rest.entries()) {
    if (index === rest.length - 1) {
      // The swing before the last leaves dark with the three pieces it flies with.
      await expect(page.getByTestId("phase")).toHaveText(strings.game.phase.flying);
    }

    await tap(page, "b4", "a4", "f4", "f6", "a4", "b4", "f6", "f4", picking);
  }

  await expect(page.getByTestId("result")).toHaveText(strings.game.result.winner.light);
  await expect(page.getByTestId("ending")).toHaveText(strings.game.result.ending.reduced.dark);
  await expect(page.getByTestId("side-to-move")).toHaveCount(0);
});

test("declares the result against a side that is walled in", async ({ page }) => {
  await tap(page, ...WALLED_IN);

  await expect(page.getByTestId("result")).toHaveText(strings.game.result.winner.dark);
  await expect(page.getByTestId("ending")).toHaveText(strings.game.result.ending.blocked.light);

  await tap(page, "a1"); // the board answers nothing now

  await expect(pointAt(page, "a1")).not.toHaveAttribute("data-occupant", /.*/);
});
