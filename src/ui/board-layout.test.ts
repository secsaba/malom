import { describe, expect, it } from "vitest";

import { FILES, LINES, POINTS, RANKS, fileOf, rankOf } from "../engine/board";
import { SIDES } from "../engine/position";
import {
  BOARD_SIZE,
  COORDINATE_LABELS,
  GHOST_RADIUS,
  HINT_RADIUS,
  LAST_MOVE_RADIUS,
  LINE_SEGMENTS,
  MOST_CAPTURED,
  PIECE_RADIUS,
  POINT_RADIUS,
  FOCUS_SIZE,
  TARGET_RADIUS,
  CAPTURED_PIECE_RADIUS,
  centreOf,
  rackFor,
  capturedPieceAt,
} from "./board-layout";

describe("point positions", () => {
  it("puts the corners of the outer square at the corners of the board", () => {
    expect(centreOf("a1")).toEqual({ x: 60, y: 660 });
    expect(centreOf("g1")).toEqual({ x: 660, y: 660 });
    expect(centreOf("a7")).toEqual({ x: 60, y: 60 });
    expect(centreOf("g7")).toEqual({ x: 660, y: 60 });
  });

  it("runs files left to right and ranks bottom to top", () => {
    for (const point of POINTS) {
      for (const other of POINTS) {
        if (fileOf(point) < fileOf(other)) {
          expect(centreOf(point).x).toBeLessThan(centreOf(other).x);
        }
        if (rankOf(point) < rankOf(other)) {
          expect(centreOf(point).y).toBeGreaterThan(centreOf(other).y);
        }
      }
    }
  });

  it("keeps every point inside the board", () => {
    for (const point of POINTS) {
      const { x, y } = centreOf(point);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(BOARD_SIZE);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(BOARD_SIZE);
    }
  });

  it("gives no two points the same position", () => {
    const seen = POINTS.map((point) => {
      const { x, y } = centreOf(point);
      return `${x},${y}`;
    });
    expect(new Set(seen).size).toBe(POINTS.length);
  });
});

describe("line segments", () => {
  it("draws one per line", () => {
    expect(LINE_SEGMENTS).toHaveLength(LINES.length);
    expect(LINE_SEGMENTS.map((segment) => segment.line)).toEqual([...LINES]);
  });

  it("spans each line from its first point to its last", () => {
    for (const { line, from, to } of LINE_SEGMENTS) {
      expect(from).toEqual(centreOf(line[0]));
      expect(to).toEqual(centreOf(line[2]));
    }
  });

  it("passes through the middle point of every line", () => {
    for (const { line, from, to } of LINE_SEGMENTS) {
      const middle = centreOf(line[1]);
      expect(middle.x).toBe((from.x + to.x) / 2);
      expect(middle.y).toBe((from.y + to.y) / 2);
    }
  });
});

/** How close together the two nearest points on the board are. */
const closestPoints = Math.min(
  ...POINTS.flatMap((point) =>
    POINTS.filter((other) => other !== point).map((other) => {
      const here = centreOf(point);
      const there = centreOf(other);
      return Math.hypot(here.x - there.x, here.y - there.y);
    }),
  ),
);

describe("the ring a hint is marked with", () => {
  it("goes round the outside of whatever stands on the point", () => {
    expect(HINT_RADIUS).toBeGreaterThan(PIECE_RADIUS);
  });

  it("stays clear of the point next door, so two hinted points read as two", () => {
    expect(HINT_RADIUS * 2).toBeLessThan(closestPoints);
  });
});

describe("the circle that takes a tap", () => {
  it("reaches wider than the piece standing on the point, so a fingertip can miss", () => {
    expect(TARGET_RADIUS).toBeGreaterThan(PIECE_RADIUS);
  });

  it("takes no tap meant for the point next door", () => {
    expect(TARGET_RADIUS * 2).toBeLessThanOrEqual(closestPoints);
  });
});

describe("the square the keyboard is marked with", () => {
  it("goes round the outside of every ring the game leaves on a point", () => {
    expect(FOCUS_SIZE / 2).toBeGreaterThan(HINT_RADIUS);
  });

  it("meets the square its neighbour would draw rather than overlapping it", () => {
    expect(FOCUS_SIZE).toBeLessThanOrEqual(closestPoints);
  });
});

describe("the ring the last move is marked with", () => {
  it("sits inside the piece it marks, where nothing else on the board is drawn", () => {
    expect(LAST_MOVE_RADIUS).toBeLessThan(PIECE_RADIUS);
    expect(LAST_MOVE_RADIUS).toBeLessThan(POINT_RADIUS);
  });
});

describe("coordinate labels", () => {
  const labelled = (text: string) => COORDINATE_LABELS.filter((label) => label.text === text);

  it("labels all seven files and all seven ranks, once each", () => {
    expect(COORDINATE_LABELS).toHaveLength(FILES.length + RANKS.length);
    for (const file of FILES) expect(labelled(file)).toHaveLength(1);
    for (const rank of RANKS) expect(labelled(String(rank))).toHaveLength(1);
  });

  it("lines each file label up under its file, and each rank label up with its rank", () => {
    for (const point of POINTS) {
      const [file] = labelled(fileOf(point));
      const [rank] = labelled(String(rankOf(point)));
      expect(file?.x).toBe(centreOf(point).x);
      expect(rank?.y).toBe(centreOf(point).y);
    }
  });

  it("sits outside the board, below it and to its left", () => {
    const points = POINTS.map(centreOf);
    const bottom = Math.max(...points.map((position) => position.y));
    const left = Math.min(...points.map((position) => position.x));

    for (const file of FILES) {
      const [label] = labelled(file);
      expect(label?.y).toBeGreaterThan(bottom);
      expect(label?.y).toBeLessThan(BOARD_SIZE);
    }
    for (const rank of RANKS) {
      const [label] = labelled(String(rank));
      expect(label?.x).toBeLessThan(left);
      expect(label?.x).toBeGreaterThan(0);
    }
  });
});

describe("the outline left where a piece was taken", () => {
  it("is drawn at a radius nothing else on the board is", () => {
    for (const other of [POINT_RADIUS, PIECE_RADIUS, HINT_RADIUS, LAST_MOVE_RADIUS]) {
      expect(GHOST_RADIUS).not.toBe(other);
    }
  });

  // The point's own dot is drawn inside it and the piece that could land here is
  // drawn outside it, so the outline is neither of them said again.
  it("stands clear of the empty point inside it and of the piece that would land on it", () => {
    expect(GHOST_RADIUS).toBeGreaterThan(POINT_RADIUS);
    expect(GHOST_RADIUS).toBeLessThan(PIECE_RADIUS);
  });
});

describe("the heaps the captured pieces lie in", () => {
  /** The eight points around the hole in the middle, which are the heaps' neighbours. */
  const INNER = ["c3", "d3", "e3", "c4", "e4", "c5", "d5", "e5"] as const;

  const apart = (one: { x: number; y: number }, other: { x: number; y: number }) =>
    Math.hypot(one.x - other.x, one.y - other.y);

  it("holds every piece a side can lose, which is seven of its nine", () => {
    expect(MOST_CAPTURED).toBe(7);
  });

  // The whole reason the middle of the board can be spent on this: a full heap
  // still touches nothing being played. A captured piece that overlapped a piece would
  // be the board saying two things about one circle.
  it("never touches a piece standing on the board, even with both heaps full", () => {
    for (const side of SIDES) {
      for (let nth = 0; nth < MOST_CAPTURED; nth += 1) {
        for (const point of INNER) {
          expect(apart(capturedPieceAt(side, nth), centreOf(point)), `${side} ${nth} by ${point}`)
            .toBeGreaterThanOrEqual(PIECE_RADIUS + CAPTURED_PIECE_RADIUS);
        }
      }
    }
  });

  it("gives each side its own side of the middle line, and never the other's", () => {
    const middle = BOARD_SIZE / 2;

    for (let nth = 0; nth < MOST_CAPTURED; nth += 1) {
      expect(capturedPieceAt("light", nth).y).toBeLessThan(middle);
      expect(capturedPieceAt("dark", nth).y).toBeGreaterThan(middle);
    }
  });

  // A heap grows; it does not rearrange itself. A piece that shifted once
  // another landed beside it would be a board moving under a player's eyes.
  it("keeps every slot where it is however many pieces are in the heap", () => {
    for (const side of SIDES) {
      const first = capturedPieceAt(side, 0);

      for (let nth = 1; nth < MOST_CAPTURED; nth += 1) {
        expect(capturedPieceAt(side, nth).x).toBeGreaterThan(capturedPieceAt(side, nth - 1).x);
        expect(capturedPieceAt(side, nth).y).toBe(first.y);
      }
    }
  });

  it("overlaps one piece with the next, so a heap reads as a pile and not as a row", () => {
    for (const side of SIDES) {
      expect(apart(capturedPieceAt(side, 0), capturedPieceAt(side, 1))).toBeLessThan(2 * CAPTURED_PIECE_RADIUS);
    }
  });

  it("lays a rack under each heap that holds all seven and no more", () => {
    for (const side of SIDES) {
      const rack = rackFor(side);
      const first = capturedPieceAt(side, 0);
      const last = capturedPieceAt(side, MOST_CAPTURED - 1);

      expect(rack.x).toBeLessThan(first.x - CAPTURED_PIECE_RADIUS);
      expect(rack.x + rack.width).toBeGreaterThan(last.x + CAPTURED_PIECE_RADIUS);
      expect(rack.y).toBeLessThan(first.y - CAPTURED_PIECE_RADIUS);
      expect(rack.y + rack.height).toBeGreaterThan(first.y + CAPTURED_PIECE_RADIUS);
    }
  });

  it("keeps the two racks clear of each other", () => {
    const light = rackFor("light");
    const dark = rackFor("dark");

    expect(light.y + light.height).toBeLessThan(dark.y);
  });
});
