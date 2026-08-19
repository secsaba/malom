import type { ListedMove } from "../session/game-session";
import { useStrings } from "./language";
import { notationOf } from "./move-notation";

type MoveListProps = {
  /** Every move played out in the game, oldest first. */
  readonly moves: readonly ListedMove[];
  /** Which of them the player is looking back at, where they are looking at one. */
  readonly reviewing: number | undefined;
  readonly onReview: (move: number) => void;
  readonly onStopReviewing: () => void;
};

/**
 * The move list: the whole game in one column, each move in the notation it is
 * read out in with the grade it earned beside it, and every one of them a way
 * back into the position it produced.
 *
 * A learner told the verdict on one move at a time never sees the shape of their
 * game. The column is where the run of them becomes readable — three Súlyos
 * hiba in the placing phase is a thing to notice, and it cannot be noticed a
 * move at a time.
 *
 * The moves are numbered by the list itself rather than written out, because a
 * move's number is notation as its coordinates are: it reads the same in either
 * language, so there is nothing here for the strings module to word.
 *
 * A move being looked back at is marked as pressed rather than merely coloured
 * — it is a control the player has left switched on, and the way back to the
 * game sits under the column where they will look for it.
 */
export const MoveList = ({ moves, reviewing, onReview, onStopReviewing }: MoveListProps) => {
  const strings = useStrings();

  return (
    <section className="move-list" data-testid="move-list">
      <h2 className="move-list__heading">{strings.teaching.moveList.heading}</h2>

      <ol className="move-list__moves">
        {moves.map(({ move, by, grade }, played) => (
          <li key={played} className="move-list__move">
            <button
              type="button"
              className="move-list__played"
              data-testid="played-move"
              data-side={by}
              data-grade={grade}
              aria-pressed={played === reviewing}
              onClick={() => onReview(played)}
            >
              <span className="move-list__by">{strings.game.side[by]}</span>
              {/* Coordinates are notation rather than language (CONTEXT.md). */}
              <span className="move-list__notation">{notationOf(move)}</span>
              {grade && <span className="move-list__grade">{strings.teaching.grade[grade]}</span>}
            </button>
          </li>
        ))}
      </ol>

      {reviewing !== undefined && (
        <button
          type="button"
          className="teaching__button"
          data-testid="back-to-play"
          onClick={onStopReviewing}
        >
          {strings.teaching.moveList.backToPlay}
        </button>
      )}
    </section>
  );
};
