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
} as const;
