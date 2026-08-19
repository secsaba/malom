/**
 * Where the settings and the game in progress are kept between visits: the
 * browser's own storage, which ADR-0004 makes the whole of this app's memory —
 * there is no server to keep anything on and no account to keep it under.
 *
 * It is the one place in the app that touches storage, and it is in `src/ui`
 * because the browser is on this side of the boundary (ADR-0002). The session
 * hands over plain data and is handed plain data back; what a key is, what JSON
 * is and what a reload is are all news to it.
 *
 * The settings and the game are kept apart because they are kept for different
 * lengths of time: starting a new game throws the game away and leaves the
 * settings exactly where the player put them.
 *
 * Nothing here fails loudly. Storage that is full, switched off in the browser's
 * settings, or holding something this program did not write leaves the player
 * with the defaults and a new game — which is worth strictly more than an app
 * that will not start.
 */

import {
  type SavedGame,
  type SavedSettings,
  isObject,
  savedGameIn,
  savedSettingsIn,
} from "../session/saved-game";
import { DEFAULT_LANGUAGE, type Language, languageIn } from "../strings";

/**
 * What the two are kept under. They are named here rather than spelled out
 * wherever they are used, and exported because the browser suite writes nonsense
 * under them to prove that nonsense costs the player nothing.
 */
export const KEYS = { settings: "malom.settings", game: "malom.game" } as const;

/**
 * Every setting that survives a visit: the session's own, and the interface's
 * two — whether the board is labelled with its coordinates, and which language
 * it is read in. Both are the interface's business and never the game's, which
 * is why they are here and not in {@link SavedSettings}: nothing behind the
 * boundary may so much as name a language (ADR-0002).
 */
export type Settings = SavedSettings & {
  readonly showCoordinates: boolean;
  readonly language: Language;
};

const read = (key: string): unknown => {
  try {
    const written = localStorage.getItem(key);
    return written === null ? undefined : JSON.parse(written);
  } catch {
    // Storage the browser will not open, and text that is not the JSON this
    // program wrote, come to the same thing: nothing was remembered.
    return undefined;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A browser that will not keep anything is one the game is played in and not
    // remembered, rather than one the game cannot be played in.
  }
};

const forget = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // As above: there is nothing useful to do about storage that will not answer.
  }
};

/**
 * Whether the board was left labelled with its coordinates. Off is the default,
 * and the default is what anything other than a plain yes comes to: the board
 * stays uncluttered while the shapes are still being learned.
 */
const showsCoordinates = (written: unknown): boolean =>
  isObject(written) && written.showCoordinates === true;

/**
 * The language the interface was left in. Anything that is not one of the
 * languages this program offers comes back as the default, so a setting edited
 * by hand into a language nobody has translated leaves the player reading
 * Hungarian rather than reading keys.
 */
const languageOf = (written: unknown): Language =>
  (isObject(written) ? languageIn(written.language) : undefined) ?? DEFAULT_LANGUAGE;

/** The settings a previous visit left behind, each falling back to its default on its own. */
export const rememberedSettings = (): Settings => {
  const written = read(KEYS.settings);

  return {
    ...savedSettingsIn(written),
    showCoordinates: showsCoordinates(written),
    language: languageOf(written),
  };
};

/**
 * Write down the settings given, leaving the ones not given where they are. The
 * session and the interface each keep their own, and neither may forget the
 * other's on its way past.
 */
export const remember = (settings: Partial<Settings>) => {
  write(KEYS.settings, { ...rememberedSettings(), ...settings });
};

/** The game a previous visit left behind, where it left one this program can read. */
export const rememberedGame = (): SavedGame | undefined => savedGameIn(read(KEYS.game));

/**
 * Write the game down — or take it out of storage, where there is nothing in it
 * worth coming back to. That is what starting a new hotseat game leaves behind:
 * no moves, and nobody playing the computer.
 */
export const rememberGame = (game: SavedGame) => {
  if (game.moves.length === 0 && game.opponentSide === undefined) return forget(KEYS.game);

  write(KEYS.game, game);
};
