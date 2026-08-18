import { describe, expect, it } from "vitest";

import { afterMove } from "../engine/game";
import { gameOf } from "../../tests/fixtures/games";
import { patternsIn } from "./patterns";

/**
 * A moving-phase game in which light has a mill to close: a1 and a4 are light's
 * and d7 can step along to a7. Neither side is anywhere near flying, and dark's
 * g1 and g4 sit on a line whose third point no dark piece can reach, so nothing
 * dark holds is about to become a mill.
 */
const MILL_TO_CLOSE = gameOf({
  light: ["a1", "a4", "d7", "c3"],
  dark: ["g1", "g4", "f2", "b6"],
  sideToMove: "light",
});

describe("closing a mill", () => {
  it("is seen in the move that closes one", () => {
    expect(patternsIn(MILL_TO_CLOSE, { from: "d7", to: "a7", capture: "f2" })).toContain(
      "mill-closed",
    );
  });

  it("is not seen in a move that lands somewhere else", () => {
    expect(patternsIn(MILL_TO_CLOSE, { from: "d7", to: "g7" })).not.toContain("mill-closed");
  });
});

describe("missing a mill", () => {
  it("is seen when a mill was there to be closed and the move closed none", () => {
    expect(patternsIn(MILL_TO_CLOSE, { from: "d7", to: "g7" })).toContain("mill-missed");
  });

  it("is not seen in the move that closes the mill", () => {
    expect(patternsIn(MILL_TO_CLOSE, { from: "d7", to: "a7", capture: "f2" })).not.toContain(
      "mill-missed",
    );
  });
});

/**
 * Dark holds b2 and f2 and its d3 can step up to d2, which would close
 * b2-d2-f2. Light's d1 can take that point first. Nothing light holds is one
 * move from a mill of its own, so the only thing to see here is the block.
 */
const MILL_TO_BLOCK = gameOf({
  light: ["d1", "a1", "a4", "b4"],
  dark: ["b2", "f2", "d3", "g7"],
  sideToMove: "light",
});

/**
 * Dark holds c3 and e3 with d3 empty between them, but every dark piece that
 * could reach d3 stands on the line itself — and a piece sliding along its own
 * line takes its place away with it. So this is a shape rather than a threat,
 * and standing on d3 blocks nothing that was going to happen.
 */
const MILL_THAT_CANNOT_BE_CLOSED = gameOf({
  light: ["a1", "a4", "b4", "d2"],
  dark: ["c3", "e3", "g1", "g7"],
  sideToMove: "light",
});

describe("blocking the opponent's mill", () => {
  it("is seen when the move takes the point the mill was to be closed on", () => {
    expect(patternsIn(MILL_TO_BLOCK, { from: "d1", to: "d2" })).toContain("mill-blocked");
  });

  it("is not seen when the move lands somewhere else", () => {
    expect(patternsIn(MILL_TO_BLOCK, { from: "d1", to: "g1" })).not.toContain("mill-blocked");
  });

  it("is not seen when the opponent could not have closed it next move", () => {
    expect(patternsIn(MILL_THAT_CANNOT_BE_CLOSED, { from: "d2", to: "d3" })).not.toContain(
      "mill-blocked",
    );
  });
});

/**
 * A placing-phase game in which light's b2 and d1 both lie one point away from
 * d2: putting a piece there leaves it standing on two potential mills at once,
 * and dark can block only one of them.
 */
const FORK_TO_BUILD = gameOf({
  light: ["b2", "d1"],
  dark: ["g1", "g7"],
  sideToMove: "light",
  piecesInHand: { light: 7, dark: 7 },
});

describe("building a fork", () => {
  it("is seen when the move leaves a piece on two potential mills at once", () => {
    expect(patternsIn(FORK_TO_BUILD, { to: "d2" })).toContain("fork-created");
  });

  it("is not seen when the move leaves it on only one", () => {
    expect(patternsIn(FORK_TO_BUILD, { to: "f2" })).not.toContain("fork-created");
  });
});

/**
 * Light's d1 is the only thing keeping dark's d2 and d3 off d1-d2-d3, and dark's
 * b2 and d2 already hold two points of b2-d2-f2. Move d1 away and d2 stands on
 * two potential mills at once, both of which dark can fill next move: g1 steps
 * into d1, f4 steps into f2. That is a fork light handed over by moving, which
 * is the one way a player can give the opponent one.
 */
const FORK_TO_HAND_OVER = gameOf({
  light: ["d1", "a4", "c5", "e5"],
  dark: ["b2", "d2", "d3", "f4", "g1"],
  sideToMove: "light",
});

/**
 * The same shape and none of the threat: d2 stands on two potential mills, but
 * every dark piece that could fill either of them is already on the line it
 * would fill — and a piece sliding along its own line takes its place away with
 * it. Dark has no mill-closing move at all here, so nothing was handed over.
 */
const FORK_THAT_THREATENS_NOTHING = gameOf({
  light: ["f2", "a1", "a4", "c5"],
  dark: ["b2", "d2", "d3", "g7"],
  sideToMove: "light",
});

describe("handing the opponent a fork", () => {
  it("is seen when the move leaves the opponent with one it did not have", () => {
    expect(patternsIn(FORK_TO_HAND_OVER, { from: "d1", to: "a1" })).toContain("fork-handed");
  });

  it("is not seen when the move leaves the opponent with none", () => {
    expect(patternsIn(FORK_TO_HAND_OVER, { from: "a4", to: "b4" })).not.toContain("fork-handed");
  });

  /**
   * The glossary defines a fork by what it does — two potential mills sharing a
   * piece, so the opponent can only block one of them. A pair of lines neither
   * side can fill leaves nobody with anything to block, so it is a shape and not
   * a kettős fenyegetés. `fork-created` reads the same question of the mover.
   */
  it("is not seen where the opponent could fill neither of the two lines", () => {
    expect(patternsIn(FORK_THAT_THREATENS_NOTHING, { from: "f2", to: "f4" })).not.toContain(
      "fork-handed",
    );
  });
});

/**
 * The same mill as {@link MILL_TO_CLOSE}, but with a fifth dark piece so that the
 * capture it earns does not put dark down to the three that fly. Light's a4 can
 * step out to b4 and back again, and no dark piece stands next to it — which is
 * a csikicsuki.
 */
const CSIKICSUKI_TO_OPEN = gameOf({
  light: ["a1", "a4", "d7", "c3"],
  dark: ["g1", "g4", "f2", "b6", "e5"],
  sideToMove: "light",
});

describe("opening a csikicsuki", () => {
  it("is seen when the mill it closes can be stepped out of and back into", () => {
    expect(patternsIn(CSIKICSUKI_TO_OPEN, { from: "d7", to: "a7", capture: "f2" })).toContain(
      "running-mill-opened",
    );
  });

  it("is not seen when the move closes no mill at all", () => {
    expect(patternsIn(CSIKICSUKI_TO_OPEN, { from: "d7", to: "g7" })).not.toContain(
      "running-mill-opened",
    );
  });

  /**
   * A mill stepped back into is a mill the side did not have a moment ago, and
   * the board cannot tell that swing from a mill closed for the first time — so
   * the pattern fires on every swing, and the sentence it is worded with says
   * that a csikicsuki is there rather than that the player has just opened one.
   */
  it("is seen again on the step back in, which is the csikicsuki being run", () => {
    const steppedOut = afterMove(MILL_TO_RUN, { from: "a4", to: "b4" });
    const darkAnswered = afterMove(steppedOut, { from: "f2", to: "f4" });

    expect(patternsIn(darkAnswered, { from: "b4", to: "a4", capture: "c5" })).toContain(
      "running-mill-opened",
    );
  });

  /**
   * A side down to three pieces jumps to any empty point, so it can always take
   * the point the mill was stepped out of. There is nothing to run, and saying
   * otherwise would teach the learner a shape that does not work.
   */
  it("is not seen when the capture leaves the opponent flying", () => {
    expect(patternsIn(MILL_TO_CLOSE, { from: "d7", to: "a7", capture: "f2" })).not.toContain(
      "running-mill-opened",
    );
  });
});

describe("taking an intersection", () => {
  it("is seen when the move lands on one of the four points with four neighbours", () => {
    expect(patternsIn(FORK_TO_BUILD, { to: "d2" })).toContain("intersection-taken");
  });

  it("is not seen when the move lands anywhere else", () => {
    expect(patternsIn(FORK_TO_BUILD, { to: "f2" })).not.toContain("intersection-taken");
  });
});

/**
 * Light stands on fifteen of the sixteen lines, and e4-f4-g4 is the last one
 * dark could still fill. Light's f2 steps to f4 and dark has nowhere left on the
 * board to build a mill.
 */
const LAST_LINE_OPEN_TO_DARK = gameOf({
  light: ["a1", "c3", "e5", "g7", "d2", "d6", "b4", "f2"],
  dark: ["g1", "g4", "f6"],
  sideToMove: "light",
});

describe("leaving the opponent unable to build a mill", () => {
  it("is seen when the move takes the last line the opponent could have filled", () => {
    expect(patternsIn(LAST_LINE_OPEN_TO_DARK, { from: "f2", to: "f4" })).toContain(
      "opponent-mill-less",
    );
  });

  it("is not seen when the move leaves a line open — or opens another", () => {
    expect(patternsIn(LAST_LINE_OPEN_TO_DARK, { from: "b4", to: "c4" })).not.toContain(
      "opponent-mill-less",
    );
  });
});

/**
 * Dark threatens two mills at once — d3 can step to d2, and d7 to g7 — and light
 * can reach neither g7 nor a mill of its own. Whatever light plays, dark closes
 * one of them, so nothing light did let anything through.
 */
const MILL_THAT_CANNOT_BE_STOPPED = gameOf({
  light: ["d1", "a1", "a4", "b4"],
  dark: ["b2", "f2", "d3", "g1", "g4", "d7"],
  sideToMove: "light",
});

describe("letting the opponent's mill through", () => {
  it("is seen when the opponent can close one and another move would have stopped it", () => {
    expect(patternsIn(MILL_TO_BLOCK, { from: "d1", to: "g1" })).toContain("mill-let-through");
  });

  it("is not seen when the move stops it", () => {
    expect(patternsIn(MILL_TO_BLOCK, { from: "d1", to: "d2" })).not.toContain("mill-let-through");
  });

  it("is not seen when no move would have stopped it", () => {
    expect(patternsIn(MILL_THAT_CANNOT_BE_STOPPED, { from: "d1", to: "d2" })).not.toContain(
      "mill-let-through",
    );
  });
});

/**
 * Light holds the mill d1-d2-d3 and dark's f2 stands next to the middle of it.
 * Step d2 out and dark takes the point it left, so the mill is gone rather than
 * swung.
 */
const MILL_TO_BREAK = gameOf({
  light: ["d1", "d2", "d3", "a7"],
  dark: ["f2", "g1", "g4", "c5"],
  sideToMove: "light",
});

/**
 * Light holds the mill a1-a4-a7, and a4's only way out is b4. No dark piece can
 * follow it there or into the point it leaves, so stepping out is a csikicsuki
 * and not a mill thrown away.
 */
const MILL_TO_RUN = gameOf({
  light: ["a1", "a4", "a7", "d5"],
  dark: ["g1", "g4", "f2", "c5", "e5"],
  sideToMove: "light",
});

describe("breaking a mill for nothing", () => {
  it("is seen when the piece cannot step back and the move gained nothing", () => {
    expect(patternsIn(MILL_TO_BREAK, { from: "d2", to: "b2" })).toContain(
      "mill-broken-for-nothing",
    );
  });

  it("is not seen when the piece can step back into the mill next move", () => {
    expect(patternsIn(MILL_TO_RUN, { from: "a4", to: "b4" })).not.toContain(
      "mill-broken-for-nothing",
    );
  });

  it("is not seen when the piece did not come out of a mill at all", () => {
    expect(patternsIn(MILL_TO_BREAK, { from: "a7", to: "d7" })).not.toContain(
      "mill-broken-for-nothing",
    );
  });
});

/**
 * Light's d1 has two points it could go to. a1 has dark's a4 on one side and
 * nothing but d1 on the other, so dark's g1 steps into d1 and the piece is shut
 * in; d2 has four ways out and dark cannot take them in one move.
 */
const PIECE_TO_SHUT_IN = gameOf({
  light: ["d1", "c3", "e5", "d5"],
  dark: ["a4", "g1", "f2", "b6"],
  sideToMove: "light",
});

describe("leaving a piece where it can be shut in", () => {
  it("is seen when the opponent's next move takes the piece's last way out", () => {
    expect(patternsIn(PIECE_TO_SHUT_IN, { from: "d1", to: "a1" })).toContain(
      "piece-left-blockable",
    );
  });

  it("is not seen when no single reply can shut it in", () => {
    expect(patternsIn(PIECE_TO_SHUT_IN, { from: "d1", to: "d2" })).not.toContain(
      "piece-left-blockable",
    );
  });
});

/**
 * Light closes a1-a4-a7 and earns a capture, while dark's d3 is one step from
 * closing b2-d2-f2. Taking g7 leaves that mill standing; taking b2 takes it
 * apart. Which piece comes off is the decision the pattern is about.
 */
const CAPTURE_TO_CHOOSE = gameOf({
  light: ["a1", "a4", "d7", "c3"],
  dark: ["b2", "f2", "d3", "g7"],
  sideToMove: "light",
});

describe("capturing the wrong piece", () => {
  it("is seen when another piece the mill could have taken would have stopped one", () => {
    expect(patternsIn(CAPTURE_TO_CHOOSE, { from: "d7", to: "a7", capture: "g7" })).toContain(
      "wrong-piece-captured",
    );
  });

  it("is not seen when the piece taken is the one that stops it", () => {
    expect(patternsIn(CAPTURE_TO_CHOOSE, { from: "d7", to: "a7", capture: "b2" })).not.toContain(
      "wrong-piece-captured",
    );
  });
});
