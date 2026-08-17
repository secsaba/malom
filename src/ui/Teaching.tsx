import { strings } from "../strings";

type TeachingProps = {
  /** Whether teaching is on. */
  readonly teaching: boolean;
  /** Whether a hint is the player's to ask for at this moment. */
  readonly hintOffered: boolean;
  /** Whether the engine is working one out. */
  readonly hinting: boolean;
  readonly onTeach: (on: boolean) => void;
  readonly onAskForHint: () => void;
};

/**
 * Teaching, and the one thing it currently offers: asking the engine what it
 * would play here.
 *
 * The toggle is shown whoever is playing, because teaching is a setting and not a
 * mode — two people sharing a device can be taught as readily as one playing the
 * computer. The button below it appears only with teaching on, and goes dead
 * rather than vanishing while there is nothing to ask about: a hint is about the
 * move somebody is looking at, and on the computer's turn nobody is looking at
 * one. Leaving it in place is what stops the page shifting under a player's
 * finger every time the computer thinks.
 */
export const Teaching = ({
  teaching,
  hintOffered,
  hinting,
  onTeach,
  onAskForHint,
}: TeachingProps) => (
  <section className="teaching" data-testid="teaching">
    <label className="teaching__toggle">
      <input
        type="checkbox"
        data-testid="teaching-toggle"
        checked={teaching}
        onChange={(event) => onTeach(event.target.checked)}
      />
      {strings.teaching.toggle}
    </label>

    {teaching && (
      <button
        type="button"
        className="teaching__hint"
        data-testid="hint"
        disabled={!hintOffered || hinting}
        onClick={onAskForHint}
      >
        {strings.teaching.hint}
      </button>
    )}
  </section>
);
