import { type Page, expect, test } from "@playwright/test";

import { pointAt, tap } from "./board";
import { strings } from "./strings";

/**
 * A capture used to be the one thing that happened on the board and left no mark
 * on it: the piece that moved arrives and keeps a ring, and the piece it took
 * simply stopped being drawn. This is the acceptance for ADR-0008 — that it now
 * leaves two marks, and that neither of them is an animation.
 */

/** The outline left where a piece was taken from, whichever point that was. */
const ghosts = (page: Page) => page.getByTestId("ghosts").locator("circle");

/**
 * The pieces lying in one side's heap in the middle of the board. Scoped to the
 * heaps: a captured piece and the outline left where it was captured from are
 * both marks about a captured piece of that side, and both say so.
 */
const heap = (page: Page, side: "light" | "dark") =>
  page.getByTestId("heaps").locator(`circle[data-captured="${side}"]`);

/**
 * Five placements that close light's a1-d1-g1 mill, leaving dark with a piece on
 * a7 and one on d7 for it to take. Two of dark's are placed rather than one so
 * that taking either of them leaves the other on the board.
 */
const MILL_CLOSED = ["a1", "a7", "d1", "d7", "g1"] as const;

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("leaves the middle of the board empty until a piece is taken", async ({ page }) => {
  await expect(page.getByTestId("heaps")).toBeVisible(); // the two racks are always drawn
  await expect(heap(page, "light")).toHaveCount(0);
  await expect(heap(page, "dark")).toHaveCount(0);
  await expect(ghosts(page)).toHaveCount(0);
});

test("marks the point a piece was taken from and lays the piece in its own heap", async ({
  page,
}) => {
  await tap(page, ...MILL_CLOSED);

  // Nothing has been taken yet: a capture is owed, which is not the same thing.
  await expect(page.getByTestId("capture-prompt")).toBeVisible();
  await expect(ghosts(page)).toHaveCount(0);

  await tap(page, "a7");

  // The point is empty, and says so — and carries the outline of what stood on it.
  await expect(pointAt(page, "a7")).not.toHaveAttribute("data-occupant", /.*/);
  await expect(ghosts(page)).toHaveCount(1);
  await expect(page.locator('[data-ghost="a7"][data-captured="dark"]')).toHaveCount(1);

  // The piece lies in the heap of the side that lost it, and never the other.
  await expect(heap(page, "dark")).toHaveCount(1);
  await expect(heap(page, "light")).toHaveCount(0);
});

test("says the capture out loud, which is what the board could only show", async ({ page }) => {
  await tap(page, ...MILL_CLOSED);

  await expect(page.getByTestId("captured")).toHaveCount(0);

  await tap(page, "a7");

  const said = page.getByTestId("captured");
  await expect(said).toContainText(strings.game.captured.dark);
  // The coordinate is notation rather than language, so it is read as written.
  await expect(said).toContainText("a7");

  // And the point itself says it too, to a player who has arrived on it.
  await expect(page.locator('[data-target="a7"]')).toHaveAttribute(
    "aria-label",
    new RegExp(strings.board.point.captured.dark, "u"),
  );
});

test("forgets the capture when the next move is played, as it forgets the move", async ({
  page,
}) => {
  await tap(page, ...MILL_CLOSED, "a7");

  await expect(ghosts(page)).toHaveCount(1);

  await tap(page, "b2"); // dark places, and the mark about light's move goes with it

  await expect(ghosts(page)).toHaveCount(0);
  await expect(page.getByTestId("captured")).toHaveCount(0);

  // The heap is not a mark about one move, so it keeps what it was given.
  await expect(heap(page, "dark")).toHaveCount(1);
});

test("brings the taken piece to its heap, and leaves both marks for a player who asked for no movement", async ({
  page,
}) => {
  await tap(page, ...MILL_CLOSED, "a7");

  // It travels from the point it was taken from, in the board's own units.
  const travelled = await heap(page, "dark").first().evaluate((element) => ({
    animation: getComputedStyle(element).animationName,
    from: element.getAttribute("style"),
  }));

  expect(travelled.animation).toBe("piece-captured");
  expect(travelled.from).toContain("--arrived-x");

  await page.emulateMedia({ reducedMotion: "reduce" });

  const still = await heap(page, "dark")
    .first()
    .evaluate((element) => getComputedStyle(element).animationName);

  expect(still).toBe("none");
  await expect(ghosts(page)).toHaveCount(1);
  await expect(heap(page, "dark")).toHaveCount(1);
});

test("rewinds the heaps and the mark with the board when a move is looked back at", async ({
  page,
}) => {
  await page.getByLabel(strings.teaching.toggle).check();
  await tap(page, ...MILL_CLOSED, "a7", "b2");

  await expect(heap(page, "dark")).toHaveCount(1);
  await expect(ghosts(page)).toHaveCount(0);

  // The move light closed its mill with, which is the move that took the piece.
  await page.getByTestId("played-move").nth(4).click();

  await expect(pointAt(page, "b2")).not.toHaveAttribute("data-occupant", /.*/);
  await expect(heap(page, "dark")).toHaveCount(1);
  await expect(ghosts(page)).toHaveCount(1);

  // And the move before it, which took nothing: the heaps are empty again.
  await page.getByTestId("played-move").nth(3).click();

  await expect(heap(page, "dark")).toHaveCount(0);
  await expect(ghosts(page)).toHaveCount(0);

  await page.getByTestId("back-to-play").click();

  await expect(heap(page, "dark")).toHaveCount(1);
});
