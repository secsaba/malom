/**
 * The game and the settings as storage keeps them: plain JSON, and what to make
 * of the JSON that comes back.
 *
 * A game is written down as the moves played in it and nothing else, and read
 * back by playing them again from the first one. That is not thrift, though it
 * is compact: a {@link Game} keeps its position in a `Map` and the stretch of
 * quiet moves behind it in a chain, and neither of those survives a round trip
 * through JSON — a board written out point by point would come back without the
 * repetition count and the fifty-move count that draw the game. Playing the
 * moves again asks the rules for all of it, and gets the history a takeback
 * walks back through and the record a summary counts for nothing.
 *
 * It is also what keeps an impossible game out. Every move is checked against
 * the moves the rules allow in the position it was played from, and a game with
 * one they do not allow is turned away whole. Storage is the player's own to
 * edit, and a board reached by a move nobody could play is a board there may be
 * no way out of.
 *
 * Reading is total: anything that is not what was written comes back as nothing
 * at all, and the caller starts a new game or falls back to the default
 * setting. The settings are read one at a time rather than all or nothing —
 * they are unrelated to each other, so a difficulty nobody plays at is no reason
 * to forget which language the player reads.
 *
 * It is plain data on the engine's side of the boundary (ADR-0002): which key
 * this is written under, and what reads it out of the browser, is `src/ui`'s
 * business.
 */

import { POINTS, type PointId } from "../engine/board";
import { type Game, type Move, NEW_GAME, afterMove, legalMovesOf } from "../engine/game";
import { SIDES, type Side } from "../engine/position";
import { DIFFICULTIES, type Difficulty } from "../opponent/difficulty";
import type { Assessment } from "../teaching/assessment";
import { GRADES, isTheSameMove } from "../teaching/grade";
import { PATTERNS, type Pattern } from "../teaching/patterns";
import type { Reason } from "../teaching/reason";

/** A move of a saved game: what was played, and what the engine made of it where it said. */
export type SavedMove = {
  readonly move: Move;
  readonly assessment?: Assessment | undefined;
};

/**
 * A game as storage keeps it: who the computer was playing, if anybody, and
 * every whole move of the game in the order they were played.
 *
 * Which side played a move is not written down, because playing the game again
 * says: moves alternate, and light goes first. Neither is half a move — a piece
 * picked up, or one that has landed with the capture it earned still owed. A
 * reload puts the player back at the start of the turn they were in the middle
 * of, which costs them the taps and nothing else.
 */
export type SavedGame = {
  readonly opponentSide?: Side | undefined;
  readonly moves: readonly SavedMove[];
};

/**
 * The settings, which outlive the game they were set during. Every one of them
 * is optional: one that was never written, or that came back as something
 * nobody could have set, leaves the default in place.
 */
export type SavedSettings = {
  readonly difficulty: Difficulty | undefined;
  /** What the player said about teaching, where they have said either way. */
  readonly teaching: boolean | undefined;
  readonly warnsOfBlunders: boolean | undefined;
};

const isObject = (raw: unknown): raw is Readonly<Record<string, unknown>> =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw);

/** The value where it is one of the ones this program knows, and nothing where it is not. */
const oneOf = <T extends string>(known: readonly T[], raw: unknown): T | undefined =>
  known.includes(raw as T) ? (raw as T) : undefined;

/**
 * A point that was written down where one had to be, and nothing where the value
 * is missing or is not a point of the board. The two are told apart by the
 * caller, because `from` and `capture` are allowed to be missing and `to` is not.
 */
const pointIn = (raw: unknown): PointId | undefined => oneOf(POINTS, raw);

/** Whether a field that need not have been written down is a point of the board or is absent. */
const isPointOrAbsent = (raw: unknown): boolean => raw === undefined || pointIn(raw) !== undefined;

const moveIn = (raw: unknown): Move | undefined => {
  if (!isObject(raw)) return undefined;

  // A piece being placed comes from nowhere, and a move that closed no mill
  // earned no capture, so those two may be missing. A value that is there and is
  // not a point of the board is not a move at all.
  const to = pointIn(raw.to);
  if (to === undefined || !isPointOrAbsent(raw.from) || !isPointOrAbsent(raw.capture)) {
    return undefined;
  }

  return { from: pointIn(raw.from), to, capture: pointIn(raw.capture) };
};

const reasonIn = (raw: unknown): Reason | undefined => {
  if (!isObject(raw)) return undefined;

  if (raw.kind === "agrees") return { kind: "agrees" };

  if (raw.kind === "pattern") {
    const pattern = oneOf(PATTERNS, raw.pattern);
    return pattern === undefined ? undefined : { kind: "pattern", pattern };
  }

  if (raw.kind === "prefers") {
    const move = moveIn(raw.move);
    return move === undefined ? undefined : { kind: "prefers", move };
  }

  return undefined;
};

const patternsIn = (raw: unknown): readonly Pattern[] | undefined => {
  if (!Array.isArray(raw)) return undefined;

  const patterns = raw.map((pattern) => oneOf(PATTERNS, pattern));

  return patterns.every((pattern) => pattern !== undefined) ? patterns : undefined;
};

const assessmentIn = (raw: unknown): Assessment | undefined => {
  if (!isObject(raw)) return undefined;

  const grade = oneOf(GRADES, raw.grade);
  const patterns = patternsIn(raw.patterns);
  const reason = reasonIn(raw.reason);
  if (grade === undefined || patterns === undefined || reason === undefined) return undefined;

  return { grade, patterns, reason };
};

const savedMoveIn = (raw: unknown): SavedMove | undefined => {
  if (!isObject(raw)) return undefined;

  const move = moveIn(raw.move);
  if (move === undefined) return undefined;

  // A move nobody asked the engine about is written down without an answer, and
  // read back the same way: teaching switched on halfway through a game leaves
  // the moves before it ungraded, and so does a reload.
  if (raw.assessment === undefined) return { move, assessment: undefined };

  const assessment = assessmentIn(raw.assessment);

  return assessment === undefined ? undefined : { move, assessment };
};

/** The game the raw JSON holds, where it holds one written by this program. */
export const savedGameIn = (raw: unknown): SavedGame | undefined => {
  if (!isObject(raw) || !Array.isArray(raw.moves)) return undefined;

  // Nobody is the computer in a game two people played, so this is the one thing
  // a game is allowed to have been written down without.
  const opponentSide = oneOf(SIDES, raw.opponentSide);
  if (raw.opponentSide !== undefined && opponentSide === undefined) return undefined;

  const moves = raw.moves.map(savedMoveIn);
  if (!moves.every((move) => move !== undefined)) return undefined;

  return { opponentSide, moves };
};

/**
 * The settings the raw JSON holds. Each is taken on its own, so one that comes
 * back as something nobody could have set costs only itself.
 */
export const savedSettingsIn = (raw: unknown): SavedSettings => {
  const settings = isObject(raw) ? raw : {};

  return {
    difficulty: oneOf(DIFFICULTIES, settings.difficulty),
    teaching: typeof settings.teaching === "boolean" ? settings.teaching : undefined,
    warnsOfBlunders:
      typeof settings.warnsOfBlunders === "boolean" ? settings.warnsOfBlunders : undefined,
  };
};

/** A move of a saved game, played again: who played it, and where it left the game. */
export type PlayedBack = {
  readonly move: Move;
  readonly by: Side;
  readonly game: Game;
  readonly assessment: Assessment | undefined;
};

/**
 * A saved game played again from the start, or nothing where one of its moves is
 * a move the rules do not allow in the position it was played from — which
 * includes any move at all once the game has been won or drawn.
 */
export const playedBack = ({ moves }: SavedGame): readonly PlayedBack[] | undefined => {
  const played: PlayedBack[] = [];
  let game = NEW_GAME;

  for (const { move, assessment } of moves) {
    if (!legalMovesOf(game).some((legal) => isTheSameMove(legal, move))) return undefined;

    const next = afterMove(game, move);
    played.push({ move, by: game.sideToMove, game: next, assessment });
    game = next;
  }

  return played;
};
