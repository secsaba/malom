/**
 * What the browser suite reads the interface in.
 *
 * The default language, because that is what a page loaded with nothing in
 * storage comes up in: every spec here starts from an empty browser, so
 * asserting against these strings is asserting against the language a first
 * visit is answered in. The one spec that switches language asks for the other
 * one by name.
 */

import { DEFAULT_LANGUAGE, stringsFor } from "../../src/strings";

export const strings = stringsFor(DEFAULT_LANGUAGE);
