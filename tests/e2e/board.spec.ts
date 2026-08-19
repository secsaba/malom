import { type Locator, expect, test } from "@playwright/test";

import { LINES, POINTS } from "../../src/engine/board";
import { strings } from "../../src/strings";
import { MILL_FREE_PLACING } from "../fixtures/games";
import { pointAt, tap } from "./taps";

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("renders the empty board", async ({ page }) => {
  await expect(page.getByRole("group", { name: strings.board.label })).toBeVisible();

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

/**
 * The animation itself is the stylesheet's; what the board owes it is the piece
 * that moved last, marked with how it got where it is and — where it came off
 * another point — how far it travelled, in the units the board is drawn in.
 */
test("marks the piece that moved last with the travel that brought it in", async ({ page }) => {
  await tap(page, "a1");

  await expect(pointAt(page, "a1")).toHaveAttribute("data-arrived", "placed");

  await tap(page, "g1"); // dark answers, and the mark goes with the move

  await expect(pointAt(page, "a1")).not.toHaveAttribute("data-arrived", /.*/);
  await expect(pointAt(page, "g1")).toHaveAttribute("data-arrived", "placed");

  await tap(page, ...MILL_FREE_PLACING.slice(2), "b2", "b4");

  await expect(pointAt(page, "b4")).toHaveAttribute("data-arrived", "moved");
  await expect(pointAt(page, "b4")).toHaveAttribute("style", /--arrived-x:.*px/);
  await expect(pointAt(page, "b4")).toHaveAttribute("style", /--arrived-y:.*px/);
});

/**
 * Colour is what the board says a state in, and it is never the only thing it
 * says it in: every state a point can be in carries a shape of its own — a
 * dashed ring, a solid one, a ring inside the piece — so a player who cannot
 * tell two of the inks apart can still tell the states apart.
 */
test("tells the states of a point apart by shape as well as by colour", async ({ page }) => {
  const dashesOf = (locator: Locator) =>
    locator.evaluate((element) => getComputedStyle(element).strokeDasharray);

  await tap(page, ...MILL_FREE_PLACING, "b2"); // and pick a piece up

  // where it may go: the dashed outline of the piece that would land there
  const destination = page.locator(`[data-destination="b4"]`);
  await expect(destination).toHaveCount(1);
  expect(await dashesOf(destination)).not.toBe("none");

  // the piece picked up, told from it by a ring that is solid rather than dashed
  expect(await dashesOf(pointAt(page, "b2"))).toBe("none");

  await tap(page, "b4");

  // and where the move came to rest, marked inside the piece that made it
  await expect(page.getByTestId("last-move").locator("circle")).toHaveCount(1);
});

/**
 * Movement is the lesser half of what the board says about the last move, and a
 * player who has asked their system for as little of it as it can manage is
 * shown the other half rather than nothing.
 */
test("runs no animation for a player who asked for none, and marks the last move anyway", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  await tap(page, "a1");

  const animation = await pointAt(page, "a1").evaluate(
    (element) => getComputedStyle(element).animationName,
  );
  expect(animation).toBe("none");

  await expect(page.getByTestId("last-move").locator("circle")).toHaveCount(1);
});

test("speaks Hungarian, down to the browser tab", async ({ page }) => {
  await expect(page.locator("html")).toHaveAttribute("lang", "hu");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(strings.app.title);
  await expect(page).toHaveTitle(strings.app.title);
});
