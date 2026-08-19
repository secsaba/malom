import { type Page, devices, expect, test } from "@playwright/test";

import { POINTS } from "../../src/engine/board";
import { strings } from "../../src/strings";
import { MILL_FREE_PLACING } from "../fixtures/games";
import { pointAt, touch } from "./board";

/**
 * How far the page could be scrolled in each direction. Both are nought on a
 * page that is one screen: the board is what the game is played on, and a board
 * that has to be scrolled back to is a board the player has lost.
 */
const scrollableBy = (page: Page) =>
  page.evaluate(() => ({
    across: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    down: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));

/**
 * The board as it is drawn, which is the square of its ground and not the box
 * the SVG was given: the drawing is centred in whatever room the page has, so
 * the element's own box says nothing about where the board came out.
 */
const boardAt = async (page: Page) => {
  const drawn = await page.getByTestId("board-ground").boundingBox();
  expect(drawn).not.toBeNull();

  return drawn!;
};

/** The smallest a target may come out and still be a thing a finger can hit. */
const FINGERTIP = 44;

/**
 * A phone, as Playwright describes one: its screen, its pixel density and its
 * touchscreen. Which browser it would run in is left out on purpose — that is
 * the config's choice, and naming one here would ask for a worker of its own.
 */
const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["Pixel 5"];

test.describe("on a phone", () => {
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

  test.beforeEach(async ({ page }) => {
    await page.goto("./");
  });

  test("fills the width with the board and scrolls the page nowhere", async ({ page }) => {
    const viewport = page.viewportSize()!;
    const board = await boardAt(page);

    expect(board.width).toBe(viewport.width);
    expect(board.x).toBe(0);
    expect(board.y).toBeGreaterThanOrEqual(0);
    expect(board.y + board.height).toBeLessThanOrEqual(viewport.height);

    expect(await scrollableBy(page)).toEqual({ across: 0, down: 0 });
  });

  test("folds the panel down to a handle, and opens it when the player asks", async ({ page }) => {
    const handle = page.getByTestId("panel-handle");
    const setup = page.getByTestId("setup");

    await expect(handle).toHaveText(strings.panel.handle);
    await expect(handle).toHaveAttribute("aria-expanded", "false");
    await expect(setup).toBeHidden();

    await handle.tap();

    await expect(handle).toHaveAttribute("aria-expanded", "true");
    await expect(setup).toBeVisible();

    // The board gives room to the panel rather than being scrolled off by it.
    await expect(page.getByTestId("board-ground")).toBeVisible();
    expect(await scrollableBy(page)).toEqual({ across: 0, down: 0 });

    await handle.tap();

    await expect(handle).toHaveAttribute("aria-expanded", "false");
    await expect(setup).toBeHidden();
  });

  /**
   * Whose turn it is, and the question a blunder is put back with, are what a
   * player has to answer to go on playing. Neither is behind the handle: a
   * question nobody can see is a game that reads as stuck.
   */
  test("leaves the turn out where the player can see it", async ({ page }) => {
    await expect(page.getByTestId("side-to-move")).toBeVisible();
    await expect(page.getByTestId("phase")).toBeVisible();
  });

  test("gives every point a target a fingertip can hit", async ({ page }) => {
    for (const point of POINTS) {
      const target = await page.locator(`[data-target="${point}"]`).boundingBox();

      expect(target, point).not.toBeNull();
      expect(target!.width, point).toBeGreaterThanOrEqual(FINGERTIP);
      expect(target!.height, point).toBeGreaterThanOrEqual(FINGERTIP);
    }
  });

  /** A move is two taps on a touchscreen exactly as it is two clicks: the piece, and where it goes. */
  test("plays a piece to where it is tapped, and then a move by tapping twice", async ({
    page,
  }) => {
    await touch(page, ...MILL_FREE_PLACING);

    await expect(page.getByTestId("phase")).toHaveText(strings.game.phase.moving);

    await touch(page, "b2");

    await expect(pointAt(page, "b2")).toHaveAttribute("data-selected", "");

    await touch(page, "b4");

    await expect(pointAt(page, "b2")).not.toHaveAttribute("data-occupant", /.*/);
    await expect(pointAt(page, "b4")).toHaveAttribute("data-occupant", "light");
  });
});

test.describe("on a desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("stands the panel beside the board rather than behind a handle", async ({ page }) => {
    await page.goto("./");

    await expect(page.getByTestId("panel-handle")).toBeHidden();
    await expect(page.getByTestId("setup")).toBeVisible();

    const board = await boardAt(page);
    const panel = (await page.getByTestId("panel").boundingBox())!;

    // Beside: the panel starts to the right of the board and shares its rows.
    expect(panel.x).toBeGreaterThanOrEqual(board.x + board.width);
    expect(panel.y).toBeLessThan(board.y + board.height);

    expect(await scrollableBy(page)).toEqual({ across: 0, down: 0 });
  });
});

/**
 * Every width the site says it supports, from the narrowest phone still sold to
 * a desktop window: none of them may put the page on a horizontal scrollbar.
 */
const WIDTHS = [320, 360, 393, 768, 1024, 1440] as const;

test("scrolls sideways at no width at all", async ({ page }) => {
  await page.goto("./");

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 720 });

    const { across } = await scrollableBy(page);
    expect(across, `${width}px`).toBe(0);
  }
});
