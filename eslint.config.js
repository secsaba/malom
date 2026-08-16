import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * The boundary ADR-0002 draws: `src/engine` (rules), `src/ai` (search),
 * `src/session` (the facade the interface talks to) and `src/opponent` (the
 * computer as a player, and the worker it thinks in) are pure TypeScript over
 * plain data. They import nothing from React, nothing from the DOM, and nothing
 * from the strings module — the last of those because they return patterns and
 * phases as data and the interface turns those into sentences.
 *
 * This is the load-bearing part of the decision. Without it the boundary erodes
 * on the first convenient import, and the Web Worker and the unit tests both
 * quietly break.
 */
const engineBoundary = {
  files: [
    "src/engine/**/*.{ts,tsx}",
    "src/ai/**/*.{ts,tsx}",
    "src/session/**/*.{ts,tsx}",
    "src/opponent/**/*.{ts,tsx}",
  ],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["react", "react/*", "react-dom", "react-dom/*"],
            message:
              "ADR-0002: the engine, the search and the session have no UI dependencies. Keep React in src/ui.",
          },
          {
            group: ["**/strings", "**/strings/*"],
            message:
              "ADR-0002: the engine cannot produce user-facing text. Return it as data and let src/ui word it.",
          },
          {
            group: ["**/ui", "**/ui/*", "**/ui/**"],
            message: "ADR-0002: src/ui depends on these modules; they never depend on src/ui.",
          },
        ],
      },
    ],
    "no-restricted-globals": [
      "error",
      ...["document", "window", "navigator", "localStorage", "sessionStorage", "location"].map(
        (name) => ({
          name,
          message:
            "ADR-0002: the engine, the search and the session touch no DOM, so they can run inside a Web Worker.",
        }),
      ),
    ],
  },
};

/**
 * Acceptance criterion of #2: every visible string comes from the strings
 * module. Text written straight into a component is caught here rather than at
 * review time, which is what keeps the English translation (#19) a data change.
 */
const noHardcodedText = {
  files: ["src/**/*.tsx"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "JSXText[value=/[^\\s]/]",
        message: "Take user-facing text from the strings module, not from the component.",
      },
      {
        selector: "JSXExpressionContainer > Literal[value=/[^\\s]/]",
        message: "Take user-facing text from the strings module, not from the component.",
      },
      {
        selector:
          "JSXAttribute[name.name=/^(alt|title|placeholder|aria-label|aria-description|aria-placeholder|aria-roledescription|aria-valuetext)$/] > Literal",
        message: "Take user-facing text from the strings module, not from the component.",
      },
    ],
  },
};

export default tseslint.config(
  { ignores: ["dist/", "playwright-report/", "test-results/", "blob-report/"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  engineBoundary,
  noHardcodedText,
);
