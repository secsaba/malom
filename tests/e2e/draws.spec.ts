import { expect, test } from "@playwright/test";

import { MILL_FREE_PLACING, REPETITION_CYCLE } from "../fixtures/games";
import { pointAt, tap } from "./board";
import { strings } from "./strings";

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("declares a draw when the same position comes up for the third time", async ({ page }) => {
  await tap(page, ...MILL_FREE_PLACING);

  // Once round the cycle brings the position back for the second time, which is
  // still a game; twice round brings it back for the third, which is not.
  for (const [from, to] of REPETITION_CYCLE) await tap(page, from, to);

  await expect(page.getByTestId("result")).toHaveCount(0);

  for (const [from, to] of REPETITION_CYCLE) await tap(page, from, to);

  await expect(page.getByTestId("result")).toHaveText(strings.game.result.draw);
  await expect(page.getByTestId("drawn")).toHaveText(strings.game.result.drawnBy.repetition);
  await expect(page.getByTestId("ending")).toHaveCount(0); // nobody was left in one
  await expect(page.getByTestId("side-to-move")).toHaveCount(0);

  await tap(page, "b2"); // the board answers nothing now

  await expect(pointAt(page, "b2")).not.toHaveAttribute("data-selected", "");
});
