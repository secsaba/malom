import { type Page, expect, test } from "@playwright/test";

import { evaluate } from "../../src/ai/evaluation";
import type { PointId } from "../../src/engine/board";
import { type Game, type Move, afterMove, legalMovesOf } from "../../src/engine/game";
import type { Side } from "../../src/engine/position";
import { DEFAULT_DIFFICULTY, DIFFICULTIES, type Difficulty } from "../../src/opponent/difficulty";
import { strings } from "../../src/strings";
import { gameOf } from "../fixtures/games";
import { pointAt, tap } from "./board";

/**
 * Start a game against the computer, with the player on this side and the
 * computer at this difficulty. The difficulty is chosen before the game rather
 * than as part of starting it: it is a setting, and it applies to the game in
 * progress as much as to the next one.
 */
const startAgainstTheComputer = async (page: Page, humanSide: Side, difficulty: Difficulty) => {
  await page.getByTestId(`difficulty-${difficulty}`).check();
  await page.getByTestId("against-computer").check();
  await page.getByTestId(`side-${humanSide}`).check();
  await page.getByTestId("start").click();
};

/** The pieces on the board, and the pieces still in hand, as the interface shows them. */
const gameOn = async (page: Page, sideToMove: Side): Promise<Game> => {
  const occupants = await page
    .getByTestId("point")
    .evaluateAll((circles) =>
      circles.map(
        (circle) =>
          [circle.getAttribute("data-point"), circle.getAttribute("data-occupant")] as const,
      ),
    );

  const held = (side: Side) =>
    occupants.filter(([, occupant]) => occupant === side).map(([point]) => point as PointId);

  const inHand = async (side: Side) =>
    Number(await page.getByTestId("in-hand").and(page.locator(`[data-side="${side}"]`)).innerText());

  return gameOf({
    light: held("light"),
    dark: held("dark"),
    sideToMove,
    piecesInHand: { light: await inHand("light"), dark: await inHand("dark") },
  });
};

/**
 * The move that leaves the player worst off: the one the position it hands over
 * likes best, judged from the side about to receive it. A player who plays this
 * every turn hands their pieces away, and an opponent worth the name takes them.
 *
 * It makes the game a short one and, more to the point, one nothing has to be
 * written down for: the line the computer answers with is its own business, and
 * the test works out its next move from the board rather than from a script that
 * would go stale the moment the evaluation was tuned.
 */
const worstMove = (game: Game): Move => {
  const played = legalMovesOf(game).map((move) => ({
    move,
    handedOver: evaluate(afterMove(game, move)),
  }));

  const worst = [...played].sort((one, other) => other.handedOver - one.handedOver)[0];
  if (!worst) throw new Error("the player has nothing to play");

  return worst.move;
};

/** Play a whole move: the piece is picked up where it stands, put down, and takes what it earned. */
const play = async (page: Page, move: Move) => {
  if (move.from) await tap(page, move.from);
  await tap(page, move.to);
  if (move.capture) await tap(page, move.capture);
};

/** The computer has answered — or has ended the game by answering. */
const answered = async (page: Page, humanSide: Side) => {
  const thinkingOrOver = page.getByTestId("thinking").or(page.getByTestId("result"));
  await expect(thinkingOrOver).toHaveCount(1);

  const playersTurnOrOver = page
    .getByTestId("result")
    .or(page.getByTestId("side-to-move").filter({ hasText: strings.game.toMove[humanSide] }));
  await expect(playersTurnOrOver).toHaveCount(1, { timeout: 30_000 });
};

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("starts a game against the computer with the player on light", async ({ page }) => {
  await expect(page.getByTestId("side-light")).toHaveCount(0); // not asked of two people

  await page.getByTestId("against-computer").check();

  await expect(page.getByTestId("side-light")).toBeChecked();
  await expect(page.getByTestId("side-dark")).not.toBeChecked();

  await page.getByTestId("start").click();

  await expect(page.getByTestId("side-to-move")).toHaveText(strings.game.toMove.light);
  await expect(page.getByTestId("thinking")).toHaveCount(0); // the player opens

  await tap(page, "a1");

  await expect(pointAt(page, "a1")).toHaveAttribute("data-occupant", "light");
  await expect(page.getByTestId("thinking")).toBeVisible();
});

test("opens the game itself when the player takes dark", async ({ page }) => {
  await startAgainstTheComputer(page, "dark", DEFAULT_DIFFICULTY);

  await expect(page.getByTestId("thinking")).toBeVisible();

  await answered(page, "dark");

  await expect(page.locator("[data-point][data-occupant='light']")).toHaveCount(1);
  await expect(page.getByTestId("thinking")).toHaveCount(0);
});

test("leaves the interface working while it thinks, and the board unplayable", async ({ page }) => {
  await startAgainstTheComputer(page, "light", DEFAULT_DIFFICULTY);
  await tap(page, "a1");

  await expect(page.getByTestId("thinking")).toBeVisible();

  // The search is off the thread, so the page answers while it runs.
  await page.getByTestId("coordinates-toggle").check();
  await expect(page.getByTestId("coordinates")).toBeVisible();

  // The computer's turn is not the player's to take: nothing on the board is theirs to act on.
  await expect(page.locator("[data-point][data-legal]")).toHaveCount(0);

  await answered(page, "light");

  await expect(page.locator("[data-point][data-legal]")).not.toHaveCount(0);
});

test("brings the piece it moved in from where it came", async ({ page }) => {
  await startAgainstTheComputer(page, "dark", DEFAULT_DIFFICULTY);
  await answered(page, "dark");

  await expect(page.locator("[data-point][data-arrived='placed']")).toHaveCount(1);
});

test("offers the four difficulties, starting at the one a new player meets", async ({ page }) => {
  for (const difficulty of DIFFICULTIES) {
    await expect(page.getByTestId(`difficulty-${difficulty}`)).toHaveCount(1);
  }

  await expect(page.getByTestId("difficulty")).toContainText(strings.difficulty.legend);
  await expect(page.getByTestId(`difficulty-${DEFAULT_DIFFICULTY}`)).toBeChecked();
});

test("changes difficulty without giving up the game in progress", async ({ page }) => {
  await startAgainstTheComputer(page, "light", "beginner");

  await tap(page, "a1");
  await answered(page, "light");

  await expect(page.locator("[data-point][data-occupant]")).toHaveCount(2);

  await page.getByTestId("difficulty-master").check();

  // The change is visible, and the game is exactly where it was left.
  await expect(page.getByTestId("difficulty-master")).toBeChecked();
  await expect(page.getByTestId(`difficulty-${DEFAULT_DIFFICULTY}`)).not.toBeChecked();
  await expect(pointAt(page, "a1")).toHaveAttribute("data-occupant", "light");
  await expect(page.locator("[data-point][data-occupant]")).toHaveCount(2);
  await expect(page.getByTestId("result")).toHaveCount(0);
  await expect(page.getByTestId("side-to-move")).toHaveText(strings.game.toMove.light);

  // And it carries on from there, with the stronger opponent answering.
  await tap(page, "g7");
  await answered(page, "light");

  await expect(page.locator("[data-point][data-occupant]")).toHaveCount(4);
});

test("plays a whole game, and offers the sides the other way round afterwards", async ({ page }) => {
  test.setTimeout(180_000);
  const result = page.getByTestId("result");

  // At Mester: the strongest opponent there is, and the one that answers the
  // same way twice, so what the game turns on is the player throwing it away.
  await startAgainstTheComputer(page, "light", "master");

  // The player throws the game away a move at a time; the computer takes it.
  for (let move = 0; move < 60 && (await result.count()) === 0; move += 1) {
    await play(page, worstMove(await gameOn(page, "light")));
    await answered(page, "light");
  }

  await expect(result).toHaveText(strings.game.result.winner.dark);

  // Which of the two endings light is left in is the search's own business, so
  // all that is asked here is that light is the side left in one.
  await expect(page.getByTestId("ending")).toContainText(strings.game.side.light);

  await page.getByTestId("rematch").click();

  await expect(page.getByTestId("side-dark")).toBeChecked(); // the player takes the other side
  await expect(result).toHaveCount(0);
  await expect(page.getByTestId("thinking")).toBeVisible();

  await answered(page, "dark");

  await expect(page.locator("[data-point][data-occupant]")).toHaveCount(1);
});
