import { type Page, expect, test } from "@playwright/test";

import { pointAt, tap } from "./board";
import { strings } from "./strings";

const inHand = (page: Page, side: "light" | "dark") =>
  page.locator(`[data-testid="in-hand"][data-side="${side}"]`);

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("opens in the placing phase with light to move and every piece in hand", async ({ page }) => {
  await expect(page.getByTestId("phase")).toHaveText(strings.game.phase.placing);
  await expect(page.getByTestId("side-to-move")).toHaveText(strings.game.toMove.light);

  await expect(inHand(page, "light")).toHaveText("9");
  await expect(inHand(page, "dark")).toHaveText("9");
});

test("places the sides' pieces alternately and counts them out of hand", async ({ page }) => {
  await tap(page, "a1");

  await expect(pointAt(page, "a1")).toHaveAttribute("data-occupant", "light");
  await expect(inHand(page, "light")).toHaveText("8");
  await expect(page.getByTestId("side-to-move")).toHaveText(strings.game.toMove.dark);

  await tap(page, "a7");

  await expect(pointAt(page, "a7")).toHaveAttribute("data-occupant", "dark");
  await expect(inHand(page, "dark")).toHaveText("8");
  await expect(page.getByTestId("side-to-move")).toHaveText(strings.game.toMove.light);
});

test("ignores a tap on an occupied point", async ({ page }) => {
  await tap(page, "a1", "a1");

  await expect(pointAt(page, "a1")).toHaveAttribute("data-occupant", "light");
  await expect(inHand(page, "light")).toHaveText("8");
  await expect(page.getByTestId("side-to-move")).toHaveText(strings.game.toMove.dark);
});

test("asks for a capture when a mill closes, and holds the move open until it is taken", async ({
  page,
}) => {
  await tap(page, "a1", "a7", "d1", "d7");

  await expect(page.getByTestId("capture-prompt")).toHaveCount(0);

  await tap(page, "g1"); // closes a1-d1-g1

  await expect(page.getByTestId("capture-prompt")).toHaveText(strings.game.capture);
  await expect(page.getByTestId("side-to-move")).toHaveText(strings.game.toMove.light);

  await tap(page, "b2"); // a placement is refused while the capture is owed
  await expect(pointAt(page, "b2")).not.toHaveAttribute("data-occupant", /.*/);

  await tap(page, "a7"); // take a dark piece

  await expect(pointAt(page, "a7")).not.toHaveAttribute("data-occupant", /.*/);
  await expect(page.getByTestId("capture-prompt")).toHaveCount(0);
  await expect(page.getByTestId("side-to-move")).toHaveText(strings.game.toMove.dark);
});
