import { SIDES, opponentOf } from "../engine/position";
import type { GameState, Result } from "../session/game-session";
import { strings } from "../strings";

type StatusProps = {
  /** What the game session says the game looks like now. */
  readonly game: GameState;
};

/**
 * How the game ended, in two lines: who won and the sentence about the side that
 * lost which says why, or — a draw having neither a winner nor an ending, which
 * is a thing only a loser is left in — that it was drawn and what drew it.
 */
const Ended = ({ result }: { readonly result: Result }) =>
  "draw" in result ? (
    <>
      <p className="status__result status__result--drawn" data-testid="result">
        {strings.game.result.draw}
      </p>
      <p className="status__drawn" data-testid="drawn">
        {strings.game.result.drawnBy[result.draw]}
      </p>
    </>
  ) : (
    <>
      <p className="status__result" data-testid="result">
        {strings.game.result.winner[result.winner]}
      </p>
      <p className="status__ending" data-testid="ending">
        {strings.game.result.ending[result.ending][opponentOf(result.winner)]}
      </p>
    </>
  );

/**
 * What the players need to know at a glance: the phase, whose turn it is, how
 * many pieces are still in hand, whether a capture is owed, and whether the
 * computer is thinking. Once the game is over, who won and what ended it stand
 * where the turn used to — a finished game has nobody to move.
 *
 * At a glance is not the only way it is read. A player working the board by
 * keyboard is not looking at this block when a mill of theirs closes and a
 * capture falls due, so it announces its own changes rather than waiting to be
 * found. Politely: the game is turn-based and nothing here is urgent enough to
 * cut across what the board has just said.
 *
 * Every word of it is the strings module's; the game session hands over the
 * phase, the side and the result as values (ADR-0002).
 */
export const Status = ({ game }: StatusProps) => (
  <section className="status" data-testid="status" aria-live="polite">
    <p className="status__phase" data-testid="phase">
      {strings.game.phase[game.phase]}
    </p>

    {game.result ? (
      <Ended result={game.result} />
    ) : (
      <p className="status__side-to-move" data-testid="side-to-move">
        {strings.game.toMove[game.sideToMove]}
      </p>
    )}

    {game.thinking && (
      <p className="status__thinking" data-testid="thinking">
        {strings.game.thinking}
      </p>
    )}

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
