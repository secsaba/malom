import { expect, test } from "@playwright/test";

import { LINES, POINTS } from "../../src/engine/board";
import { strings } from "../../src/strings";

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("renders the empty board", async ({ page }) => {
  await expect(page.getByRole("img", { name: strings.board.label })).toBeVisible();

  await expect(page.getByTestId("point")).toHaveCount(POINTS.length);
  await expect(page.getByTestId("line")).toHaveCount(LINES.length);

  // every point of the board is there, each exactly once
  for (const point of POINTS) {
    await expect(page.locator(`[data-point="${point}"]`)).toHaveCount(1);
  }
});

test("shows the coordinates only once they are asked for", async ({ page }) => {
  const toggle = page.getByTestId("coordinates-toggle");
  const coordinates = page.getByTestId("coordinates");

  await expect(toggle).not.toBeChecked();
  await expect(coordinates).toHaveCount(0);

  await page.getByLabel(strings.board.showCoordinates).check();

  await expect(coordinates).toBeVisible();
  for (const label of ["a", "g", "1", "7"]) {
    await expect(coordinates.getByText(label, { exact: true })).toBeVisible();
  }

  await page.getByLabel(strings.board.showCoordinates).uncheck();
  await expect(coordinates).toHaveCount(0);
});

test("speaks Hungarian", async ({ page }) => {
  await expect(page.locator("html")).toHaveAttribute("lang", "hu");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(strings.app.title);
});
