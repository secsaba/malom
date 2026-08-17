import { DIFFICULTIES, type Difficulty as Tier } from "../opponent/difficulty";
import { strings } from "../strings";

type DifficultyProps = {
  /** The difficulty the computer is playing at now. */
  readonly difficulty: Tier;
  readonly onChoose: (difficulty: Tier) => void;
};

/**
 * How strongly the computer plays, and the four levels to move it between.
 *
 * Unlike the setup below it, choosing here takes effect at once: difficulty is a
 * setting rather than part of a game, so a player who finds the opponent too
 * hard meets an easier one from its next move without giving up the game they
 * are in the middle of. It is shown whoever is playing, because it is what the
 * next game against the computer will be played at as well as this one.
 */
export const Difficulty = ({ difficulty, onChoose }: DifficultyProps) => (
  <section className="difficulty" data-testid="difficulty">
    <fieldset className="difficulty__choice">
      <legend>{strings.difficulty.legend}</legend>
      {DIFFICULTIES.map((tier) => (
        <label key={tier} className="difficulty__option">
          <input
            type="radio"
            name="difficulty"
            value={tier}
            data-testid={`difficulty-${tier}`}
            checked={difficulty === tier}
            onChange={() => onChoose(tier)}
          />
          {strings.difficulty[tier]}
        </label>
      ))}
    </fieldset>
  </section>
);
