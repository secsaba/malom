import type { Grade } from "../session/game-session";
import { strings } from "../strings";

type TeachingProps = {
  /** Whether teaching is on. */
  readonly teaching: boolean;
  /** Whether a hint is the player's to ask for at this moment. */
  readonly hintOffered: boolean;
  /** Whether the engine is working one out. */
  readonly hinting: boolean;
  /** What the engine made of the last move a player played, once it has said. */
  readonly grade: Grade | undefined;
  readonly onTeach: (on: boolean) => void;
  readonly onAskForHint: () => void;
};

/**
 * Teaching: asking the engine what it would play here, and reading what it made
 * of the move that was played.
 *
 * The toggle is shown whoever is playing, because teaching is a setting and not a
 * mode — two people sharing a device can be taught as readily as one playing the
 * computer. The button below it appears only with teaching on, and goes dead
 * rather than vanishing while there is nothing to ask about: a hint is about the
 * move somebody is looking at, and on the computer's turn nobody is looking at
 * one. Leaving it in place is what stops the page shifting under a player's
 * finger every time the computer thinks.
 *
 * The grade comes and goes with the move it is about, and there is nothing in
 * its place while the engine works one out: a line reading that a grade is on
 * its way would put a word in front of the player on every move they make, which
 * is a lot of nothing to read.
 */
export const Teaching = ({
  teaching,
  hintOffered,
  hinting,
  grade,
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

    {teaching && grade && (
      <p className="teaching__grade" data-testid="grade" data-grade={grade}>
        <span className="teaching__grade-heading">{strings.teaching.gradeHeading}</span>
        <span className="teaching__grade-verdict" data-testid="grade-verdict">
          {strings.teaching.grade[grade]}
        </span>
      </p>
    )}
  </section>
);
