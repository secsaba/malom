import { describe, expect, it } from "vitest";

import { hu } from "./hu";
import { strings } from "./index";

type StringTree = { readonly [key: string]: string | StringTree };

const leavesOf = (tree: StringTree, prefix = ""): [string, string][] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string"
      ? [[`${prefix}${key}`, value] as [string, string]]
      : leavesOf(value, `${prefix}${key}.`),
  );

describe("the strings module", () => {
  it("serves Hungarian by default", () => {
    expect(strings).toBe(hu);
  });

  it("has something to show for every key", () => {
    const leaves = leavesOf(hu);
    expect(leaves.length).toBeGreaterThan(0);

    for (const [key, value] of leaves) {
      expect(value, key).not.toBe("");
      expect(value, key).toBe(value.trim());
    }
  });
});
