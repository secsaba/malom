import { describe, expect, it } from "vitest";

import { DIFFICULTIES } from "../opponent/difficulty";
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

  /**
   * The glossary in CONTEXT.md is the source of truth for these, and it says so:
   * "if a concept is renamed here, its Hungarian string is renamed with it".
   * Spelling them out is what makes the rest of the suite — which compares the
   * interface against `strings` — more than a comparison of a string with itself.
   */
  it("shows each concept under the Hungarian name the glossary gives it", () => {
    expect(hu.board.label).toBe("Malomtábla");
    expect(hu.game.phase.placing).toBe("Lerakás");
    expect(hu.game.phase.moving).toBe("Lépegetés");
    expect(hu.game.phase.flying).toBe("Ugrálás");
    expect(hu.game.piecesInHand).toBe("Le nem rakott bábuk");
    expect(hu.game.result.draw).toBe("Döntetlen");
    expect(hu.setup.against.computer).toBe("Gép");
    expect(hu.difficulty.legend).toBe("Nehézség");
    expect(hu.teaching.toggle).toBe("Tanulómód");
    expect(hu.teaching.hint).toBe("Tipp kérése");
  });

  it("names the four difficulties as the glossary names them", () => {
    expect(DIFFICULTIES.map((difficulty) => hu.difficulty[difficulty])).toEqual([
      "Kezdő",
      "Haladó",
      "Erős",
      "Mester",
    ]);
  });

  it("never reaches for ütés, which belongs to chess and draughts rather than to malom", () => {
    const shown = leavesOf(hu).map(([, value]) => value.toLowerCase());

    // At the start of a word only: együtt is an innocent Hungarian word.
    expect(shown.filter((value) => /(^|\s)üt/u.test(value))).toEqual([]);
    expect(hu.game.capture.toLowerCase()).toContain("malom"); // levétel is earned by one
    expect(hu.game.capture.toLowerCase()).toContain("veg"); // levesz, in some form
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
