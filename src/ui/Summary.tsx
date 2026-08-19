import { GRADES, type Summary as SideSummary } from "../session/game-session";
import type { Strings } from "../strings";
import { useStrings } from "./language";

type SummaryProps = {
  /** What the game came to, one per side the engine graded a move of. */
  readonly summary: readonly SideSummary[];
  /**
   * Whether the game was played against the computer at full strength. A draw
   * there is the result a learner is playing for, and is worded as one.
   */
  readonly againstMaster: boolean;
};

/**
 * How the game ended for this side. A draw is never worded as a defeat, because
 * it is not one: neither side could win it, and against Mester it is the result
 * to aim at — which the second of the two drawn sentences says outright.
 *
 * Whether it was Mester is read off the difficulty the game ended at. A player
 * who changed difficulty mid-game is taken at their last word, which is the same
 * reading the rest of the interface gives that setting.
 */
const resultOf = ({ result }: SideSummary, againstMaster: boolean, strings: Strings): string =>
  result === "drawn" && againstMaster
    ? strings.teaching.summary.result.drawnAgainstMaster
    : strings.teaching.summary.result[result];

/**
 * The summary at the end of the game: what it came to for each side the engine
 * graded, how that side's moves were graded, and the one mistake it made more
 * than any other.
 *
 * There is one of these per side rather than one for the game, because teaching
 * is a setting and not a mode for one player: two people sharing a device are
 * both graded, and a single tally over the pair of them would name neither of
 * their weaknesses. Against the computer only one side is ever graded, so only
 * one block is ever drawn.
 *
 * The weakness is named as a thing rather than as a sentence about a move. The
 * line under a grade is about the move just played and reads wrong over a whole
 * game, so the criticisms have names of their own here — but they are the same
 * criticisms the engine detected, and nothing is named that it did not (ADR-0003).
 */
export const Summary = ({ summary, againstMaster }: SummaryProps) => {
  const strings = useStrings();

  return (
    <section className="summary" data-testid="summary">
      <h2 className="summary__heading">{strings.teaching.summary.heading}</h2>

      {summary.map((side) => (
        <article
          key={side.side}
          className="summary__side"
          data-testid="summary-side"
          data-side={side.side}
        >
          <h3 className="summary__who">{strings.game.side[side.side]}</h3>

          <p className="summary__result" data-testid="side-result" data-result={side.result}>
            {resultOf(side, againstMaster, strings)}
          </p>

          <dl className="summary__counts">
            {GRADES.map((grade) => (
              <div key={grade} className="summary__count">
                <dt>{strings.teaching.grade[grade]}</dt>
                <dd data-testid="grade-count" data-grade={grade}>
                  {side.counts[grade]}
                </dd>
              </div>
            ))}
            <div className="summary__count summary__count--all">
              <dt>{strings.teaching.summary.graded}</dt>
              <dd data-testid="graded-count">{side.graded}</dd>
            </div>
          </dl>

          <p className="summary__weakness" data-testid="weakness" data-weakness={side.weakness}>
            {side.weakness ? (
              <>
                <span className="summary__weakness-heading">
                  {strings.teaching.summary.weakness}
                </span>
                <span className="summary__weakness-name">
                  {strings.teaching.summary.criticism[side.weakness]}
                </span>
              </>
            ) : (
              strings.teaching.summary.noWeakness
            )}
          </p>
        </article>
      ))}
    </section>
  );
};
