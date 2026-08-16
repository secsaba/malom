import { describe, expect, it } from "vitest";

import {
  FILES,
  LINES,
  POINTS,
  type PointId,
  RANKS,
  fileOf,
  isPointId,
  neighboursOf,
  rankOf,
} from "./board";

describe("points", () => {
  it("has 24 of them", () => {
    expect(POINTS).toHaveLength(24);
  });

  it("names each one by its file and rank", () => {
    for (const point of POINTS) {
      expect(point).toBe(`${fileOf(point)}${rankOf(point)}`);
    }
  });

  it("draws every file and rank from the 7x7 grid", () => {
    expect(FILES).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
    expect(RANKS).toEqual([1, 2, 3, 4, 5, 6, 7]);

    for (const point of POINTS) {
      expect(FILES).toContain(fileOf(point));
      expect(RANKS).toContain(rankOf(point));
    }
  });

  it("recognises its own point ids and nothing else", () => {
    expect(isPointId("a1")).toBe(true);
    expect(isPointId("d2")).toBe(true);
    expect(isPointId("d4")).toBe(false); // the hole in the middle of the board
    expect(isPointId("a2")).toBe(false);
    expect(isPointId("h1")).toBe(false);
    expect(isPointId("")).toBe(false);
  });
});

describe("lines", () => {
  it("has 16 of them", () => {
    expect(LINES).toHaveLength(16);
  });

  it("gives each one three distinct points of the board", () => {
    for (const line of LINES) {
      expect(line).toHaveLength(3);
      expect(new Set(line).size).toBe(3);
      for (const point of line) expect(POINTS).toContain(point);
    }
  });

  it("puts every point on exactly two lines — one along a file, one along a rank", () => {
    for (const point of POINTS) {
      const through = LINES.filter((line) => (line as readonly PointId[]).includes(point));
      expect(through).toHaveLength(2);

      const sameFile = through.filter((line) => line.every((p) => fileOf(p) === fileOf(point)));
      const sameRank = through.filter((line) => line.every((p) => rankOf(p) === rankOf(point)));
      expect(sameFile).toHaveLength(1);
      expect(sameRank).toHaveLength(1);
    }
  });

  it("orders each line's points along the board, so drawing first to last covers it", () => {
    for (const line of LINES) {
      const [first, middle, last] = line;
      // a line runs either along a file or along a rank; measure it in whichever it varies
      const along = (point: PointId) =>
        fileOf(first) === fileOf(last) ? rankOf(point) : FILES.indexOf(fileOf(point));

      expect(along(first)).toBeLessThan(along(middle));
      expect(along(middle)).toBeLessThan(along(last));
      // the middle point sits halfway between the ends, so the segment passes through it
      expect(along(middle) - along(first)).toBe(along(last) - along(middle));
    }
  });

  it("never repeats a line", () => {
    const keys = LINES.map((line) => line.join("-"));
    expect(new Set(keys).size).toBe(LINES.length);
  });
});

describe("neighbours", () => {
  const degreeOf = (point: (typeof POINTS)[number]) => neighboursOf(point).length;

  it("is symmetric", () => {
    for (const point of POINTS) {
      for (const neighbour of neighboursOf(point)) {
        expect(neighboursOf(neighbour)).toContain(point);
      }
    }
  });

  it("never counts a point as its own neighbour, nor lists one twice", () => {
    for (const point of POINTS) {
      const neighbours = neighboursOf(point);
      expect(neighbours).not.toContain(point);
      expect(new Set(neighbours).size).toBe(neighbours.length);
    }
  });

  it("joins the 24 points with 32 edges", () => {
    const totalDegree = POINTS.reduce((sum, point) => sum + degreeOf(point), 0);
    expect(totalDegree / 2).toBe(32);
  });

  it("gives the four intersections four neighbours each", () => {
    const intersections = POINTS.filter((point) => degreeOf(point) === 4);
    expect(intersections).toEqual(["b4", "d2", "d6", "f4"]);
  });

  it("gives every other point two or three", () => {
    expect(POINTS.filter((point) => degreeOf(point) === 3)).toHaveLength(8);
    expect(POINTS.filter((point) => degreeOf(point) === 2)).toHaveLength(12);
  });

  it("does not join across the empty middle of the board", () => {
    expect(neighboursOf("d3")).not.toContain("d5");
    expect(neighboursOf("c4")).not.toContain("e4");
  });

  it("joins the corners of the outer square only along its sides", () => {
    expect(neighboursOf("a1")).toEqual(["a4", "d1"]);
    expect(neighboursOf("g7")).toEqual(["d7", "g4"]);
  });
});
