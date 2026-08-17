import { defineConfig } from "vitest/config";

/**
 * The slow suite, and the tuning run beside it. Both play games — hundreds of
 * moves searched at the depths the opponent really plays at — so both are
 * minutes rather than milliseconds, and neither belongs in the suite a developer
 * runs on every save. `pnpm test` never sees this file.
 *
 * The two live under one config because they want exactly the same things: node,
 * no browser, no clock on a single test, and every line a run prints kept rather
 * than swallowed. What tells them apart is the path — `pnpm test:slow` runs
 * `tests/slow`, `pnpm tune` runs `tests/tuning` — and what they are for:
 * `tests/slow` asserts that the engine is still as strong as it was, while
 * `tests/tuning` measures candidate weight sets against each other and prints
 * the table that decides them. The second is a harness driven by the test
 * runner rather than a check: it is here because Vitest is what runs TypeScript
 * in this repo.
 */
export default defineConfig({
  test: {
    include: ["tests/slow/**/*.test.ts", "tests/tuning/**/*.test.ts"],
    environment: "node",
    // A single self-play game is seconds; a match is minutes. The runs bound
    // themselves by how many games they play, so nothing here needs a clock.
    testTimeout: 0,
    hookTimeout: 0,
    // What a run measured is the output, so it is reported rather than hidden.
    reporters: ["verbose"],
  },
});
