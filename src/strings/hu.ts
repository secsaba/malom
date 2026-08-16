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
  },
} as const;
