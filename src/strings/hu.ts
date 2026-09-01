/**
 * Every string the interface shows, in Hungarian — the default language and the
 * source of truth. Terms follow the glossary in CONTEXT.md; renaming a concept
 * there means renaming its string here.
 */
export const hu = {
  app: {
    title: "Malom",
  },
  board: {
    label: "Malomtábla",
    showCoordinates: "Koordináták mutatása",
    /**
     * What a point is, read out to a player who cannot see the marks on it. The
     * coordinate the announcement opens with is notation rather than language
     * and comes from the board itself; everything said after it is here.
     *
     * The two sides are named as pieces rather than as "your own" and "the
     * opponent's": two people share one device, so whose piece a bábu is
     * changes with whose turn it is, and a point that answered differently
     * depending on who was listening would be the one thing on the board that
     * did.
     */
    point: {
      empty: "üres",
      /** The piece standing on the point, keyed by the side it belongs to. */
      piece: {
        light: "világos bábu",
        dark: "sötét bábu",
      },
      /** A point the side to move may act on, whichever of the four ways it may. */
      legal: "választható",
      /** The piece the player has picked up and not yet moved. */
      selected: "felvéve",
      /** What the move the engine would play has this point doing. */
      hint: {
        from: "tipp: innen lép",
        to: "tipp: ide lép",
        capture: "tipp: ezt veszi le",
      },
      /** Where the piece that moved last came to rest. */
      lastMove: "utolsó lépés",
      /**
       * A point the last move took a piece off, keyed by the side that lost it.
       * The point itself is empty and says so first; this is what became of what
       * stood on it, which is the half a player who cannot see the board would
       * otherwise never be told.
       */
      captured: {
        light: "innen vettek le világos bábut",
        dark: "innen vettek le sötét bábut",
      },
    },
  },
  game: {
    /** The phases, keyed by the value the game session reports. */
    phase: {
      placing: "Lerakás",
      moving: "Lépegetés",
      flying: "Ugrálás",
    },
    /** The sides, keyed the same way. */
    side: {
      light: "Világos",
      dark: "Sötét",
    },
    /** Whose turn it is. A whole sentence per side: word order is a language's own business. */
    toMove: {
      light: "Világos következik",
      dark: "Sötét következik",
    },
    piecesInHand: "Le nem rakott bábuk",
    capture: "Malom! Vegye le az ellenfél egyik bábuját.",
    /**
     * The capture once it has been taken, read out where the mark on the board
     * cannot be seen. The board said a capture was owed and never that one had
     * happened, which left the whole of it to be seen rather than heard.
     *
     * The coordinate is filled in by the interface: it is notation rather than
     * language and reads the same in either.
     */
    captured: {
      light: "Levett világos bábu:",
      dark: "Levett sötét bábu:",
    },
    /** How many pieces each side has lost, headed over the two heaps. */
    capturedPieces: "Levett bábuk",
    /** Shown while the computer is choosing its move. */
    thinking: "A gép gondolkodik…",
    /**
     * How the game ended: who won and what left the other side unable to go on,
     * or — where neither side could win it — what drew it.
     */
    result: {
      winner: {
        light: "Világos nyert",
        dark: "Sötét nyert",
      },
      draw: "Döntetlen",
      /** Keyed by the draw condition the game ran into. */
      drawnBy: {
        repetition: "Ugyanaz az állás harmadszor is előállt.",
        "fifty-move": "Ötven-ötven lépés telt el levétel nélkül.",
      },
      /** Keyed by the side that lost, since that is the side each sentence is about. */
      ending: {
        reduced: {
          light: "Világosnak csak két bábuja maradt.",
          dark: "Sötétnek csak két bábuja maradt.",
        },
        blocked: {
          light: "Világos beszorult: nincs szabályos lépése.",
          dark: "Sötét beszorult: nincs szabályos lépése.",
        },
      },
    },
  },
  /**
   * How strongly the computer plays, keyed by the difficulty the game session
   * reports. The four names are the glossary's and are not translations of the
   * English keys: Kezdő and Haladó are what a Hungarian course calls its levels.
   */
  difficulty: {
    legend: "Nehézség",
    beginner: "Kezdő",
    intermediate: "Haladó",
    strong: "Erős",
    master: "Mester",
  },
  /**
   * The language the interface is read in. The two names are not translated and
   * are the same in both files on purpose: a player who has landed in a language
   * they cannot read finds their own by looking for the word they know, and
   * "Hungarian" is not that word for a Hungarian speaker.
   */
  language: {
    legend: "Nyelv",
    name: {
      hu: "Magyar",
      en: "English",
    },
  },
  /**
   * Teaching: the setting itself, the button that asks the engine what it would
   * play, what it made of the move that was played, and the two second thoughts
   * a learner is allowed — a move taken back, and the warning before a blunder. The hint is worded as the
   * request rather than as the thing — "tipp" alone would read as a label on a
   * hint nobody has asked for yet. The takeback beside it is the glossary's own
   * word and needs no such help.
   */
  teaching: {
    toggle: "Tanulómód",
    hint: "Tipp kérése",
    /** Taking a move back, in the glossary's own term. */
    takeback: "Visszalépés",
    /** What the grade shown beside it is a grade of. */
    gradeHeading: "Értékelés",
    /**
     * What the engine made of the move just played, keyed by the grade the game
     * session reports. The five are the glossary's own scale, best first; Súlyos
     * hiba is two words because Hungarian has no single word for a blunder that
     * is not also a word for a lesser mistake.
     */
    grade: {
      best: "Legjobb",
      good: "Jó",
      inaccuracy: "Pontatlan",
      mistake: "Hiba",
      blunder: "Súlyos hiba",
    },
    /**
     * The warning a player can ask for before a blunder: the setting itself, the
     * line shown while the engine looks at the move, the question it comes back
     * with, and the two answers to it.
     *
     * The question states the verdict rather than hedging it. The engine has
     * graded the move by the time it is asked, so "lehet" would claim less than
     * the search actually says — the discipline of ADR-0003 cuts both ways.
     */
    warning: {
      toggle: "Figyelmeztetés súlyos hiba előtt",
      checking: "A gép megnézi a lépést…",
      asks: "Ez a lépés súlyos hiba. Biztosan ezt lépi?",
      playAnyway: "Mégis ezt lépem",
      thinkAgain: "Mégsem",
    },
    /**
     * The one line that stands beside the grade and says why. Every sentence
     * here answers to a pattern the engine positively detected (ADR-0003), so
     * there is exactly one of them per pattern and no way to word a verdict the
     * engine cannot back up.
     *
     * The terms are the glossary's: kettős fenyegetés for a fork and never
     * kettős malom, which means something else; levétel for a capture and never
     * ütés, which belongs to chess; csikicsuki for a mill being run.
     */
    reason: {
      /** Keyed by the pattern the engine detected, praise first. */
      pattern: {
        "opponent-mill-less": "Az ellenfélnek egyetlen vonalon sem maradt esélye malmot zárni.",
        "fork-created": "Kettős fenyegetést épített: az ellenfél csak az egyiket tudja elzárni.",
        "running-mill-opened": "Csikicsuki: a malmot minden második lépésben újra zárhatja.",
        "mill-blocked": "Idejében elzárta az ellenfél nyitott malmát.",
        "mill-closed": "Bezárta a malmot, és levehette az ellenfél egyik bábuját.",
        "intersection-taken":
          "Elfoglalta az egyik kereszteződést: ezek a tábla legértékesebb csomópontjai.",
        "wrong-piece-captured": "Rossz bábut vett le: az ellenfél nyitott malma állva maradt.",
        "mill-let-through": "Átengedte az ellenfél malmát: a következő lépésben bezárhatja.",
        "fork-handed": "Kettős fenyegetéshez juttatta az ellenfelet.",
        "mill-missed": "Malmot zárhatott volna, és kihagyta.",
        "mill-broken-for-nothing":
          "Feleslegesen bontotta meg a malmát: az ellenfél elfoglalhatja az elhagyott csomópontot.",
        "piece-left-blockable":
          "Olyan csomópontra lépett, ahol az ellenfél beszoríthatja a bábut.",
      },
      /**
       * Where nothing was detected. The move the engine would have played
       * follows in coordinates, which are notation rather than language and so
       * are the one visible thing that does not come from here.
       *
       * It says what the engine would have played and not what it preferred: a
       * move within a point of the engine's own is graded Legjobb, so a player
       * can be told they played the best move and be shown a different one, and
       * "inkább" would claim a preference the evaluation does not support.
       */
      prefers: "A gép ezt lépte volna:",
      /** Where nothing was detected and the move played is the engine's own. */
      agrees: "A gép is ezt lépte volna.",
    },
    /**
     * The move list, and coming back to the game from a move looked back at.
     * The moves themselves are coordinates, which are notation rather than
     * language, so nothing here words one — and neither is a move numbered
     * here: the list is numbered where it is drawn.
     */
    moveList: {
      heading: "Lépéslista",
      /** Back from a move being looked back at to the game itself. */
      backToPlay: "Vissza a játékhoz",
    },
    /**
     * The summary at the end of the game: how the game ended for this side, how
     * its moves were graded, and the mistake it made most often.
     *
     * A draw is worded as a draw and never as a defeat, because it is not one —
     * against Mester it is the result to play for, and that is what the second
     * of the two drawn sentences says.
     */
    summary: {
      heading: "Játszma összegzése",
      /** Keyed by the Result read from the side being summarised. */
      result: {
        won: "Megnyerte a játszmát.",
        drawn: "Döntetlen: egyik fél sem tudta megnyerni.",
        /** The draw shown where the opponent was the computer at full strength. */
        drawnAgainstMaster: "Döntetlen: Mester ellen éppen ez a cél.",
        lost: "Elvesztette a játszmát.",
      },
      /** What the five counts beside the grades add up to. */
      graded: "Értékelt lépések",
      /** What the criticism named beside it is. */
      weakness: "Gyenge pont",
      /** Where nothing of this side's play was criticised at all. */
      noWeakness: "A gép nem talált visszatérő hibát.",
      /**
       * The weakness itself, keyed by the criticism the engine detected most
       * often. They are named as things rather than as something done on one
       * move, because that is what they are here: the sentences under a grade
       * are about the move just played, and read wrong over a whole game.
       */
      criticism: {
        "wrong-piece-captured": "Rossz bábu levétele",
        "mill-let-through": "Átengedett malom",
        "fork-handed": "Az ellenfélnek adott kettős fenyegetés",
        "mill-missed": "Kihagyott malom",
        "mill-broken-for-nothing": "Feleslegesen megbontott malom",
        "piece-left-blockable": "Beszorítható helyre lépett bábu",
      },
    },
  },
  /** Starting a game: who is playing it, and which side the player takes. */
  setup: {
    heading: "Új játék",
    /** Who the player is up against, keyed by the choice the interface offers. */
    against: {
      legend: "Ellenfél",
      player: "Másik játékos",
      computer: "Gép",
    },
    /** The side the player takes against the computer. The sides are named in `game.side`. */
    yourSide: "Az Ön színe",
    start: "Kezdés",
    rematch: "Visszavágó cserélt színekkel",
  },
} as const;
