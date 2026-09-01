import { type Page, devices, expect, test } from "@playwright/test";

import { POINTS, type PointId } from "../../src/engine/board";
import { MILL_FREE_PLACING } from "../fixtures/games";
import { BOARD_SIZE, TARGET_RADIUS } from "../../src/ui/board-layout";
import { pointAt, touch } from "./board";
import { strings } from "./strings";

/**
 * How far the page could be scrolled in each direction. Sideways is the one that
 * has to come back nought on every screen: the board is what the game is played
 * on, and a board that has to be scrolled across is a board the player has lost.
 * Downwards is what the phone page is for — the panel stands below the board and
 * is reached by scrolling to it.
 *
 * The app's own box is asked as well as the document's, because where the app is
 * exactly as tall as the viewport — which it is once there is room for two
 * columns — anything that does not fit overflows inside it and never under the
 * document, so a check that asked only the document would come back nought
 * whatever happened.
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

/** That the page is not scrolled sideways, which is asked of every screen. */
const expectNoScrollAcross = async (page: Page, where: string) => {
  expect((await scrollableBy(page)).across, where).toBeLessThanOrEqual(ROUNDING);
};

/** That the page is one screen, which is asked once there is room for two columns. */
const expectOneScreen = async (page: Page, where: string) => {
  await expectNoScrollAcross(page, where);

  expect((await scrollableBy(page)).down, where).toBeLessThanOrEqual(ROUNDING);
};

/**
 * The drawn board again, measured against the top of the page rather than the
 * top of the screen. The phone page scrolls, and a board measured from the
 * screen would come out somewhere else for that reason alone — where it is on
 * the page is what has to hold still.
 */
const boardOnThePage = async (page: Page) => {
  const drawn = await boardAt(page);
  const app = (await page.locator("main").boundingBox())!;

  return { width: drawn.width, height: drawn.height, x: drawn.x - app.x, y: drawn.y - app.y };
};

/**
 * The panel's own box. Unlike the board there is no drawing inside it to measure
 * instead: the panel is a column of blocks, so where the section came out is
 * where the panel is.
 */
const panelAt = async (page: Page) => {
  const panel = await page.getByTestId("panel").boundingBox();
  expect(panel).not.toBeNull();

  return panel!;
};

/**
 * That the panel stands below the board with the whole of it drawn, and that the
 * way to it is down the page and never across it — which is the one column's
 * layout in a sentence, and what the fold used to answer for.
 *
 * The setup is the last block in the panel, so a setup that is visible is the
 * whole of the panel drawn: nothing is behind a control, there being no control
 * left to be behind.
 */
const expectPanelBelowTheBoard = async (page: Page, where: string) => {
  const board = await boardAt(page);
  const panel = await panelAt(page);

  expect(panel.y, where).toBeGreaterThanOrEqual(board.y + board.height);
  expect(panel.x, where).toBe(0);
  await expect(page.getByTestId("setup"), where).toBeVisible();

  expect((await scrollableBy(page)).down, where).toBeGreaterThan(ROUNDING);
  await expectNoScrollAcross(page, where);
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
 * Every run of glyphs the page actually paints, and where it paints it. It is
 * measured with a range over the text itself rather than with the box of the
 * element holding it: boxes are allowed to sit on top of one another — a padded
 * one wrapping another is two boxes over the same pixels — and glyphs are not.
 *
 * What is said but not shown is left out, being nothing anybody can see on top
 * of anything else, and so is anything the stylesheet has hidden.
 */
type TextRun = { text: string; where: string; x: number; y: number; width: number; height: number };

const textRunsOn = (page: Page): Promise<TextRun[]> =>
  page.evaluate(() => {
    const runs: TextRun[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? "").trim();
      const holder = node.parentElement;
      if (!text || !holder || holder.closest(".visually-hidden")) continue;

      const style = getComputedStyle(holder);
      if (style.visibility === "hidden" || style.display === "none") continue;

      const range = document.createRange();
      range.selectNodeContents(node);

      for (const box of Array.from(range.getClientRects())) {
        if (box.width < 1 || box.height < 1) continue;
        runs.push({
          text: text.slice(0, 30),
          where: holder.className || holder.tagName.toLowerCase(),
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        });
      }
    }

    return runs;
  });

/**
 * The slack allowed between two runs of glyphs. Boxes that merely touch —
 * consecutive lines of a paragraph, a border between two of them — round into
 * one another by a pixel, and a pixel of that is arithmetic rather than one word
 * printed over another.
 */
const TOUCHING = 2;

/**
 * Every pair of glyph runs printed over one another, said in a sentence apiece:
 * the page has drawn one thing on top of another and a player is reading both at
 * once. Nought of them is the only acceptable number.
 */
const textOverTextOn = async (page: Page): Promise<string[]> => {
  const runs = await textRunsOn(page);
  const printedOver: string[] = [];

  for (const [i, a] of runs.entries())
    for (const b of runs.slice(i + 1)) {
      const across = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const down = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);

      if (across > TOUCHING && down > TOUCHING)
        printedOver.push(`"${a.text}" (${a.where}) over "${b.text}" (${b.where})`);
    }

  return printedOver;
};

/**
 * The columns the page is built out of, each asked whether what is in it fits
 * inside it. Neither of them scrolls, so a column shrunk below its own contents
 * does not clip them or offer them on a scrollbar: it goes on drawing them past
 * its own bottom edge and over whatever the page put below it, which is the
 * mechanism behind every overlap {@link textOverTextOn} can find. This is the
 * same fault read off the boxes rather than off the glyphs, and it is what says
 * which column let go.
 */
const spillingOn = (page: Page) =>
  page.evaluate(() =>
    [".app__play", ".panel"].flatMap((selector) => {
      const column = document.querySelector(selector);
      if (!(column instanceof HTMLElement)) return [];

      const past = column.scrollHeight - column.clientHeight;

      return past > 1 && getComputedStyle(column).overflowY === "visible"
        ? [`${selector} draws ${past}px past its own box`]
        : [];
    }),
  );

/**
 * That the page has drawn nothing on top of anything else — the whole of what a
 * player means by the screen looking wrong, in one assertion. The board is
 * exempt by construction: it is a drawing rather than text, and the only words
 * on it are the coordinates, which are inside it.
 */
const expectNothingOverAnything = async (page: Page, where: string) => {
  expect(await textOverTextOn(page), where).toEqual([]);
  expect(await spillingOn(page), where).toEqual([]);
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

  test("fills the width with the board and keeps it whole on the screen", async ({ page }) => {
    const screen = page.viewportSize()!;
    const board = await boardAt(page);

    expect(board.width).toBe(screen.width);
    expect(board.x).toBe(0);
    expect(board.y).toBeGreaterThanOrEqual(0);
    expect(board.y + board.height).toBeLessThanOrEqual(screen.height);

    await expectNoScrollAcross(page, "the board alone");
  });

  /**
   * The board is drawn at one size whatever the panel is doing, which is the
   * whole of the fix for the fault ADR-0007 was reversed for: run from the home
   * screen as a web app, a board redrawn at another size leaves the frame it was
   * drawn at before painted behind the new one. The stale paint reproduces in no
   * browser that can be driven, so what is held to here is the resize behind it —
   * with no resize there is nothing for the web view to keep.
   *
   * Switching teaching on is the largest thing the panel does now that it never
   * folds: the grade, the record and the summary all arrive under the board at
   * once. The board is measured on each side of it and has not moved.
   */
  test("draws the board at one size whatever the panel is doing", async ({ page }) => {
    const before = await boardOnThePage(page);

    await page.getByTestId("teaching-toggle").check();
    await expect(page.getByTestId("warning-toggle")).toBeVisible();

    expect(await boardOnThePage(page)).toEqual(before);
  });

  test("stands the panel below the board, with everything in it shown", async ({ page }) => {
    await expectPanelBelowTheBoard(page, "a phone");
  });

  /**
   * Whose turn it is, and the question a blunder is put back with, are what a
   * player has to answer to go on playing. Neither is in the panel, and neither
   * is scrolled to: a question nobody can see is a game that reads as stuck.
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
   * The screen a player would call broken: the panel drawn on top of the status
   * rather than below it, so that whose turn it is and how many pieces are in
   * hand are printed underneath it and both are unreadable.
   *
   * Nothing here shrinks to make room for anything else — the board is drawn from
   * the screen, the panel is as tall as what is in it, and the page grows. What
   * has to hold is that growing is all it does: a column shrunk below what is in
   * it does not scroll or clip, it simply keeps drawing, and what it draws lands
   * on whatever the page put below.
   *
   * Teaching on is the panel at its fullest — the grade, the record and the
   * summary are all under there — and so the hardest case for the room there is.
   */
  for (const teaching of [false, true])
    test(`draws nothing on top of anything else, teaching ${teaching ? "on" : "off"}`, async ({
      page,
    }) => {
      if (teaching) await page.getByTestId("teaching-toggle").check();

      await expectNothingOverAnything(page, `teaching ${teaching ? "on" : "off"}`);
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

  test("stands the panel beside the board rather than below it", async ({ page }) => {
    await page.goto("./");

    await expect(page.getByTestId("setup")).toBeVisible();

    const board = await boardAt(page);
    const panel = await panelAt(page);

    // Beside: the panel starts to the right of the board and shares its rows.
    expect(panel.x).toBeGreaterThanOrEqual(board.x + board.width);
    expect(panel.y).toBeLessThan(board.y + board.height);

    await expectOneScreen(page, "two columns");
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

    await expectNoScrollAcross(page, `${width}px`);

    // Every point is drawn at one radius, so one of them answers for all 24.
    const target = await targetAt(page, "a1");

    expect(target.width, `${width}px`).toBeGreaterThanOrEqual(FINGERTIP);
    expect(target.height, `${width}px`).toBeGreaterThanOrEqual(FINGERTIP);
  }
});

/**
 * Where the second column starts, which is the stylesheet's 60rem in the pixels a
 * viewport is set in. Below it there is one column, with the panel under the
 * board; above it the panel stands beside the board instead.
 */
const TWO_COLUMNS = 960;

/**
 * Every width with one column, asked at each of them what the fold used to
 * answer: the whole of the panel is drawn, below the board, and reached by
 * scrolling down the page. A width that quietly stopped having a panel under the
 * board fails here rather than being skipped past.
 */
test("shows the whole panel below the board at every one-column width", async ({ page }) => {
  await page.goto("./");

  for (const width of WIDTHS.filter((it) => it < TWO_COLUMNS)) {
    await page.setViewportSize({ width, height: 720 });

    await expectPanelBelowTheBoard(page, `${width}px`);
  }
});

/**
 * The board's drawn box is unchanged by anything the panel does, asked at every
 * one-column width rather than only at the phone's — the panel grows by a
 * different amount at each of them, and the board is what must not move by any of
 * it. Switching teaching on is the largest thing it does: the grade, the record
 * and the summary all arrive under the board at once.
 */
test("draws the board at one size while the panel grows, at every one-column width", async ({
  page,
}) => {
  await page.goto("./");

  const teaching = page.getByTestId("teaching-toggle");

  for (const width of WIDTHS.filter((it) => it < TWO_COLUMNS)) {
    await page.setViewportSize({ width, height: 720 });

    const before = await boardOnThePage(page);

    await teaching.check();
    await expect(page.getByTestId("warning-toggle")).toBeVisible();

    expect(await boardOnThePage(page), `${width}px`).toEqual(before);

    await teaching.uncheck();
  }
});

/**
 * A phone turned on its side is the screen the board's clamp is answered at from
 * the other end: a board as wide as this screen would be taller than it. What the
 * page must not do is meet that by drawing a board too small to play — so the
 * board comes out as tall as the screen, every target stays hittable, and the
 * page scrolls to the rest of itself instead.
 */
test.describe("on a phone turned on its side", () => {
  test.use({ viewport: LANDSCAPE, userAgent, deviceScaleFactor, isMobile, hasTouch });

  test("keeps the board playable and scrolls to what is left rather than shrinking it", async ({
    page,
  }) => {
    await page.goto("./");

    const screen = page.viewportSize()!;
    const board = await boardAt(page);
    const target = await targetAt(page, "a1");

    expect(board.width).toBeGreaterThanOrEqual(FINGERTIP * (BOARD_SIZE / STEP_ACROSS));
    expect(target.width).toBeGreaterThanOrEqual(FINGERTIP);
    expect(target.height).toBeGreaterThanOrEqual(FINGERTIP);

    // A board as wide as this screen would be taller than it: the clamp answers
    // that end as well, and the board is drawn no taller than the screen it is on.
    expect(board.height).toBeLessThanOrEqual(screen.height);

    // Sideways is the one direction that is never the answer, at any height.
    expect((await scrollableBy(page)).across).toBeLessThanOrEqual(ROUNDING);

    // Scrolling to what is left is the answer. Drawing it on top of the rest is not.
    await expectNothingOverAnything(page, "on its side");
  });

  /**
   * The panel stands below the board here too, on the screen with the least room
   * to stand it on: it is drawn under what is above it rather than over it, and
   * the page grows to hold it rather than anything shrinking to make way.
   *
   * Teaching on is the panel at its fullest, and on its side is the screen with
   * the least room for it: the two together are the hardest case the page meets.
   */
  for (const teaching of [false, true])
    test(`stands the panel below the board rather than out of it, teaching ${
      teaching ? "on" : "off"
    }`, async ({ page }) => {
      await page.goto("./");

      if (teaching) {
        await page.getByTestId("teaching-toggle").check();
        await expect(page.getByTestId("warning-toggle")).toBeVisible();
      }

      await expectPanelBelowTheBoard(page, "on its side");
      await expectNothingOverAnything(page, "the panel on its side");
    });
});
