/**
 * The strings module: the one place user-facing text lives. Components read the
 * active language's strings and never spell out text of their own — a lint rule
 * fails the build on a literal in JSX.
 *
 * Hungarian is the default and the source of truth; English is a translation of
 * it. That is a fact about the shape of this module and not only about the
 * order they were written in: {@link Strings} is Hungarian's own shape with the
 * words taken out of it, so a key added to `hu` is one `en` fails to compile
 * without, and a key `en` grew on its own is one `en` fails to compile with.
 * Hungarian cannot be broken from the English side at all: it is the shape.
 *
 * There is no module-level `strings` here, and that absence is load-bearing: a
 * component that reached for one would compile, lint, and then go on showing
 * Hungarian to a player who had asked for English. The active language reaches
 * a component through `src/ui/language`, and nothing else knows which it is.
 */

import { en } from "./en";
import { hu } from "./hu";

/** The languages the interface can be read in. Hungarian first, as the default. */
export const LANGUAGES = ["hu", "en"] as const;

export type Language = (typeof LANGUAGES)[number];

/**
 * What the interface is read in until the player says otherwise, and what an
 * unreadable setting comes back as. Hungarian: this is a Hungarian teaching
 * tool that an English speaker can also use, rather than the other way round.
 */
export const DEFAULT_LANGUAGE: Language = "hu";

/**
 * Every string, as any one language holds them: the Hungarian tree with each of
 * its sentences widened back to `string`. Taking the shape from `hu` rather than
 * writing it out is what makes Hungarian the source of truth in the type system
 * and not merely in a comment.
 */
type Translated<T> = T extends string ? string : { readonly [K in keyof T]: Translated<T[K]> };

export type Strings = Translated<typeof hu>;

const TRANSLATIONS: Readonly<Record<Language, Strings>> = { hu, en };

/** Every string in the language given. */
export const stringsFor = (language: Language): Strings => TRANSLATIONS[language];

/**
 * The language written down where one this program offers was written down, and
 * nothing where the setting is missing or is a language nobody could have
 * chosen. The caller falls back to {@link DEFAULT_LANGUAGE}.
 */
export const languageIn = (raw: unknown): Language | undefined =>
  LANGUAGES.includes(raw as Language) ? (raw as Language) : undefined;
