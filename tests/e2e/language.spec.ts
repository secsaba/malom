/**
 * Which language the interface is read in.
 *
 * Hungarian is the default and the source of truth, so most of the browser
 * suite reads the page in it without asking (see `./strings.ts`). This is the
 * one spec that asks for the other one, and what it is really checking is that
 * the switch reaches everything: the panel, the board's announcements, the
 * language the page declares itself to be in, and the browser tab.
 */

import { type Page, expect, test } from "@playwright/test";

import { stringsFor } from "../../src/strings";
import { KEYS } from "../../src/ui/storage";

const hu = stringsFor("hu");
const en = stringsFor("en");

/** What the page tells assistive technology it is written in. */
const declaredLanguage = (page: Page) =>
  page.evaluate(() => document.documentElement.lang);

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("reads in Hungarian until the player asks for something else", async ({ page }) => {
  await expect(page.getByTestId("language-hu")).toBeChecked();
  await expect(page.getByTestId("phase")).toHaveText(hu.game.phase.placing);
  expect(await declaredLanguage(page)).toBe("hu");
  await expect(page).toHaveTitle(hu.app.title);
});

test("switches the panel, the board and the page itself into English", async ({ page }) => {
  await page.getByTestId("language-en").check();

  await expect(page.getByTestId("phase")).toHaveText(en.game.phase.placing);
  await expect(page.getByRole("group", { name: en.board.label })).toBeVisible();
  await expect(page.getByLabel(en.teaching.toggle)).toBeVisible();

  // The board reads a point out in the language the rest of the page is in, or
  // a player who cannot see it is the one player the switch left behind.
  await expect(page.locator('[data-target="a1"]')).toHaveAttribute(
    "aria-label",
    new RegExp(en.board.point.empty),
  );

  expect(await declaredLanguage(page)).toBe("en");
  await expect(page).toHaveTitle(en.app.title);
});

test("remembers the language, as it remembers the other settings", async ({ page }) => {
  await page.getByTestId("language-en").check();

  await page.reload();

  await expect(page.getByTestId("language-en")).toBeChecked();
  await expect(page.getByTestId("phase")).toHaveText(en.game.phase.placing);
  expect(await declaredLanguage(page)).toBe("en");
});

test("comes back in Hungarian where storage holds a language nobody offers", async ({ page }) => {
  await page.evaluate(
    (key) => localStorage.setItem(key, JSON.stringify({ language: "de" })),
    KEYS.settings,
  );
  await page.reload();

  await expect(page.getByTestId("language-hu")).toBeChecked();
  await expect(page.getByTestId("phase")).toHaveText(hu.game.phase.placing);
});
