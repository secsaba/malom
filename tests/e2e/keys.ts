/**
 * How the browser suites reach the board without a pointer. Everything here goes
 * through `page.keyboard`, never through `locator.focus()` or `locator.press()`:
 * focus put there by the test is focus the player would have had to reach, and a
 * suite that helps itself to it proves nothing about a keyboard.
 *
 * Playwright collects `*.spec.ts` only, so nothing here runs as a test of its
 * own.
 */

import type { Page } from "@playwright/test";

import { POINTS, type PointId } from "../../src/engine/board";

/**
 * Which point the keyboard is on, as its place in the tab order — and -1 for
 * anywhere else, the page having just loaded being the case that matters.
 */
const focusedAt = async (page: Page): Promise<number> => {
  const point = await page.evaluate(() => document.activeElement?.getAttribute("data-target"));

  return POINTS.indexOf(point as PointId);
};

/** Walk the tab order to a point and play it, the way a player without a pointer would. */
export const press = async (page: Page, ...points: readonly PointId[]) => {
  for (const point of points) {
    const wanted = POINTS.indexOf(point);
    let at = await focusedAt(page);

    while (at < wanted) {
      await page.keyboard.press("Tab");
      at += 1;
    }
    while (at > wanted) {
      await page.keyboard.press("Shift+Tab");
      at -= 1;
    }

    await page.keyboard.press("Enter");
  }
};
