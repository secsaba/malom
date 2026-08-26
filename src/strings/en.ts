/**
 * Every string the interface shows, in English.
 *
 * Hungarian is the source of truth and `hu.ts` is where the reasoning lives:
 * why a string is worded the way it is, what it must not say, and which of them
 * are notation rather than language. This file is the wording and nothing else,
 * and it carries a comment only where English had a decision of its own to make.
 *
 * The terms are CONTEXT.md's headwords, which are the canonical English of this
 * project: fork and never double threat, capture and never take, potential mill
 * for a mill with one point still empty, running mill for one being run.
 */
import type { Strings } from "./index";

export const en: Strings = {
  app: {
    /**
     * The Hungarian title is the common noun for the game rather than a name
     * this project invented, so its English form is the game's English name and
     * not a transliteration of the Hungarian one.
     */
    title: "Nine Men's Morris",
  },
  panel: {
    handle: "Details",
  },
  board: {
    label: "Morris board",
    showCoordinates: "Show coordinates",
    point: {
      empty: "empty",
      piece: {
        light: "light piece",
        dark: "dark piece",
      },
      legal: "playable",
      selected: "picked up",
      hint: {
        from: "hint: move from here",
        to: "hint: move to here",
        capture: "hint: capture this",
      },
      lastMove: "last move",
      captured: {
        light: "a light piece was captured here",
        dark: "a dark piece was captured here",
      },
    },
  },
  game: {
    phase: {
      placing: "Placing",
      moving: "Moving",
      flying: "Flying",
    },
    side: {
      light: "Light",
      dark: "Dark",
    },
    toMove: {
      light: "Light to move",
      dark: "Dark to move",
    },
    piecesInHand: "Pieces in hand",
    capture: "Mill! Capture one of the opponent's pieces.",
    captured: {
      light: "Light piece captured:",
      dark: "Dark piece captured:",
    },
    capturedPieces: "Captured pieces",
    thinking: "The computer is thinking…",
    result: {
      winner: {
        light: "Light wins",
        dark: "Dark wins",
      },
      draw: "Draw",
      drawnBy: {
        repetition: "The same position came up for the third time.",
        "fifty-move": "Fifty moves each went by without a capture.",
      },
      ending: {
        reduced: {
          light: "Light was left with only two pieces.",
          dark: "Dark was left with only two pieces.",
        },
        blocked: {
          light: "Light is blocked: it has no legal move.",
          dark: "Dark is blocked: it has no legal move.",
        },
      },
    },
  },
  difficulty: {
    legend: "Difficulty",
    beginner: "Beginner",
    intermediate: "Intermediate",
    strong: "Strong",
    master: "Master",
  },
  language: {
    legend: "Language",
    /** Untranslated, and the same in both files — see the note in `hu.ts`. */
    name: {
      hu: "Magyar",
      en: "English",
    },
  },
  teaching: {
    toggle: "Teaching mode",
    hint: "Ask for a hint",
    takeback: "Takeback",
    gradeHeading: "Grade",
    grade: {
      best: "Best",
      good: "Good",
      inaccuracy: "Inaccuracy",
      mistake: "Mistake",
      blunder: "Blunder",
    },
    warning: {
      toggle: "Warn before a blunder",
      checking: "The computer is looking at the move…",
      asks: "This move is a blunder. Are you sure you want to play it?",
      playAnyway: "Play it anyway",
      thinkAgain: "Think again",
    },
    /**
     * The sentences address the player as "you", where the Hungarian ones use
     * the polite third person the whole interface is written in. English has no
     * such register, and the alternative — naming the side that moved — would
     * read as commentary on somebody else's game rather than as teaching.
     */
    reason: {
      pattern: {
        "opponent-mill-less": "The opponent has no line left on which to close a mill.",
        "fork-created":
          "You built a fork: the opponent can only block one of its two potential mills.",
        "running-mill-opened": "Running mill: you can close it again every second move.",
        "mill-blocked": "You blocked the opponent's potential mill in time.",
        "mill-closed": "You closed a mill and captured one of the opponent's pieces.",
        "intersection-taken":
          "You occupied an intersection: these are the most valuable points on the board.",
        "wrong-piece-captured":
          "You captured the wrong piece: the opponent's potential mill is still standing.",
        "mill-let-through": "You let the opponent's mill through: it can close on the next move.",
        "fork-handed": "You handed the opponent a fork.",
        "mill-missed": "You could have closed a mill, and missed it.",
        "mill-broken-for-nothing":
          "You broke your mill for nothing: the opponent can occupy the point you left.",
        "piece-left-blockable":
          "You moved to a point where the opponent can block that piece in.",
      },
      prefers: "The computer would have played:",
      agrees: "The computer would have played this too.",
    },
    moveList: {
      heading: "Move list",
      backToPlay: "Back to the game",
    },
    summary: {
      heading: "Game summary",
      result: {
        won: "You won the game.",
        drawn: "Draw: neither side could win it.",
        drawnAgainstMaster: "Draw: against Master this is exactly the goal.",
        lost: "You lost the game.",
      },
      graded: "Graded moves",
      weakness: "Weakness",
      noWeakness: "The computer found no recurring mistake.",
      criticism: {
        "wrong-piece-captured": "Wrong piece captured",
        "mill-let-through": "Mill let through",
        "fork-handed": "Fork handed to the opponent",
        "mill-missed": "Missed mill",
        "mill-broken-for-nothing": "Mill broken for nothing",
        "piece-left-blockable": "Piece left where it can be blocked in",
      },
    },
  },
  setup: {
    heading: "New game",
    against: {
      legend: "Opponent",
      player: "Another player",
      computer: "Computer",
    },
    yourSide: "Your side",
    start: "Start",
    rematch: "Rematch with sides swapped",
  },
};
