import { SIDES, type Side } from "../engine/position";
import { useStrings } from "./language";

/** Who the next game is against: the other person on this device, or the computer. */
export type Against = "player" | "computer";

const AGAINST = ["player", "computer"] as const satisfies readonly Against[];

/** What the next game will be. The side is the player's own; the computer takes the other. */
export type NextGame = {
  readonly against: Against;
  readonly humanSide: Side;
};

/** Light first, as the rules have it and as most players will expect. */
export const FIRST_GAME: NextGame = { against: "player", humanSide: "light" };

type SetupProps = {
  readonly next: NextGame;
  readonly onChoose: (next: NextGame) => void;
  readonly onStart: () => void;
};

/**
 * What the next game is set to be, and the button that starts it. Choosing here
 * changes nothing about the game being played: nobody loses a game in progress
 * by looking at what the next one could be.
 *
 * Which side to take is asked only of a player who is playing the computer. In a
 * game two people share a device for, both sides are theirs already.
 */
export const Setup = ({ next, onChoose, onStart }: SetupProps) => {
  const strings = useStrings();

  return (
    <section className="setup" data-testid="setup">
      <h2 className="setup__heading">{strings.setup.heading}</h2>

      <fieldset className="setup__choice">
        <legend>{strings.setup.against.legend}</legend>
        {AGAINST.map((against) => (
          <label key={against} className="setup__option">
            <input
              type="radio"
              name="against"
              value={against}
              data-testid={`against-${against}`}
              checked={next.against === against}
              onChange={() => onChoose({ ...next, against })}
            />
            {strings.setup.against[against]}
          </label>
        ))}
      </fieldset>

      {next.against === "computer" && (
        <fieldset className="setup__choice">
          <legend>{strings.setup.yourSide}</legend>
          {SIDES.map((side) => (
            <label key={side} className="setup__option">
              <input
                type="radio"
                name="side"
                value={side}
                data-testid={`side-${side}`}
                checked={next.humanSide === side}
                onChange={() => onChoose({ ...next, humanSide: side })}
              />
              {strings.game.side[side]}
            </label>
          ))}
        </fieldset>
      )}

      <button type="button" className="setup__start" data-testid="start" onClick={onStart}>
        {strings.setup.start}
      </button>
    </section>
  );
};
