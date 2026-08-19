import { type Page, devices, expect, test } from "@playwright/test";

import { POINTS, type PointId } from "../../src/engine/board";
import { strings } from "../../src/strings";
import { MILL_FREE_PLACING } from "../fixtures/games";
import { BOARD_SIZE, TARGET_RADIUS } from "../../src/ui/board-layout";
import { pointAt, touch } from "./board";

/**
 * How far the page could be scrolled in each direction. Both are nought on a
 * page that is one screen: the board is what the game is played on, and a board
 * that has to be scrolled back to is a board the player has lost.
 *
 * The app's own box is asked as well as the document's, and is the one that
 * answers: the app is exactly as tall as the viewport, so anything that does not
 * fit overflows inside it and never under the document — and a check that asked
 * only the document would come back nought whatever happened.
 */
const scrollableBy = (page: Page) =>
  page.evaluate(() => {
    const boxes = [document.documentElement, document.querySelector("main")!];

    return {
      across: Math.max(...boxes.map((box) => box.scrollWidth - box.clientWidth)),
      down: Math.max(...boxes.map((box) => box.scrollHeight - box.clientHeight)),
    };
  });

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

/**
 * The slack allowed in a page that does not scroll. Heights that come out
 * fractional — a line of text, a border, a rem against an odd viewport — round up
 * in `scrollHeight`, and one pixel of that is arithmetic rather than a scroll:
 * nothing is out of reach behind it and no scrollbar has anywhere to go.
 */
const ROUNDING = 1;

/** That the page is one screen, in the direction or directions named. */
const expectNoScroll = async (page: Page, where: string) => {
  const { across, down } = await scrollableBy(page);

  expect(across, where).toBeLessThanOrEqual(ROUNDING);
  expect(down, where).toBeLessThanOrEqual(ROUNDING);
};

/** The smallest a target may come out and still be a thing a finger can hit. */
const FINGERTIP = 44;

/**
 * How many targets fit across the board, which is what turns a fingertip into a
 * smallest board: the board is drawn {@link BOARD_SIZE} units across and a target
 * takes {@link TARGET_RADIUS} twice over.
 */
const STEP_ACROSS = TARGET_RADIUS * 2;

/** The target on a point, which is the thing a finger has to land on. */
const targetAt = async (page: Page, point: PointId) => {
  const target = await page.locator(`[data-target="${point}"]`).boundingBox();
  expect(target, point).not.toBeNull();

  return target!;
};

/**
 * A phone, as Playwright describes one: its screen, its pixel density and its
 * touchscreen. Which browser it would run in is left out on purpose — that is
 * the config's choice, and naming one here would ask for a worker of its own.
 */
const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["Pixel 5"];

/** The same phone turned on its side, which is the shortest screen the site meets. */
const LANDSCAPE = { width: viewport.height, height: viewport.width };

test.describe("on a phone", () => {
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

  test.beforeEach(async ({ page }) => {
    await page.goto("./");
  });

  test("fills the width with the board and scrolls the page nowhere", async ({ page }) => {
    const screen = page.viewportSize()!;
    const board = await boardAt(page);

    expect(board.width).toBe(screen.width);
    expect(board.x).toBe(0);
    expect(board.y).toBeGreaterThanOrEqual(0);
    expect(board.y + board.height).toBeLessThanOrEqual(screen.height);

    await expectNoScroll(page, "the board alone");
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
    await expectNoScroll(page, "the panel open");

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
      const target = await targetAt(page, point);

      expect(target.width, point).toBeGreaterThanOrEqual(FINGERTIP);
      expect(target.height, point).toBeGreaterThanOrEqual(FINGERTIP);
    }
  });

  /**
   * The panel takes its share of the height out of the board, and the board is
   * played on while it is open — a learner reading the grade on the move they
   * just played is looking at both. Height taken off the board is width taken off
   * every one of its targets, so the board has a floor and this is what holds it
   * to it.
   */
  test("keeps the targets hittable with the panel open on top of the board", async ({ page }) => {
    const handle = page.getByTestId("panel-handle");

    await handle.tap();
    // Which the board is only squeezed by if it really opened.
    await expect(handle).toHaveAttribute("aria-expanded", "true");

    const target = await targetAt(page, "a1");

    expect(target.width).toBeGreaterThanOrEqual(FINGERTIP);
    expect(target.height).toBeGreaterThanOrEqual(FINGERTIP);
    await expect(page.getByTestId("board-ground")).toBeVisible();
    await expectNoScroll(page, "the panel open");
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

    await expectNoScroll(page, "two columns");
  });
});

/**
 * Every width the site says it supports, from the narrowest phone still sold to
 * a desktop window: none of them may put the page on a horizontal scrollbar, and
 * none of them may shrink the board until a point is smaller than the finger
 * that has to hit it. 320px is where the second of those is tightest, because
 * the board is the width of the screen and the points are 24 of them across it.
 */
const WIDTHS = [320, 360, 393, 768, 1024, 1440] as const;

test("scrolls sideways at no width, and keeps a target a fingertip wide at all of them", async ({
  page,
}) => {
  await page.goto("./");

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 720 });

    await expectNoScroll(page, `${width}px`);

    // Every point is drawn at one radius, so one of them answers for all 24.
    const target = await targetAt(page, "a1");

    expect(target.width, `${width}px`).toBeGreaterThanOrEqual(FINGERTIP);
    expect(target.height, `${width}px`).toBeGreaterThanOrEqual(FINGERTIP);
  }
});

/**
 * A phone turned on its side is the one screen the page cannot be one screen on:
 * the board's floor and the two blocks that cannot shrink come to more than the
 * height there is. What it must not do is meet that by drawing a board too small
 * to play — so the board keeps its floor, every target stays hittable, and the
 * page scrolls to the rest of itself instead.
 */
test.describe("on a phone turned on its side", () => {
  test.use({ viewport: LANDSCAPE, userAgent, deviceScaleFactor, isMobile, hasTouch });

  test("keeps the board playable and scrolls to what is left rather than shrinking it", async ({
    page,
  }) => {
    await page.goto("./");

    const board = await boardAt(page);
    const target = await targetAt(page, "a1");

    expect(board.width).toBeGreaterThanOrEqual(FINGERTIP * (BOARD_SIZE / STEP_ACROSS));
    expect(target.width).toBeGreaterThanOrEqual(FINGERTIP);
    expect(target.height).toBeGreaterThanOrEqual(FINGERTIP);

    // Sideways is the one direction that is never the answer, at any height.
    expect((await scrollableBy(page)).across).toBeLessThanOrEqual(ROUNDING);
  });
});
