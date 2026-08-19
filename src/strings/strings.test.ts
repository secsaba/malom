import { describe, expect, it } from "vitest";

import { DIFFICULTIES } from "../opponent/difficulty";
import { GRADES } from "../teaching/grade";
import { CRITICISM, PATTERNS } from "../teaching/patterns";
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
    expect(hu.teaching.gradeHeading).toBe("Értékelés");
    expect(hu.teaching.moveList.heading).toBe("Lépéslista");
    expect(hu.teaching.summary.weakness).toBe("Gyenge pont");
    expect(hu.panel.handle).toBe("Részletek");
  });

  it("names the five grades as the glossary names them, best first", () => {
    expect(GRADES.map((grade) => hu.teaching.grade[grade])).toEqual([
      "Legjobb",
      "Jó",
      "Pontatlan",
      "Hiba",
      "Súlyos hiba",
    ]);
  });

  it("names the four difficulties as the glossary names them", () => {
    expect(DIFFICULTIES.map((difficulty) => hu.difficulty[difficulty])).toEqual([
      "Kezdő",
      "Haladó",
      "Erős",
      "Mester",
    ]);
  });

  /**
   * ADR-0003: a reason is only ever generated from a pattern the engine
   * positively detected. A pattern with no sentence would be one the interface
   * could not say, and a sentence with no pattern would be one nothing detected.
   */
  it("has a sentence for every pattern the engine can detect, and no others", () => {
    expect(Object.keys(hu.teaching.reason.pattern).sort()).toEqual([...PATTERNS].sort());
  });

  /**
   * The summary names a weakness only where the engine detected the criticism it
   * is named after (ADR-0003), so the two lists are the same list — and the
   * praise has no name here, because nothing a player did well is a weakness.
   */
  it("has a name for every criticism the summary can name as a weakness, and no others", () => {
    expect(Object.keys(hu.teaching.summary.criticism).sort()).toEqual([...CRITICISM].sort());
  });

  /** The acceptance criterion: a draw is the target result against Mester. */
  it("words a draw as a draw and never as a defeat", () => {
    const { result } = hu.teaching.summary;

    expect(result.drawn).toContain("Döntetlen");
    expect(result.drawnAgainstMaster).toContain("Döntetlen");
    expect(result.drawnAgainstMaster).toContain("Mester");
    expect(`${result.drawn} ${result.drawnAgainstMaster}`.toLowerCase()).not.toMatch(
      /veszt|vereség/u,
    );
    expect(result.lost.toLowerCase()).toMatch(/veszt/u); // which is what the loss says
  });

  it("words the patterns with the terms the glossary settles on", () => {
    const { pattern } = hu.teaching.reason;
    const said = Object.values(pattern).join(" ").toLowerCase();

    expect(pattern["fork-created"]).toContain("Kettős fenyegetés");
    expect(pattern["fork-handed"]).toContain("Kettős fenyegetés");
    expect(pattern["running-mill-opened"]).toContain("Csikicsuki");
    expect(pattern["mill-blocked"]).toContain("nyitott malmát");
    expect(pattern["mill-closed"]).toContain("levehette"); // levesz, and never üt

    // kettős malom is a Hungarian phrase for closing two mills at once, which is
    // not what a fork is; the glossary rules it out by name.
    expect(said).not.toContain("kettős malom");

    // The weakness is the same criticism under a name of its own, so it answers
    // to the same glossary.
    const { criticism } = hu.teaching.summary;
    expect(criticism["fork-handed"]).toContain("kettős fenyegetés");
    expect(criticism["wrong-piece-captured"]).toContain("levétel");
    expect(Object.values(criticism).join(" ").toLowerCase()).not.toContain("kettős malom");
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
