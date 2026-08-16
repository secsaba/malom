/**
 * How the browser suites reach the board: the tap that plays a point, and the
 * point a tap lands on. Playwright collects `*.spec.ts` only, so nothing here
 * runs as a test of its own.
 */

import type { Page } from "@playwright/test";

import type { PointId } from "../../src/engine/board";

/** Tap each point in turn — one tap is a placement, two are a move. */
export const tap = async (page: Page, ...points: readonly PointId[]) => {
  for (const point of points) await page.locator(`[data-target="${point}"]`).click();
};

/** The point as the board drew it, for the attributes it wears. */
export const pointAt = (page: Page, point: PointId) => page.locator(`[data-point="${point}"]`);
