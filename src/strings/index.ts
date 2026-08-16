/**
 * The strings module: the one place user-facing text lives. Components read
 * from {@link strings} and never spell out text of their own — a lint rule
 * fails the build on a literal in JSX.
 *
 * Hungarian is currently the only language, so this is a plain object rather
 * than a lookup by locale. English arrives later and turns it into one.
 */

import { hu } from "./hu";

export type Strings = typeof hu;

/** The active language's strings. */
export const strings: Strings = hu;
