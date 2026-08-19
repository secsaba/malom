/**
 * What survives a reload. An accidental refresh is the one accident this app can
 * protect a learner from entirely, and ADR-0004 puts the whole of that
 * protection in the browser's own storage: there is no server to keep a game on.
 *
 * The grades are the delicate part of it. A move is graded by a search that
 * answers well after the move was played, and a page closed while one is on its
 * way loses that answer for good — so every test that reloads over a graded game
 * waits for the grade to appear on the board first.
 */

import { type Page, expect, test } from "@playwright/test";

import { DEFAULT_DIFFICULTY } from "../../src/opponent/difficulty";
import { KEYS } from "../../src/ui/storage";
import { strings } from "../../src/strings";
import { pointAt, tap } from "./taps";

/** Every grade the move list is showing, in the order the moves were played. */
const gradesShown = (page: Page) =>
  page
    .getByTestId("played-move")
    .evaluateAll((moves) => moves.map((move) => move.getAttribute("data-grade")));

/** Put something under one of the keys this app reads, and come back to the page. */
const storedUnder = async (page: Page, key: string, written: string) => {
  await page.evaluate(([under, value]) => localStorage.setItem(under!, value!), [key, written]);
  await page.reload();
};

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("brings the game back, with the moves played in it and their grades", async ({ page }) => {
  await page.getByLabel(strings.teaching.toggle).check();
  await tap(page, "a1", "g7");

  const played = page.getByTestId("played-move");
  await expect(played).toHaveCount(2);
  // The engine has to have answered for both moves before the page goes: a grade
  // still being worked out is one nobody gets back.
  await expect(played.first()).toHaveAttribute("data-grade", /.+/, { timeout: 20_000 });
  await expect(played.nth(1)).toHaveAttribute("data-grade", /.+/, { timeout: 20_000 });
  const grades = await gradesShown(page);
  // On the board is not yet in storage — the writing happens after the paint that
  // put it there — and it is storage the reload reads.
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), KEYS.game))
    .toContain('"grade"');

  await page.reload();

  await expect(pointAt(page, "a1")).toHaveAttribute("data-occupant", "light");
  await expect(pointAt(page, "g7")).toHaveAttribute("data-occupant", "dark");
  await expect(page.getByTestId("side-to-move")).toHaveText(strings.game.toMove.light);
  await expect(page.getByTestId("in-hand").and(page.locator('[data-side="light"]'))).toHaveText("8");
  await expect(page.getByTestId("played-move")).toHaveCount(2);
  expect(await gradesShown(page)).toEqual(grades);
});

test("brings the game back far enough to go on playing it", async ({ page }) => {
  await tap(page, "a1", "g7", "d1");

  await page.reload();

  await tap(page, "d7", "b2");

  await expect(pointAt(page, "d7")).toHaveAttribute("data-occupant", "dark");
  await expect(pointAt(page, "b2")).toHaveAttribute("data-occupant", "light");
  await expect(page.locator("[data-occupant]")).toHaveCount(5);
});

test("comes back to the same opponent, still playing", async ({ page }) => {
  await page.getByTestId("against-computer").check();
  await page.getByTestId("side-dark").check(); // the computer takes light, and opens
  await page.getByTestId("start").click();

  await expect(page.locator("[data-occupant]")).toHaveCount(1, { timeout: 20_000 });

  await page.reload();

  // The setup says what is being played rather than contradicting the board.
  await expect(page.getByTestId("against-computer")).toBeChecked();
  await expect(page.getByTestId("side-dark")).toBeChecked();
  await expect(page.locator("[data-occupant]")).toHaveCount(1);

  // And the computer is still an opponent: it answers the move played after the reload.
  const empty = await page.locator("[data-point]:not([data-occupant])").first().getAttribute("data-point");
  await tap(page, empty as never);

  await expect(page.locator("[data-occupant]")).toHaveCount(3, { timeout: 20_000 });
});

test("remembers every setting the player chose", async ({ page }) => {
  await page.getByTestId("difficulty-strong").check();
  await page.getByLabel(strings.teaching.toggle).check();
  await page.getByLabel(strings.teaching.warning.toggle).check();
  await page.getByLabel(strings.board.showCoordinates).check();

  await page.reload();

  await expect(page.getByTestId("difficulty-strong")).toBeChecked();
  await expect(page.getByTestId("teaching-toggle")).toBeChecked();
  await expect(page.getByTestId("warning-toggle")).toBeChecked();
  await expect(page.getByTestId("coordinates-toggle")).toBeChecked();
  await expect(page.getByTestId("coordinates")).toBeVisible();
});

test("throws the stored game away when another is started, and keeps the settings", async ({
  page,
}) => {
  await page.getByTestId("difficulty-master").check();
  await page.getByLabel(strings.board.showCoordinates).check();
  await tap(page, "a1", "g7");

  await page.getByTestId("start").click();
  await page.reload();

  await expect(page.locator("[data-occupant]")).toHaveCount(0);
  await expect(page.getByTestId("difficulty-master")).toBeChecked();
  await expect(page.getByTestId("coordinates-toggle")).toBeChecked();
});

test("throws the stored game away when the next one is against the computer", async ({ page }) => {
  await tap(page, "a1", "g7", "d1");

  await page.getByTestId("against-computer").check();
  await page.getByTestId("side-dark").check(); // the computer takes light, and opens
  await page.getByTestId("start").click();

  await expect(page.locator("[data-occupant]")).toHaveCount(1, { timeout: 20_000 });

  await page.reload();

  // The computer's opening move and nothing else: no part of the game it replaced
  // came back with it.
  await expect(page.locator("[data-occupant]")).toHaveCount(1);
  await expect(page.getByTestId("played-move")).toHaveCount(1);
});

test.describe("storage holding something this program never wrote", () => {
  test("costs the player a new game and nothing else", async ({ page }) => {
    await storedUnder(page, KEYS.game, "{ this is not the JSON you are looking for");

    await expect(page.getByTestId("board")).toBeVisible();
    await expect(page.locator("[data-occupant]")).toHaveCount(0);
    await expect(page.getByTestId("phase")).toBeVisible();
  });

  test("is turned away whole where its moves are moves the rules do not allow", async ({ page }) => {
    const impossible = { moves: [{ move: { to: "a1" } }, { move: { to: "a1" } }] };
    await storedUnder(page, KEYS.game, JSON.stringify(impossible));

    await expect(page.locator("[data-occupant]")).toHaveCount(0);
  });

  test("leaves every setting at its default", async ({ page }) => {
    await storedUnder(page, KEYS.settings, '["master", true]');

    await expect(page.getByTestId(`difficulty-${DEFAULT_DIFFICULTY}`)).toBeChecked();
    await expect(page.getByTestId("coordinates-toggle")).not.toBeChecked();
    await expect(page.getByTestId("teaching-toggle")).not.toBeChecked();
  });

  test("keeps the settings it can read and drops the ones it cannot", async ({ page }) => {
    const half = { difficulty: "unbeatable", showCoordinates: true };
    await storedUnder(page, KEYS.settings, JSON.stringify(half));

    await expect(page.getByTestId(`difficulty-${DEFAULT_DIFFICULTY}`)).toBeChecked();
    await expect(page.getByTestId("coordinates-toggle")).toBeChecked();
  });
});
