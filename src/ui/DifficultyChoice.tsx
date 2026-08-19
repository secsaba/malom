import { DIFFICULTIES, type Difficulty } from "../session/game-session";
import { useStrings } from "./language";

type DifficultyChoiceProps = {
  /** The difficulty the computer is playing at now. */
  readonly difficulty: Difficulty;
  readonly onChoose: (difficulty: Difficulty) => void;
};

/**
 * How strongly the computer plays, and the four difficulties to move it between.
 *
 * Unlike the setup below it, choosing here takes effect at once: difficulty is a
 * setting rather than part of a game, so a player who finds the opponent too
 * hard meets an easier one from its next move without giving up the game they
 * are in the middle of. It is shown whoever is playing, because it is what the
 * next game against the computer will be played at as well as this one.
 */
export const DifficultyChoice = ({ difficulty, onChoose }: DifficultyChoiceProps) => {
  const strings = useStrings();

  return (
    <section className="difficulty" data-testid="difficulty">
      <fieldset className="difficulty__choice">
        <legend>{strings.difficulty.legend}</legend>
        {DIFFICULTIES.map((offered) => (
          <label key={offered} className="difficulty__option">
            <input
              type="radio"
              name="difficulty"
              value={offered}
              data-testid={`difficulty-${offered}`}
              checked={difficulty === offered}
              onChange={() => onChoose(offered)}
            />
            {strings.difficulty[offered]}
          </label>
        ))}
      </fieldset>
    </section>
  );
};
