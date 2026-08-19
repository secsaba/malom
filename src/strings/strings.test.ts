import { describe, expect, it } from "vitest";

import { DIFFICULTIES } from "../opponent/difficulty";
import { GRADES } from "../teaching/grade";
import { CRITICISM, PATTERNS } from "../teaching/patterns";
import { en } from "./en";
import { hu } from "./hu";
import { DEFAULT_LANGUAGE, LANGUAGES, languageIn, stringsFor } from "./index";

type StringTree = { readonly [key: string]: string | StringTree };

const leavesOf = (tree: StringTree, prefix = ""): [string, string][] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string"
      ? [[`${prefix}${key}`, value] as [string, string]]
      : leavesOf(value, `${prefix}${key}.`),
  );

const keysOf = (tree: StringTree): string[] =>
  leavesOf(tree)
    .map(([key]) => key)
    .sort();

describe("the strings module", () => {
  it("serves Hungarian by default", () => {
    expect(DEFAULT_LANGUAGE).toBe("hu");
    expect(stringsFor(DEFAULT_LANGUAGE)).toBe(hu);
  });

  it("has the strings for every language it offers", () => {
    expect(LANGUAGES.map((language) => stringsFor(language))).toEqual([hu, en]);
  });

  /**
   * The acceptance criterion of #19, and the one test that keeps the two files
   * in step: a key added to Hungarian and forgotten in English is a string the
   * English interface would have nothing to show for. Equality rather than
   * containment, so an English key that grew on its own is caught too.
   */
  it("says everything Hungarian says in English, and nothing more", () => {
    expect(keysOf(en)).toEqual(keysOf(hu));
  });

  it("names each language it offers, in that language's own words", () => {
    expect(keysOf(hu.language.name)).toEqual([...LANGUAGES].sort());

    // The one group that is deliberately the same in both files: a player who
    // has landed in a language they cannot read looks for the word they know.
    expect(en.language.name).toEqual(hu.language.name);
  });

  it("reads back a language it offers, and nothing else", () => {
    for (const language of LANGUAGES) expect(languageIn(language)).toBe(language);

    for (const written of [undefined, null, "", "de", "HU", 1, {}, ["hu"]]) {
      expect(languageIn(written)).toBeUndefined();
    }
  });

  /**
   * ADR-0003: a reason is only ever generated from a pattern the engine
   * positively detected. A pattern with no sentence would be one the interface
   * could not say, and a sentence with no pattern would be one nothing detected.
   */
  it.each(LANGUAGES)("has a sentence for every pattern the engine can detect in %s", (language) => {
    expect(Object.keys(stringsFor(language).teaching.reason.pattern).sort()).toEqual(
      [...PATTERNS].sort(),
    );
  });

  /**
   * The summary names a weakness only where the engine detected the criticism it
   * is named after (ADR-0003), so the two lists are the same list — and the
   * praise has no name here, because nothing a player did well is a weakness.
   */
  it.each(LANGUAGES)("names every criticism the summary can name in %s", (language) => {
    expect(Object.keys(stringsFor(language).teaching.summary.criticism).sort()).toEqual(
      [...CRITICISM].sort(),
    );
  });

  it.each(LANGUAGES)("has something to show for every key in %s", (language) => {
    const leaves = leavesOf(stringsFor(language));
    expect(leaves.length).toBeGreaterThan(0);

    for (const [key, value] of leaves) {
      expect(value, key).not.toBe("");
      expect(value, key).toBe(value.trim());
    }
  });
});

describe("the Hungarian strings", () => {
  /**
   * The glossary in CONTEXT.md is the source of truth for these, and it says so:
   * "if a concept is renamed here, its Hungarian string is renamed with it".
   * Spelling them out is what makes the rest of the suite — which compares the
   * interface against the strings — more than a comparison of a string with itself.
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
});

/**
 * English answers to the same glossary as Hungarian does, and to the half of it
 * that is canonical: CONTEXT.md's headwords are the English surface forms, so
 * these are spelled out from the glossary in the way the Hungarian ones are.
 */
describe("the English strings", () => {
  it("shows each concept under the name the glossary gives it", () => {
    expect(en.game.phase.placing).toBe("Placing");
    expect(en.game.phase.moving).toBe("Moving");
    expect(en.game.phase.flying).toBe("Flying");
    expect(en.game.piecesInHand).toBe("Pieces in hand");
    expect(en.game.result.draw).toBe("Draw");
    expect(en.difficulty.legend).toBe("Difficulty");
    expect(en.teaching.toggle).toBe("Teaching mode");
    expect(en.teaching.takeback).toBe("Takeback");
    expect(en.teaching.gradeHeading).toBe("Grade");
    expect(en.teaching.moveList.heading).toBe("Move list");
    expect(en.teaching.summary.weakness).toBe("Weakness");
    expect(en.panel.handle).toBe("Details");
  });

  it("names the five grades as the glossary names them, best first", () => {
    expect(GRADES.map((grade) => en.teaching.grade[grade])).toEqual([
      "Best",
      "Good",
      "Inaccuracy",
      "Mistake",
      "Blunder",
    ]);
  });

  it("names the four difficulties as the glossary names them", () => {
    expect(DIFFICULTIES.map((difficulty) => en.difficulty[difficulty])).toEqual([
      "Beginner",
      "Intermediate",
      "Strong",
      "Master",
    ]);
  });

  /** The same acceptance criterion, in the language it is now also read in. */
  it("words a draw as a draw and never as a defeat", () => {
    const { result } = en.teaching.summary;

    expect(result.drawn).toContain("Draw");
    expect(result.drawnAgainstMaster).toContain("Draw");
    expect(result.drawnAgainstMaster).toContain("Master");
    expect(`${result.drawn} ${result.drawnAgainstMaster}`.toLowerCase()).not.toMatch(
      /lost|lose|defeat/u,
    );
    expect(result.lost.toLowerCase()).toMatch(/lost/u); // which is what the loss says
  });

  it("words the patterns with the terms the glossary settles on", () => {
    const { pattern } = en.teaching.reason;

    expect(pattern["fork-created"]).toContain("fork");
    expect(pattern["fork-handed"]).toContain("fork");
    expect(pattern["running-mill-opened"]).toContain("Running mill");
    expect(pattern["mill-blocked"]).toContain("potential mill");
    expect(pattern["mill-closed"]).toContain("captured");
    expect(pattern["intersection-taken"]).toContain("intersection");

    const { criticism } = en.teaching.summary;
    expect(criticism["fork-handed"]).toContain("Fork");
    expect(criticism["wrong-piece-captured"]).toContain("captured");
  });

  /**
   * The words CONTEXT.md rules out by name. Takeback keeps its own "take" and is
   * the glossary's own term, so this asks after the ones a translator reaches
   * for instead of the terms above rather than after every occurrence of a stem.
   */
  it("never reaches for the words the glossary rules out", () => {
    const said = leavesOf(en)
      .map(([, value]) => value.toLowerCase())
      .join(" ");

    for (const avoided of [
      "double mill", // a fork is not one, in either language
      "double threat",
      "swinging mill",
      "undo", // a takeback is not one
      "suggestion", // nor is a hint
      "counter", // nor is a piece any of these
      "token",
      "stone",
    ]) {
      expect(said, avoided).not.toContain(avoided);
    }

    // A capture is a capture; taking, removing, killing and eating are not it.
    expect(said).not.toMatch(/\b(removes?|removed|kills?|eats?)\b/u);
    expect(en.game.capture).toContain("Mill"); // a capture is earned by one
    expect(en.game.capture).toContain("Capture");
  });
});
