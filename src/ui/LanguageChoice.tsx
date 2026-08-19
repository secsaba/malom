import { LANGUAGES, type Language } from "../strings";
import { useStrings } from "./language";

type LanguageChoiceProps = {
  /** The language the interface is being read in. */
  readonly language: Language;
  readonly onChoose: (language: Language) => void;
};

/**
 * Which language the interface is read in.
 *
 * The two names are the one thing here that is not translated — Magyar stays
 * Magyar and English stays English — because the player most in need of this
 * control is the one who cannot read the language they have landed in, and the
 * only word they are sure to recognise is their own language's name for itself.
 *
 * It sits at the foot of the panel with the coordinates, among the settings the
 * interface owns rather than among the ones about the game. Choosing takes
 * effect at once and disturbs nothing: the game is played in moves, and none of
 * them is in either language.
 */
export const LanguageChoice = ({ language, onChoose }: LanguageChoiceProps) => {
  const strings = useStrings();

  return (
    <section className="language" data-testid="language">
      <fieldset className="language__choice">
        <legend>{strings.language.legend}</legend>
        {LANGUAGES.map((offered) => (
          <label key={offered} className="language__option">
            <input
              type="radio"
              name="language"
              value={offered}
              data-testid={`language-${offered}`}
              checked={language === offered}
              onChange={() => onChoose(offered)}
            />
            {strings.language.name[offered]}
          </label>
        ))}
      </fieldset>
    </section>
  );
};
