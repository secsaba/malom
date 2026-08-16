/**
 * ADR-0002 says a lint rule fails the build when the engine, the search or the
 * game session facade reaches for the interface. This checks the rule is really configured to do
 * that, by linting code that has never been written into the repo — so the
 * boundary is proved from the outside rather than by the absence of a violation.
 *
 * `pnpm lint` in CI is what actually fails the build; these are the fixtures
 * saying what it would fail on.
 */

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });

const messagesFor = async (filePath: string, code: string) => {
  const [result] = await eslint.lintText(code, { filePath, warnIgnored: false });
  return (result?.messages ?? []).map((message) => `${message.ruleId}: ${message.message}`);
};

const forbidden = [
  { what: "React", code: `import { useState } from "react";\nexport const x = useState;` },
  { what: "React DOM", code: `import { createRoot } from "react-dom/client";\nexport const x = createRoot;` },
  { what: "the strings module", code: `import { strings } from "../strings";\nexport const x = strings;` },
  { what: "the interface", code: `import { Board } from "../ui/Board";\nexport const x = Board;` },
  { what: "the document", code: `export const x = () => document.title;` },
  { what: "the window", code: `export const x = () => window.innerWidth;` },
  { what: "local storage", code: `export const x = () => localStorage.getItem("game");` },
  { what: "a thread of its own", code: `export const x = () => new Worker("");` },
];

describe.each([
  { module: "the engine", path: "src/engine/fixture.ts" },
  { module: "the search", path: "src/ai/fixture.ts" },
  { module: "the game session", path: "src/session/fixture.ts" },
  { module: "the opponent", path: "src/opponent/fixture.ts" },
])("$module", ({ path }) => {
  it.each(forbidden)("cannot reach for $what", async ({ code }) => {
    const messages = await messagesFor(path, code);
    expect(messages.join("\n")).toMatch(/ADR-0002/);
  });

  it("is left alone when it stays on plain data", async () => {
    const messages = await messagesFor(
      path,
      `import { POINTS } from "../engine/board";\nexport const count = POINTS.length;`,
    );
    expect(messages).toEqual([]);
  });
});

describe("the adapter the opponent thinks through", () => {
  const path = "src/opponent/worker-opponent.ts";

  it("is the one place behind the boundary that may start a thread", async () => {
    const messages = await messagesFor(path, `export const x = () => new Worker("");`);

    expect(messages).toEqual([]);
  });

  it("may reach for nothing else of the browser's", async () => {
    const messages = await messagesFor(path, `export const x = () => window.innerWidth;`);

    expect(messages.join("\n")).toMatch(/ADR-0002/);
  });
});

describe("a component", () => {
  const path = "src/ui/Fixture.tsx";

  it.each([
    { how: "as text", code: `export const C = () => <p>Koordináták</p>;` },
    { how: "as an expression", code: `export const C = () => <p>{"Koordináták"}</p>;` },
    { how: "as a label for assistive technology", code: `export const C = () => <p aria-label="Malomtábla" />;` },
  ])("cannot spell out user-facing text $how", async ({ code }) => {
    const messages = await messagesFor(path, code);
    expect(messages.join("\n")).toMatch(/strings module/);
  });

  it("is left alone when it reads from the strings module", async () => {
    const messages = await messagesFor(
      path,
      `import { strings } from "../strings";\nexport const C = () => <p aria-label={strings.board.label}>{strings.app.title}</p>;`,
    );
    expect(messages).toEqual([]);
  });

  it("is left alone when it names a class or a test hook", async () => {
    const messages = await messagesFor(
      path,
      `export const C = () => <p className="board" data-testid="board" />;`,
    );
    expect(messages).toEqual([]);
  });
});
