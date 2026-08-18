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
   * Teaching: the setting itself, the button that asks the engine what it would
   * play, and what it made of the move that was played. The hint is worded as
   * the request rather than as the thing — "tipp" alone would read as a label on
   * a hint nobody has asked for yet.
   */
  teaching: {
    toggle: "Tanulómód",
    hint: "Tipp kérése",
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
