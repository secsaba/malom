import { SIDES } from "../engine/position";
import type { GameState } from "../session/game-session";
import { strings } from "../strings";

type StatusProps = {
  /** What the game session says the game looks like now. */
  readonly game: GameState;
};

/**
 * What the players need to know at a glance: the phase, whose turn it is, how
 * many pieces are still in hand, and whether a capture is owed.
 *
 * Every word of it is the strings module's; the game session hands over the
 * phase and the side as values (ADR-0002).
 */
export const Status = ({ game }: StatusProps) => (
  <section className="status" data-testid="status">
    <p className="status__phase" data-testid="phase">
      {strings.game.phase[game.phase]}
    </p>

    <p className="status__turn" data-testid="turn">
      {strings.game.toMove[game.sideToMove]}
    </p>

    <h2 className="status__heading">{strings.game.piecesInHand}</h2>
    <dl className="status__hands">
      {SIDES.map((side) => (
        <div key={side} className="status__hand">
          <dt>{strings.game.side[side]}</dt>
          <dd data-testid="in-hand" data-side={side}>
            {game.piecesInHand[side]}
          </dd>
        </div>
      ))}
    </dl>

    {game.pendingCapture && (
      <p className="status__capture" data-testid="capture-prompt">
        {strings.game.capture}
      </p>
    )}
  </section>
);
