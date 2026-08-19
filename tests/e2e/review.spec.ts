import { type Page, expect, test } from "@playwright/test";

import { MILL_FREE_PLACING, REPETITION_CYCLE, WALLED_IN } from "../fixtures/games";
import { pointAt, tap } from "./board";
import { strings } from "./strings";

/** The block of the summary about one side. */
const summaryFor = (page: Page, side: "light" | "dark") =>
  page.locator(`[data-testid="summary-side"][data-side="${side}"]`);

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("lists every move of the game once teaching is on", async ({ page }) => {
  const list = page.getByTestId("move-list");

  // Two people sharing a device are not being taught, so nothing is shown them.
  await expect(list).toHaveCount(0);

  await page.getByLabel(strings.teaching.toggle).check();

  await expect(list).toHaveCount(0); // nothing has been played yet

  await tap(page, "a1", "g7");

  const played = page.getByTestId("played-move");
  await expect(played).toHaveCount(2);

  // Coordinates are notation rather than language, so they are read as written.
  await expect(played.first()).toContainText("a1");
  await expect(played.first()).toContainText(strings.game.side.light);
  await expect(played.nth(1)).toContainText("g7");
  await expect(played.nth(1)).toContainText(strings.game.side.dark);

  // The grade the engine settles on is its own business; that it lands on the
  // move it was about, in the word the glossary gives it, is not.
  await expect(played.first()).toContainText(
    new RegExp(Object.values(strings.teaching.grade).join("|"), "u"),
    { timeout: 30_000 },
  );
});

test("shows the position a move produced, and comes back to the game", async ({ page }) => {
  await page.getByLabel(strings.teaching.toggle).check();
  await tap(page, "a1", "g7", "d1");

  const played = page.getByTestId("played-move");
  const back = page.getByTestId("back-to-play");

  await expect(back).toHaveCount(0); // the game is the thing being watched

  await played.first().click();

  await expect(played.first()).toHaveAttribute("aria-pressed", "true");
  await expect(pointAt(page, "a1")).toHaveAttribute("data-occupant", "light");
  await expect(pointAt(page, "g7")).not.toHaveAttribute("data-occupant", "dark");
  await expect(page.getByTestId("side-to-move")).toHaveText(strings.game.toMove.dark);

  // Nothing on the board being shown is the player's to play: the game is
  // somewhere else, and a tap on it changes nothing.
  await tap(page, "d7");

  await expect(pointAt(page, "d7")).not.toHaveAttribute("data-occupant", "dark");
  await expect(played).toHaveCount(3);
  await expect(page.getByTestId("hint")).toBeDisabled();
  await expect(page.getByTestId("takeback")).toBeDisabled();

  await back.click();

  await expect(back).toHaveCount(0);
  await expect(pointAt(page, "d1")).toHaveAttribute("data-occupant", "light");
  await expect(played.first()).toHaveAttribute("aria-pressed", "false");

  // And the game carries on from exactly where it was left.
  await tap(page, "d7");

  await expect(pointAt(page, "d7")).toHaveAttribute("data-occupant", "dark");
});

test("counts the finished game up and names what to work on", async ({ page }) => {
  await page.getByLabel(strings.teaching.toggle).check();

  await expect(page.getByTestId("summary")).toHaveCount(0);

  // The placing phase leaves light with all nine pieces on the board and not one
  // of them able to move, which loses light the game.
  await tap(page, ...WALLED_IN);

  await expect(page.getByTestId("result")).toHaveText(strings.game.result.winner.dark);

  const summary = page.getByTestId("summary");
  await expect(summary).toBeVisible();

  // One block per side, because both of them were being taught.
  await expect(page.getByTestId("summary-side")).toHaveCount(2);
  await expect(summaryFor(page, "light").getByTestId("side-result")).toHaveText(
    strings.teaching.summary.result.lost,
  );
  await expect(summaryFor(page, "dark").getByTestId("side-result")).toHaveText(
    strings.teaching.summary.result.won,
  );

  // Every move each side played is counted, once the engine has answered for
  // all eighteen of them.
  await expect(summaryFor(page, "light").getByTestId("graded-count")).toHaveText("9", {
    timeout: 120_000,
  });

  const counts = await summaryFor(page, "light").getByTestId("grade-count").allInnerTexts();
  expect(counts.map(Number).reduce((all, count) => all + count, 0)).toBe(9);

  // What the weakness is is the engine's own business; that it is one the
  // strings module holds a name for, or the honest line saying there was none,
  // is not (ADR-0003).
  const said = await summaryFor(page, "light").getByTestId("weakness").innerText();
  const catalogued: readonly string[] = Object.values(strings.teaching.summary.criticism);

  expect(
    said === strings.teaching.summary.noWeakness ||
      catalogued.some((criticism) => said.includes(criticism)),
  ).toBe(true);
});

/** The acceptance criterion: a draw is not framed as a failure. */
test("sums a drawn game up as drawn rather than as a defeat", async ({ page }) => {
  await page.getByLabel(strings.teaching.toggle).check();
  await tap(page, ...MILL_FREE_PLACING);

  // Twice round the cycle brings the position back for the third time, which
  // draws the game with neither side having lost it.
  for (const [from, to] of REPETITION_CYCLE) await tap(page, from, to);
  for (const [from, to] of REPETITION_CYCLE) await tap(page, from, to);

  await expect(page.getByTestId("result")).toHaveText(strings.game.result.draw);

  for (const side of ["light", "dark"] as const) {
    await expect(summaryFor(page, side).getByTestId("side-result")).toHaveText(
      strings.teaching.summary.result.drawn,
    );
  }
});

test("throws the record away with the game it was written for", async ({ page }) => {
  await page.getByLabel(strings.teaching.toggle).check();
  await tap(page, ...MILL_FREE_PLACING.slice(0, 4));

  await expect(page.getByTestId("played-move")).toHaveCount(4);

  await page.getByTestId("start").click();

  await expect(page.getByTestId("move-list")).toHaveCount(0);
});
