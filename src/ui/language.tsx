/**
 * The language the interface is read in, and how a component gets the strings
 * for it.
 *
 * It is a context rather than a prop threaded down, because every component
 * shows text and almost none of them care which language it is: passing the
 * strings through the panel to reach the move list would make the panel's
 * signature about language, which is the one thing the panel has nothing to do
 * with.
 *
 * The page itself is told too. `<html lang>` is what a screen reader picks its
 * voice and its pronunciation from, so a Hungarian voice reading English aloud
 * is the failure this provider exists to prevent; the tab is text a player
 * reads, so it comes from the strings module like the rest of it. The tab is
 * filled in from Hungarian at build time (see `vite.config.ts`) so that it never
 * shows a placeholder first, and this is what moves it afterwards.
 */

import { type ReactNode, createContext, useContext, useEffect } from "react";

import { DEFAULT_LANGUAGE, type Language, type Strings, stringsFor } from "../strings";

const LanguageContext = createContext<Language>(DEFAULT_LANGUAGE);

export const LanguageProvider = ({
  language,
  children,
}: {
  readonly language: Language;
  readonly children: ReactNode;
}) => {
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = stringsFor(language).app.title;
  }, [language]);

  return <LanguageContext value={language}>{children}</LanguageContext>;
};

/**
 * Every string, in the language being read. This is the only way a component
 * gets text: there is no module-level `strings` to import instead, so a
 * component cannot accidentally be the one that stays Hungarian.
 */
export const useStrings = (): Strings => stringsFor(useContext(LanguageContext));
