import { expect, test } from "@playwright/test";

import { POINTS } from "../../src/engine/board";
import { strings } from "../../src/strings";
import { BETWEEN } from "../../src/ui/point-state";
import { MILL_FREE_PLACING } from "../fixtures/games";
import { press } from "./keys";
import { pointAt } from "./taps";

const { point } = strings.board;

/** A point as it announces itself: its coordinate, and then what it is. */
const announced = (coordinate: string, ...states: readonly string[]) =>
  [coordinate, ...states].join(BETWEEN);

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("puts every one of the 24 points in the tab order, in the board's own order", async ({
  page,
}) => {
  for (const expected of POINTS) {
    await page.keyboard.press("Tab");

    const focused = await page.evaluate(() =>
      document.activeElement?.getAttribute("data-target"),
    );
    expect(focused).toBe(expected);
  }

  // and the board is left behind rather than looped round
  await page.keyboard.press("Tab");
  const beyond = await page.evaluate(() => document.activeElement?.getAttribute("data-target"));
  expect(beyond).toBeNull();
});

test("shows the keyboard where it is", async ({ page }) => {
  await page.keyboard.press("Tab");

  const marked = await page.evaluate(() => document.activeElement?.matches(":focus-visible"));
  expect(marked).toBe(true);
});

test("announces each point with its coordinate and what stands on it", async ({ page }) => {
  await expect(page.getByRole("button", { name: announced("a1", point.empty) })).toBeVisible();

  await press(page, "a1");

  await expect(
    page.getByRole("button", {
      name: announced("a1", point.piece.light, point.lastMove),
      exact: true,
    }),
  ).toBeVisible();
});

/**
 * The whole of acceptance: a mill closed and the capture it earns taken, from a
 * fresh board, with nothing but Tab and Enter.
 */
test("plays a move through to the capture it earns, without a pointer", async ({ page }) => {
  await press(page, "a1", "a7", "d1", "d7", "g1"); // light closes a1-d1-g1

  await expect(page.getByTestId("capture-prompt")).toHaveText(strings.game.capture);
  await expect(page.getByTestId("side-to-move")).toHaveText(strings.game.toMove.light);

  await press(page, "a7"); // and takes a dark piece

  await expect(pointAt(page, "a7")).not.toHaveAttribute("data-occupant", /.*/);
  await expect(page.getByTestId("capture-prompt")).toHaveCount(0);
  await expect(page.getByTestId("side-to-move")).toHaveText(strings.game.toMove.dark);
});

/**
 * The other half of a move, which the placing phase never asks for: picking a
 * piece up, hearing that it has been picked up, and sending it somewhere.
 */
test("picks a piece up and moves it, without a pointer", async ({ page }) => {
  await press(page, ...MILL_FREE_PLACING);

  await expect(page.getByTestId("phase")).toHaveText(strings.game.phase.moving);

  await press(page, "b2"); // pick it up

  await expect(
    page.getByRole("button", { name: announced("b2", point.piece.light, point.selected) }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: announced("b4", point.empty, point.legal) }),
  ).toBeVisible();

  await press(page, "b4"); // and send it

  await expect(pointAt(page, "b2")).not.toHaveAttribute("data-occupant", /.*/);
  await expect(pointAt(page, "b4")).toHaveAttribute("data-occupant", "light");
  await expect(page.getByTestId("side-to-move")).toHaveText(strings.game.toMove.dark);
});
