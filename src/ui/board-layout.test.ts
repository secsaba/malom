import { describe, expect, it } from "vitest";

import { FILES, LINES, POINTS, RANKS, fileOf, rankOf } from "../engine/board";
import {
  BOARD_SIZE,
  COORDINATE_LABELS,
  HINT_RADIUS,
  LINE_SEGMENTS,
  PIECE_RADIUS,
  centreOf,
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

describe("the ring a hint is marked with", () => {
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

  it("goes round the outside of whatever stands on the point", () => {
    expect(HINT_RADIUS).toBeGreaterThan(PIECE_RADIUS);
  });

  it("stays clear of the point next door, so two hinted points read as two", () => {
    expect(HINT_RADIUS * 2).toBeLessThan(closestPoints);
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
