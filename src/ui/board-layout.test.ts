import { describe, expect, it } from "vitest";

import { FILES, LINES, POINTS, RANKS, fileOf, rankOf } from "../engine/board";
import {
  BOARD_SIZE,
  FILE_LABELS,
  LINE_SEGMENTS,
  RANK_LABELS,
  positionOf,
} from "./board-layout";

describe("point positions", () => {
  it("puts the corners of the outer square at the corners of the board", () => {
    expect(positionOf("a1")).toEqual({ x: 60, y: 660 });
    expect(positionOf("g1")).toEqual({ x: 660, y: 660 });
    expect(positionOf("a7")).toEqual({ x: 60, y: 60 });
    expect(positionOf("g7")).toEqual({ x: 660, y: 60 });
  });

  it("runs files left to right and ranks bottom to top", () => {
    for (const point of POINTS) {
      for (const other of POINTS) {
        if (fileOf(point) < fileOf(other)) {
          expect(positionOf(point).x).toBeLessThan(positionOf(other).x);
        }
        if (rankOf(point) < rankOf(other)) {
          expect(positionOf(point).y).toBeGreaterThan(positionOf(other).y);
        }
      }
    }
  });

  it("keeps every point inside the board", () => {
    for (const point of POINTS) {
      const { x, y } = positionOf(point);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(BOARD_SIZE);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(BOARD_SIZE);
    }
  });

  it("gives no two points the same position", () => {
    const seen = POINTS.map((point) => {
      const { x, y } = positionOf(point);
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
    for (const segment of LINE_SEGMENTS) {
      const [first, , last] = segment.line;
      expect({ x: segment.x1, y: segment.y1 }).toEqual(positionOf(first));
      expect({ x: segment.x2, y: segment.y2 }).toEqual(positionOf(last));
    }
  });

  it("passes through the middle point of every line", () => {
    for (const segment of LINE_SEGMENTS) {
      const middle = positionOf(segment.line[1]);
      expect(middle.x).toBe((segment.x1 + segment.x2) / 2);
      expect(middle.y).toBe((segment.y1 + segment.y2) / 2);
    }
  });
});

describe("coordinate labels", () => {
  it("labels all seven files and all seven ranks", () => {
    expect(FILE_LABELS.map((label) => label.file)).toEqual([...FILES]);
    expect(RANK_LABELS.map((label) => label.rank)).toEqual([...RANKS]);
  });

  it("lines each file label up under its file, and each rank label up with its rank", () => {
    for (const label of FILE_LABELS) {
      const onFile = POINTS.filter((point) => fileOf(point) === label.file);
      for (const point of onFile) expect(label.x).toBe(positionOf(point).x);
    }
    for (const label of RANK_LABELS) {
      const onRank = POINTS.filter((point) => rankOf(point) === label.rank);
      for (const point of onRank) expect(label.y).toBe(positionOf(point).y);
    }
  });

  it("sits outside the board, below it and to its left", () => {
    const points = POINTS.map(positionOf);
    const bottom = Math.max(...points.map((position) => position.y));
    const left = Math.min(...points.map((position) => position.x));

    for (const label of FILE_LABELS) {
      expect(label.y).toBeGreaterThan(bottom);
      expect(label.y).toBeLessThan(BOARD_SIZE);
    }
    for (const label of RANK_LABELS) {
      expect(label.x).toBeLessThan(left);
      expect(label.x).toBeGreaterThan(0);
    }
  });
});
