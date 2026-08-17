import { type Locator, type Page, expect, test } from "@playwright/test";

import type { PointId } from "../../src/engine/board";
import { strings } from "../../src/strings";
import { MILL_FREE_PLACING } from "../fixtures/games";
import { pointAt, tap } from "./taps";

/** How a point is drawn now: what a state of the game leaves on it. */
const inkOf = (point: Locator) =>
  point.evaluate((circle) => {
    const drawn = getComputedStyle(circle);
    return {
      stroke: drawn.stroke,
      dashes: drawn.strokeDasharray,
      fill: drawn.fill,
      arriving: drawn.animationName,
    };
  });

/** A point the board has marked, of however many wear the mark. */
const marked = (page: Page, mark: string) => page.locator(`[data-point]${mark}`).first();

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("is off for two people sharing a device and on against the computer", async ({ page }) => {
  const teaching = page.getByTestId("teaching-toggle");

  await expect(teaching).not.toBeChecked();

  await page.getByTestId("against-computer").check();
  await page.getByTestId("start").click();

  await expect(teaching).toBeChecked();
});

test("shows the move the engine prefers when the player asks for one", async ({ page }) => {
  await page.getByLabel(strings.teaching.toggle).check();

  const hint = page.getByTestId("hint");
  await expect(hint).toBeEnabled();
  await expect(page.locator("[data-point][data-hint]")).toHaveCount(0);

  await hint.click();

  // Which point it prefers is the engine's own business; that it names one is not.
  await expect(marked(page, "[data-hint='to']")).toBeVisible();

  await tap(page, "d2"); // any move of the player's own leaves the advice behind

  await expect(page.locator("[data-point][data-hint]")).toHaveCount(0);
});

test("marks the hint apart from a selection, a legal move and the last move", async ({ page }) => {
  await page.getByLabel(strings.teaching.toggle).check();
  await tap(page, ...MILL_FREE_PLACING);

  await page.getByTestId("hint").click();
  await expect(marked(page, "[data-hint='from']")).toBeVisible();

  // The hint is a ring round the points it names, in an ink of its own and at a
  // radius nothing else on the board is drawn at.
  const rings = page.getByTestId("hints").locator("circle");
  await expect(rings).toHaveCount(2); // the piece to play, and where to play it

  const hint = await inkOf(rings.first());
  const inks = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return ["--point-hint-ink", "--point-legal-ink", "--point-selected-ink"].map((name) =>
      root.getPropertyValue(name).trim(),
    );
  });

  expect(new Set(inks).size).toBe(inks.length);
  expect(await rings.first().getAttribute("r")).not.toEqual(
    await marked(page, "[data-hint='from']").getAttribute("r"),
  );

  // Which leaves every mark of the game's own saying exactly what it said before:
  // the hinted piece is a piece light may pick up, and looks like one.
  const hinted = await inkOf(marked(page, "[data-hint='from']"));
  const movable = await inkOf(marked(page, "[data-legal][data-occupant]:not([data-hint])"));

  expect(hinted).toEqual(movable);
  expect(hint.stroke).not.toEqual(movable.stroke);

  // The last move is not a mark either — it is the piece arriving — so it cannot
  // be read as a hint, or the other way round.
  const arrived = marked(page, "[data-arrived]");
  await expect(arrived).toHaveCount(1);
  const last = await inkOf(arrived);

  expect(last.arriving).not.toBe("none");
  expect(hint.arriving).toBe("none");

  // And picking the hinted piece up shows it as picked up, hint and all.
  const from = await marked(page, "[data-hint='from']").getAttribute("data-point");
  await tap(page, from as PointId);

  const selected = await inkOf(marked(page, "[data-selected]"));

  expect(selected.stroke).not.toEqual(hint.stroke);
  await expect(rings).toHaveCount(2);
});

test("offers no hint while the computer is the one to move", async ({ page }) => {
  await page.getByTestId("against-computer").check();
  await page.getByTestId("side-dark").check();
  await page.getByTestId("start").click();

  await expect(page.getByTestId("teaching-toggle")).toBeChecked();
  await expect(page.getByTestId("thinking")).toBeVisible();
  await expect(page.getByTestId("hint")).toBeDisabled();

  await expect(page.getByTestId("side-to-move")).toHaveText(strings.game.toMove.dark, {
    timeout: 30_000,
  });

  await expect(page.getByTestId("hint")).toBeEnabled();
});

test("puts the hint away with teaching itself", async ({ page }) => {
  const teaching = page.getByLabel(strings.teaching.toggle);
  await teaching.check();
  await page.getByTestId("hint").click();

  await expect(marked(page, "[data-hint]")).toBeVisible();

  await teaching.uncheck();

  await expect(page.locator("[data-point][data-hint]")).toHaveCount(0);
  await expect(page.getByTestId("hint")).toHaveCount(0);

  // The board is otherwise exactly as it was: nothing about teaching is part of the game.
  await tap(page, "a1");

  await expect(pointAt(page, "a1")).toHaveAttribute("data-occupant", "light");
});
