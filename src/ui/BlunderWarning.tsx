import { useStrings } from "./language";

type BlunderWarningProps = {
  /** Whether teaching is on. Nothing here is asked of a player who has not asked to be taught. */
  readonly teaching: boolean;
  /** Whether the move the player has committed to is being checked. */
  readonly checking: boolean;
  /** Whether the player is being asked to stand by a move the engine calls a blunder. */
  readonly warned: boolean;
  readonly onPlayAnyway: () => void;
  readonly onThinkAgain: () => void;
};

/**
 * The blunder warning: the line shown while the engine looks at a move the
 * player has committed to, and the question it comes back with.
 *
 * It stands with the board rather than in the panel with the rest of what
 * teaching offers, and it has to. The board is holding still and the move has
 * not been played, so a player who cannot see what is being waited for reads the
 * page as stuck — and the panel is folded away on a phone until the player opens
 * it, which is exactly where a question nobody can see would end up.
 *
 * Being asked is the whole of it: standing by the move plays it, and declining
 * leaves the board exactly as it stood, down to the piece the player had picked
 * up. Neither answer is the safe one, so neither is given the weight of being
 * the default.
 */
export const BlunderWarning = ({
  teaching,
  checking,
  warned,
  onPlayAnyway,
  onThinkAgain,
}: BlunderWarningProps) => {
  const strings = useStrings();

  return (
    <>
      {teaching && checking && (
        <p className="blunder-check" data-testid="checking">
          {strings.teaching.warning.checking}
        </p>
      )}

      {teaching && warned && (
        <p className="blunder-warning" data-testid="warning">
          <span className="blunder-warning__asks">{strings.teaching.warning.asks}</span>
          <button
            type="button"
            className="teaching__button"
            data-testid="play-anyway"
            onClick={onPlayAnyway}
          >
            {strings.teaching.warning.playAnyway}
          </button>
          <button
            type="button"
            className="teaching__button"
            data-testid="think-again"
            onClick={onThinkAgain}
          >
            {strings.teaching.warning.thinkAgain}
          </button>
        </p>
      )}
    </>
  );
};
