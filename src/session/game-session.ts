/**
 * The game session: one game of malom, and the only thing the interface talks
 * to. It takes intents — what the player tried to do — and exposes the state
 * they can see. The engine sits behind it as an internal.
 *
 * How a move is played is not here. `src/engine/game` plays whole moves; this
 * turns the taps an interface deals in into them. What it does keep is the rules
 * about a move being assembled — which piece has been picked up, and whether a
 * capture is still owed — because putting a piece down again is a step the rules
 * allow rather than a detail of any one interface.
 *
 * It is pure TypeScript over plain data, like the engine (ADR-0002): it returns
 * the phase, the pending capture and the result as values, and `src/ui` words
 * them in whichever language the player is reading.
 *
 * The computer is one of the two players rather than a thing beside the game: a
 * session is given a side for it and a function to ask for its moves, and takes
 * that side's turns itself. What the function does with the question — search it
 * here, post it to a Web Worker — is nothing this module knows, which is what
 * keeps the worker an adapter and everything behind it testable in-process.
 *
 * How strongly the computer plays is asked alongside the game rather than fixed
 * when the opponent was made, which is what lets a player change difficulty
 * without giving up the game in front of them. What a difficulty means is the
 * opponent's business; here it is a setting that outlives any one game, so
 * starting another leaves it exactly where the player put it.
 */

import type { PointId } from "../engine/board";
import {
  type Arrival,
  type Draw,
  type Game,
  type Move,
  NEW_GAME,
  PIECES_PER_SIDE,
  type Phase,
  type Result,
  afterArrival,
  afterMove,
  phaseOf,
} from "../engine/game";
import {
  type Ending,
  type Position,
  type Side,
  destinationsFrom,
  emptyPoints,
  movablePointsOf,
  opponentOf,
  pointsHeldBy,
  SIDES,
} from "../engine/position";
import { DEFAULT_DIFFICULTY, DIFFICULTIES, type Difficulty } from "../opponent/difficulty";
import type { Assessment } from "../teaching/assessment";
import { GRADES, type Grade } from "../teaching/grade";
import type { Pattern } from "../teaching/patterns";
import type { Reason } from "../teaching/reason";
import { type Summary, summariesOf } from "../teaching/summary";
import { type SavedGame, type SavedMove, type SavedSettings, playedBack } from "./saved-game";

export type {
  Assessment,
  Difficulty,
  Draw,
  Ending,
  Grade,
  Pattern,
  Phase,
  Reason,
  Result,
  SavedGame,
  SavedMove,
  SavedSettings,
  Summary,
};
// The interface offers the difficulties the facade accepts and lays the summary
// out in the five grades, and asks the facade for both rather than reaching past
// it to the opponent or to teaching (ADR-0002).
export { DIFFICULTIES, GRADES };

/**
 * What the computer is asked when its turn comes: the game as it stands and how
 * strongly to play it, for the whole move it would answer with. A game it has no
 * move in — one already over — is answered with nothing.
 *
 * It answers later rather than at once, because a search deep enough to be worth
 * playing is too slow to run between two frames.
 */
export type ChooseMove = (game: Game, difficulty: Difficulty) => Promise<Move | undefined>;

/**
 * What the engine is asked when the player wants a hint: the game as it stands,
 * for the move it prefers in it. No difficulty is passed, and that is the point
 * of it — a hint runs the engine at full strength however weakly the computer
 * has been asked to play (ADR-0001).
 *
 * Like the computer's move it answers later rather than at once, because the
 * search behind it is the same search.
 */
export type ChooseHint = (game: Game) => Promise<Move | undefined>;

/**
 * What the engine is asked once a player has played a move: the game as it stood
 * before the move and the whole move they played in it, for the grade, the
 * patterns and the reason it makes of it. Nothing, where there was nothing to
 * grade — a position the rules left one move in tells nobody anything about the
 * player who played it.
 *
 * Like a hint it runs at full strength however weakly the computer has been
 * asked to play (ADR-0001), and like a hint it answers later rather than at
 * once: the search behind it is the same search.
 */
export type AssessMove = (game: Game, move: Move) => Promise<Assessment | undefined>;

/** Who is playing: the side the computer takes, or nobody, for two people sharing a device. */
export type Players = {
  readonly opponentSide?: Side | undefined;
};

export type GameSessionOptions = {
  /** Asked for the computer's move. Without it, both sides are played by hand. */
  readonly chooseMove?: ChooseMove | undefined;
  /** Asked for the move a hint shows. Without it, no hint is ever on offer. */
  readonly chooseHint?: ChooseHint | undefined;
  /** Asked what the engine makes of a move just played. Without it, no move is ever graded. */
  readonly assessMove?: AssessMove | undefined;
  readonly players?: Players | undefined;
  /** How strongly the computer plays to begin with. */
  readonly difficulty?: Difficulty | undefined;
  /**
   * What the player has said about teaching, where they have said either way.
   * Without it nobody has said anything, and who is playing answers for them.
   */
  readonly teaching?: boolean | undefined;
  /** Whether a move is checked for a blunder before it is played. */
  readonly warnsOfBlunders?: boolean | undefined;
  /**
   * A game to go on with rather than a new one: the moves of a game read back
   * out of storage, which are played again from the start to arrive where it was
   * left. Where it is given it says who was playing, so {@link Players} is not
   * asked as well; where its moves are not moves the rules allow, it is turned
   * away whole and the session starts a new game.
   */
  readonly saved?: SavedGame | undefined;
};

/**
 * What a player tried to do. The spec sketches the facade's intents as place,
 * move and capture; selecting is the fourth, because picking a piece up is a
 * step a player can take back — tapping away puts it down again without moving
 * — and that is a rule rather than a detail of any one interface.
 *
 * These are gestures, not the glossary's Move: a whole turn is the place or the
 * move and the capture it may earn, which the session assembles from two of
 * these intents.
 */
export type Intent =
  | { readonly type: "place"; readonly point: PointId }
  | { readonly type: "select"; readonly point: PointId }
  /** Where the selected piece is to go. */
  | { readonly type: "move"; readonly point: PointId }
  | { readonly type: "capture"; readonly point: PointId };

/**
 * A piece taken off the board: where it stood, and whose it was. The side is
 * carried rather than looked up, because by the time anything reads this the
 * board no longer holds the piece to be asked about it.
 */
export type Capture = {
  readonly point: PointId;
  readonly side: Side;
};

/** What the session records as the game is played. */
type Recorded = {
  /** The game as the rules have it, up to the last move played out in full. */
  readonly game: Game;
  /** The piece the side to move has picked up, if it has picked one up. */
  readonly selection: PointId | undefined;
  /** The half-played move: a piece has arrived, and the mill it closed owes a capture. */
  readonly arrival: Arrival | undefined;
  /** Where the last piece to move came to rest, whoever moved it. */
  readonly lastArrival: Arrival | undefined;
  /**
   * The piece that move took off the board, where it took one. It runs in step
   * with {@link Recorded.lastArrival} rather than with {@link Recorded.lastMove}
   * — the two are halves of one move and are shown as one — so a move that
   * captured nothing clears it, and a capture still owed has not happened yet.
   */
  readonly lastCapture: Capture | undefined;
  /**
   * The last move played out in full, whoever played it — the capture it earned
   * included, which is what tells it from {@link Recorded.lastArrival}: an
   * arrival is recorded the moment the piece lands, and a move only once the
   * capture it owes has been taken.
   */
  readonly lastMove: Move | undefined;
};

/** How the game is being played, as against how it stands. */
type Playing = {
  readonly opponentSide: Side | undefined;
  readonly thinking: boolean;
  readonly difficulty: Difficulty;
};

/** A hint the player asked for: the move the engine prefers, and the game it was asked about. */
type Hint = {
  readonly about: Game;
  readonly move: Move;
};

/** What teaching makes of the game, as against how the game stands. */
type Teaching = {
  /** Whether teaching is on. */
  readonly on: boolean;
  /** Whether there is an engine to ask for a hint: a session given none offers none. */
  readonly hasEngine: boolean;
  /** The hint the engine has answered with, for as long as it is about this position. */
  readonly hint: Hint | undefined;
  /** Whether the engine is working one out. */
  readonly hinting: boolean;
  /**
   * What the engine made of the last move a player played. It is held against
   * the move rather than against the position, which is what keeps it in front
   * of the player while the computer answers: the reply is not their move, and
   * says nothing about it.
   */
  readonly assessment: Assessment | undefined;
  /** Whether the engine is still working out what to make of the move just played. */
  readonly assessing: boolean;
};

/**
 * A move the player has committed to and the game has not: it is held off the
 * board while the engine says whether it is a blunder, and then while the player
 * answers for the one it calls a blunder.
 */
type Held = {
  /** Where the move was played from — what a takeback of it would return to. */
  readonly from: Recorded;
  /** Where it leaves the game, once the player stands by it. */
  readonly next: Recorded;
  /** What the engine made of it, once it has said. A held move it has judged is a blunder. */
  readonly assessment: Assessment | undefined;
};

/**
 * What a player's second thoughts about a move have to work with, as against how
 * the game stands: the decisions they can go back to, and the move they have
 * committed to and not yet played.
 *
 * The two are one thing here because they are one thing to a learner — second
 * thoughts after the move, and second thoughts before it. Both are teaching's
 * own, both are about a move rather than about the position, and a move waiting
 * on the player is the one state in which neither is on offer.
 */
type SecondThoughts = {
  /**
   * Where the game has stood before each whole move played in it, oldest first
   * — the computer's moves as well as the player's, because a takeback steps
   * back past the computer's reply on its way to the player's own decision.
   *
   * It is written down whether or not teaching is on. What teaching gates is the
   * offer of a takeback, not the recording of one, so a player who switches
   * teaching on halfway through a game can still take back the moves they played
   * before they switched it on.
   */
  readonly history: readonly Recorded[];
  /**
   * Where the move being assembled started. An arrival has overwritten what a
   * takeback would return to by the time the capture it owes plays the move out,
   * so the state the piece was sent from is kept here from the tap that sent it
   * until the tap that finishes the move.
   */
  readonly startedFrom: Recorded;
  /** Whether a move is checked before it is played, so a blunder can be asked about. */
  readonly warns: boolean;
  /** The move waiting on the engine, and then on the player. */
  readonly held: Held | undefined;
};

/**
 * A move the game has played out, as the record keeps it: the move itself, the
 * side that played it, the game it led to — which is the position a player
 * looking back at it is shown — and what the engine made of it, once it has said.
 */
type Played = {
  readonly move: Move;
  readonly by: Side;
  readonly game: Game;
  readonly assessment: Assessment | undefined;
};

/**
 * The record of the game: every move played out in it, oldest first, and the one
 * the player has gone back to look at.
 *
 * It runs in step with {@link SecondThoughts.history}. Both are appended to
 * exactly once per whole move and in the same two places, so the move at `n` is
 * the move played from the state at `n`, and a takeback that leaves a prefix of
 * the history behind leaves the same prefix of the moves with it.
 *
 * Like the history it is written down whether or not teaching is on: what
 * teaching gates is the offer, not the recording, so a player who switches it on
 * halfway through a game is shown every move of it rather than only the ones
 * played since. The moves played before carry no grade — nothing was ever asked
 * about them — and are listed without one.
 */
type MoveList = {
  readonly moves: readonly Played[];
  /**
   * Which move of the list the player is looking back at. Nothing, while they
   * are watching the game itself — which is where a game starts and where every
   * game they have not gone back into stays.
   */
  readonly reviewing: number | undefined;
};

/** A move as the move list shows it: what was played, by whom, and what it earned. */
export type ListedMove = {
  readonly move: Move;
  readonly by: Side;
  /**
   * What the engine graded it, where there was teaching to ask and it had
   * anything to say. The computer's own moves have none, and neither do the
   * moves the rules left no choice about.
   */
  readonly grade: Grade | undefined;
};

/** Everything a player can see about the game: what is recorded, and what follows from it. */
export type GameState = {
  readonly position: Position;
  readonly sideToMove: Side;
  readonly phase: Phase;
  readonly piecesInHand: Readonly<Record<Side, number>>;
  readonly pendingCapture: boolean;
  readonly selection: PointId | undefined;
  readonly result: Result | undefined;
  /**
   * The points the side to move may act on: the pieces it may capture while one
   * is owed, the points it may place on, the points the selected piece may go
   * to, and otherwise the pieces it may pick up. Nothing, once the game is over,
   * and nothing while the computer is the side to move — its turn is not the
   * player's to take.
   */
  readonly legalPoints: readonly PointId[];
  /** The side the computer is playing, where it is playing. */
  readonly opponentSide: Side | undefined;
  /** Whether the computer is choosing its move. */
  readonly thinking: boolean;
  /** How strongly the computer is playing, whether or not it is playing at all. */
  readonly difficulty: Difficulty;
  /** Whether the game is being played with teaching on. */
  readonly teaching: boolean;
  /**
   * The move the engine prefers, once the player has asked for it — the whole
   * move, the capture it earns included, because that is what the engine
   * preferred. Nothing, until they ask, and nothing once the position it was
   * about has been left behind.
   */
  readonly hint: Move | undefined;
  /** Whether the engine is working a hint out. */
  readonly hinting: boolean;
  /**
   * Whether a hint is the player's to ask for. Teaching being on is not enough:
   * a hint is about the move somebody is looking at, and on the computer's turn
   * or in a finished game there is no such move.
   */
  readonly hintOffered: boolean;
  /**
   * What the engine made of the last move a player played, once it has said —
   * nothing until the answer comes back, nothing where the rules left no choice
   * to grade, and nothing about the computer's own moves, which are not the
   * player's to learn from.
   */
  readonly grade: Grade | undefined;
  /**
   * The one thing the player is told about that move, beside the grade: a
   * pattern the engine detected, or the move it would have played instead. It is
   * data rather than a sentence, and `src/ui` words it (ADR-0002).
   */
  readonly reason: Reason | undefined;
  /**
   * Everything the engine detected in that move, ranked, and not only the one
   * the reason names. Empty where there is nothing to say — including while the
   * answer is still on its way.
   */
  readonly patterns: readonly Pattern[];
  /** Whether the engine is still working out what to make of the move just played. */
  readonly assessing: boolean;
  /**
   * Whether a move is the player's to take back: teaching is on, and the game
   * has stood somewhere the player themselves had the move. Nothing is on offer
   * in a game whose only earlier positions are ones the computer was to move in
   * — its own opening move is not the player's to take back.
   */
  readonly takebackOffered: boolean;
  /** Whether a move is checked before it is played, so a blunder can be asked about. */
  readonly warnsOfBlunders: boolean;
  /**
   * Whether the move the player has committed to is being checked. The board
   * still stands where it stood: the move is theirs until they stand by it.
   */
  readonly checking: boolean;
  /** Whether the player is being asked to stand by a move the engine calls a blunder. */
  readonly warned: boolean;
  /**
   * Every move played out in the game, oldest first, each with the grade it
   * earned. It is the game's own record and not teaching's, so it is there
   * whether or not teaching is on; what a move is written down as is `src/ui`'s
   * business, which is where the notation lives.
   */
  readonly moves: readonly ListedMove[];
  /**
   * Which move of that list the player is looking back at, where they are
   * looking back at one. While they are, the board shows the position that move
   * produced and nothing on it is theirs to act on.
   */
  readonly reviewing: number | undefined;
  /**
   * What the game came to, one summary per side the engine graded a move of.
   * Empty until the game is over, and empty in a game nobody was taught in.
   *
   * Its scope is this game and no other: another game started throws it away
   * with everything else, so nothing a player did before is counted against
   * them now.
   */
  readonly summary: readonly Summary[];
  /**
   * Where the last piece to move came to rest — the capture it may have earned
   * is not part of it — so the interface can bring it in from where it came
   * rather than have it appear. Nothing, in a game nobody has moved in yet.
   */
  readonly lastArrival: Arrival | undefined;
  /**
   * The piece that move took off the board, so the interface can leave a mark
   * where it stood rather than have it vanish. It lives exactly as long as
   * {@link GameState.lastArrival} does, because the two are halves of one move.
   * Nothing, where the move captured nothing, and nothing while a capture is
   * still owed — that piece is on the board until it is taken.
   */
  readonly lastCapture: Capture | undefined;
  /**
   * How many pieces each side has lost, which is the nine it started with less
   * the hand it has not placed from and the board it still holds. It is derived
   * from the position rather than tallied as the game goes, so a Review — which
   * puts back an earlier position and an earlier hand — rewinds it with them and
   * has nothing of its own to keep in step.
   */
  readonly captured: Readonly<Record<Side, number>>;
};

/** What the engine detected in a move it has nothing to say about. */
const NOTHING_DETECTED: readonly Pattern[] = [];

/** What has been taken off a board nothing has been taken off. */
const NOTHING_CAPTURED: Readonly<Record<Side, number>> = { light: 0, dark: 0 };

/**
 * How many pieces each side has lost, counted off the board rather than tallied
 * as the game goes: a side started with nine, and what it does not hold in its
 * hand or on the board has been taken off it. Counting it this way is what lets
 * a Review show the heaps as they stood — the position and the hand it puts back
 * are the whole of the answer, so there is no second tally to wind back with
 * them.
 */
const capturedIn = ({
  position,
  piecesInHand,
}: Pick<GameState, "position" | "piecesInHand">): Readonly<Record<Side, number>> =>
  Object.fromEntries(
    SIDES.map((side) => [
      side,
      PIECES_PER_SIDE - piecesInHand[side] - pointsHeldBy(position, side).length,
    ]),
  ) as Readonly<Record<Side, number>>;

/** What a game still being played has come to. */
const NOTHING_SUMMARISED: readonly Summary[] = [];

/** The record a game starts with: no moves in it, and nothing to look back at. */
const NOTHING_PLAYED: MoveList = { moves: [], reviewing: undefined };

/** Whether the game is waiting on the computer rather than on the player. */
const isOpponentToMove = (game: Game, opponentSide: Side | undefined): boolean =>
  opponentSide !== undefined && game.result === undefined && game.sideToMove === opponentSide;

const legalPointsOf = ({ game, selection, arrival }: Recorded): readonly PointId[] => {
  if (game.result) return [];
  if (arrival) return afterArrival(game, arrival).captures;
  if (game.placing) return emptyPoints(game.position);
  if (selection) return destinationsFrom(game.position, selection);
  return movablePointsOf(game.position, game.sideToMove);
};

/**
 * Whether the half-played move on the board is the one the hint named: the same
 * piece, sent to the same point.
 */
const arrivedAsHinted = (arrival: Arrival, { move }: Hint): boolean =>
  arrival.from === move.from && arrival.to === move.to;

/**
 * The hint as the player sees it: the move the engine came back with, for as
 * long as the game it was asked about is the game standing. A hint is about one
 * position and no other, so a move played after it takes it off the board rather
 * than leaving it up over a position nobody is looking at any more.
 *
 * A move being played out is the exception, and it has to be: a player who plays
 * what the hint named closes the mill it named, and the capture it earns is the
 * half of the move they have still to choose. Taking the hint off the board
 * there would take it away at the very moment its last half became the useful
 * one. An arrival somewhere else ends it as any other move does — what it said
 * about the piece to play no longer describes the piece that moved.
 */
const hintShown = ({ game, arrival }: Recorded, { on, hint }: Teaching): Move | undefined => {
  if (!on || hint === undefined || hint.about !== game) return undefined;

  return arrival === undefined || arrivedAsHinted(arrival, hint) ? hint.move : undefined;
};

/**
 * Whether a hint is the player's to ask for: teaching is on, there is an engine
 * to ask, and the move being looked at is the player's own. None is offered on
 * the computer's turn or in a game that is over, and none with a capture owed —
 * that is half a move, and the engine answers with whole ones.
 */
const hintIsOffered = (
  { game, arrival }: Recorded,
  { opponentSide }: Playing,
  { on, hasEngine }: Teaching,
  { held }: SecondThoughts,
): boolean =>
  on &&
  hasEngine &&
  held === undefined &&
  arrival === undefined &&
  game.result === undefined &&
  !isOpponentToMove(game, opponentSide);

/**
 * The state with nothing picked up. A takeback returns a player to a decision
 * rather than to the middle of one, so the piece they had in their hand when
 * they made the move goes back down with it.
 */
const withNothingPickedUp = (recorded: Recorded): Recorded =>
  recorded.selection === undefined ? recorded : { ...recorded, selection: undefined };

/**
 * Where a takeback lands, and the history left behind it: the last state the
 * player themselves had the move in, and everything before that one.
 *
 * Against the computer that is two plies rather than one — its reply and the
 * move that drew it — because a takeback that left the computer to move would
 * play the reply again and hand the board straight back with the mistake still
 * on it. Where every state further back is one of the computer's, there is
 * nowhere to go: the game's opening move is the computer's own.
 */
const takenBackTo = (
  recorded: Recorded,
  { history, startedFrom }: SecondThoughts,
  { opponentSide }: Playing,
): { readonly to: Recorded; readonly earlier: readonly Recorded[] } | undefined => {
  // A move only half played goes back no further than the tap that sent the
  // piece: the arrival is the player's own decision, and it is the one they are
  // taking back. Anything further would take the move before it back as well.
  if (recorded.arrival !== undefined) return { to: startedFrom, earlier: history };

  for (let step = history.length - 1; step >= 0; step -= 1) {
    const at = history[step];
    if (at !== undefined && !isOpponentToMove(at.game, opponentSide)) {
      return { to: at, earlier: history.slice(0, step) };
    }
  }

  return undefined;
};

/**
 * Whether a move is the player's to take back. It is teaching's own, and it is
 * not on offer while a move is waiting on them — that one is answered by
 * standing by it or thinking again, not by going back past it.
 *
 * A game that is over is not the exception it looks like. That is exactly where
 * a learner wants a takeback: the move they lost by is the move they most want
 * to play again.
 */
const takebackIsOffered = (
  recorded: Recorded,
  secondThoughts: SecondThoughts,
  playing: Playing,
  { on }: Teaching,
): boolean =>
  on && secondThoughts.held === undefined && takenBackTo(recorded, secondThoughts, playing) !== undefined;

/** The move the player has gone back to look at, where they have gone back to one. */
const reviewedIn = ({ moves, reviewing }: MoveList): Played | undefined =>
  reviewing === undefined ? undefined : moves[reviewing];

/**
 * What the player sees instead while they are looking back at a move: the
 * position it produced, the game as it stood there, and what the engine made of
 * that move rather than of the last one played.
 *
 * Everything the live board offers is withdrawn, and it has to be: the game is
 * somewhere else, so there is nothing on this board to pick up, to be hinted
 * about or to take back. What is not withdrawn is the result — a player looks
 * back at their game most of all once it is over, and taking the ending away
 * while they read it would take the summary of it away with it.
 */
const lookingBackAt = (
  { move, by, game, assessment }: Played,
  taught: boolean,
): Partial<GameState> => ({
  position: game.position,
  sideToMove: game.sideToMove,
  phase: phaseOf(game),
  piecesInHand: game.piecesInHand,
  pendingCapture: false,
  selection: undefined,
  legalPoints: [],
  hint: undefined,
  hintOffered: false,
  takebackOffered: false,
  grade: taught ? assessment?.grade : undefined,
  reason: taught ? assessment?.reason : undefined,
  patterns: taught ? (assessment?.patterns ?? NOTHING_DETECTED) : NOTHING_DETECTED,
  assessing: false,
  lastArrival: { from: move.from, to: move.to },
  // The mark the move left goes back with the board it left it on. What the
  // heaps held then needs nothing here: they are counted off the position and
  // the hand, and both of those have just been put back.
  lastCapture:
    move.capture === undefined ? undefined : { point: move.capture, side: opponentOf(by) },
});

// What the players see is spelled out rather than spread from what is recorded,
// so that a state built from an earlier one cannot smuggle a stale set of legal
// points through with it. The one thing laid over it is a move being looked back
// at, and that is spelled out in full too.
const stateOf = (
  recorded: Recorded,
  playing: Playing,
  teaching: Teaching,
  secondThoughts: SecondThoughts,
  list: MoveList,
): GameState => {
  const { opponentSide, thinking, difficulty } = playing;
  const { held } = secondThoughts;
  const { game, selection, arrival, lastArrival } = recorded;
  const reviewed = reviewedIn(list);
  const assessment = teaching.on ? teaching.assessment : undefined;
  // A piece that has arrived is on the board and out of its hand from the moment
  // it lands, so what the players see mid-move is the arrival, not the game the
  // capture it owes will complete.
  const arrived = arrival && afterArrival(game, arrival);

  const shown: GameState = {
    position: arrived?.position ?? game.position,
    sideToMove: game.sideToMove,
    phase: phaseOf(game),
    piecesInHand: arrived?.piecesInHand ?? game.piecesInHand,
    pendingCapture: arrived !== undefined,
    selection,
    result: game.result,
    // The computer's turn is not the player's to take, so there is nothing to
    // offer them while it is thinking about it — and neither is the board, while
    // a move of their own is waiting on them.
    legalPoints:
      held !== undefined || isOpponentToMove(game, opponentSide) ? [] : legalPointsOf(recorded),
    opponentSide,
    thinking,
    difficulty,
    teaching: teaching.on,
    hint: hintShown(recorded, teaching),
    hinting: teaching.hinting,
    hintOffered: hintIsOffered(recorded, playing, teaching, secondThoughts),
    grade: assessment?.grade,
    reason: assessment?.reason,
    patterns: assessment?.patterns ?? NOTHING_DETECTED,
    assessing: teaching.assessing,
    takebackOffered: takebackIsOffered(recorded, secondThoughts, playing, teaching),
    warnsOfBlunders: secondThoughts.warns,
    // A held move the engine has judged is one it called a blunder, so what it
    // has said is exactly what tells the two apart: still being checked, or back
    // with the player to answer for.
    checking: held !== undefined && held.assessment === undefined,
    warned: held?.assessment !== undefined,
    moves: list.moves.map(({ move, by, assessment }) => ({ move, by, grade: assessment?.grade })),
    reviewing: reviewed === undefined ? undefined : list.reviewing,
    // A game still being played has come to nothing yet, so there is nothing to
    // count. Counting it as the game went would be a running tally rather than a
    // summary, and a player watching one climb is being graded twice per move.
    summary: game.result === undefined ? NOTHING_SUMMARISED : summariesOf(game.result, list.moves),
    lastArrival,
    lastCapture: recorded.lastCapture,
    // Overwritten below off whichever position and hand come out of the review.
    captured: NOTHING_CAPTURED,
    ...(reviewed === undefined ? {} : lookingBackAt(reviewed, teaching.on)),
  };

  return { ...shown, captured: capturedIn(shown) };
};

/**
 * Whether a game is played with teaching on: what the player asked for, or —
 * where they have asked for nothing — who is playing. A player who has sat down
 * against the computer is learning; two people sharing a device have not asked
 * to be taught.
 */
const taughtIn = (opponentSide: Side | undefined, taught: boolean | undefined): boolean =>
  taught ?? opponentSide !== undefined;

const NEW_SESSION: Recorded = {
  game: NEW_GAME,
  selection: undefined,
  arrival: undefined,
  lastArrival: undefined,
  lastCapture: undefined,
  lastMove: undefined,
};

/**
 * A piece has arrived on a point — put there or moved there — so the mill it may
 * have closed decides whether the move is over or a capture is owed.
 */
const afterSending = (recorded: Recorded, arrival: Arrival): Recorded => {
  const { game, lastMove } = recorded;

  // A move closing two mills still earns one capture: the debt is owed, not counted.
  // Either way the mark on the board starts again from this arrival, so whatever
  // the move before it took is cleared here rather than when this move is played
  // out: the ring has already moved on, and the two travel together.
  return afterArrival(game, arrival).captures.length > 0
    ? { game, selection: undefined, arrival, lastArrival: arrival, lastCapture: undefined, lastMove }
    : {
        game: afterMove(game, arrival),
        selection: undefined,
        arrival: undefined,
        lastArrival: arrival,
        lastCapture: undefined,
        lastMove: arrival,
      };
};

/** The capture the arrival owed has been taken, so the move is played out in full. */
const afterCapturing = (game: Game, arrival: Arrival, point: PointId): Recorded => {
  const move: Move = { ...arrival, capture: point };

  return {
    game: afterMove(game, move),
    selection: undefined,
    arrival: undefined,
    lastArrival: arrival,
    // Whose piece it was is recorded now, while the board still holds it: a
    // capture is always of the side not to move, and the move is not over yet.
    lastCapture: { point, side: opponentOf(game.sideToMove) },
    lastMove: move,
  };
};

/**
 * What a whole move took off the board, asked of the game it was played in
 * rather than the one it led to — the piece is gone from the second of those,
 * and whose it was is the half the mark on the board is drawn in.
 */
const captureIn = (before: Game, move: Move): Capture | undefined =>
  move.capture === undefined
    ? undefined
    : { point: move.capture, side: opponentOf(before.sideToMove) };

/**
 * Where a whole move leaves the game, with no half of it left over: nothing
 * picked up and no capture owed, because the move arrived already decided. The
 * game passed is the one the move led to rather than the one it was played in.
 */
const restedAt = (before: Game, after: Game, move: Move): Recorded => ({
  game: after,
  selection: undefined,
  arrival: undefined,
  lastArrival: { from: move.from, to: move.to },
  lastCapture: captureIn(before, move),
  lastMove: move,
});

/**
 * The move the computer chose, played out whole — the capture it earned
 * included. A player assembles a move out of taps and can put a piece back down
 * in the middle of it; the computer arrives at one already decided, so there is
 * no half of it for anyone to see.
 */
const afterChoosing = (game: Game, move: Move): Recorded =>
  restedAt(game, afterMove(game, move), move);

/**
 * Picking a piece up, or putting the one already picked up back down: only a
 * piece of the side to move that has somewhere to go is picked up, and tapping
 * anywhere else — the piece itself included — is how a player changes their
 * mind. Nothing is picked up while pieces are still being placed.
 */
const afterSelecting = (recorded: Recorded, point: PointId): Recorded => {
  const { game, selection } = recorded;
  if (game.placing) return recorded;

  const picked =
    point !== selection && movablePointsOf(game.position, game.sideToMove).includes(point)
      ? point
      : undefined;

  return picked === selection ? recorded : { ...recorded, selection: picked };
};

/**
 * The game an intent leads to, or the game itself when the intent is not a
 * legal one — an illegal intent is ignored rather than refused, so the
 * interface can offer a tap on any point and let the rules decide.
 */
const nextRecorded = (recorded: Recorded, intent: Intent): Recorded => {
  const { game, selection, arrival } = recorded;
  if (game.result) return recorded; // a finished game answers nothing

  // While a capture is owed it is the only thing that can be played, and there
  // is nothing to capture at any other time.
  if (intent.type === "capture" ? arrival === undefined : arrival !== undefined) return recorded;

  // Picking up is the one intent a point outside the legal ones still answers:
  // tapping away from the selected piece is what puts it down again.
  if (intent.type === "select") return afterSelecting(recorded, intent.point);

  if (!legalPointsOf(recorded).includes(intent.point)) return recorded;

  switch (intent.type) {
    case "place":
      return afterSending(recorded, { to: intent.point });
    case "move":
      // Nothing is on its way anywhere until a piece has been picked up.
      return selection ? afterSending(recorded, { from: selection, to: intent.point }) : recorded;
    case "capture":
      // The guard above has already established that a capture is owed, which is
      // to say that a piece has arrived and is waiting on it.
      return arrival ? afterCapturing(game, arrival, intent.point) : recorded;
  }
};

export type GameSession = {
  readonly state: GameState;
  /**
   * The game as storage should keep it, so that a reload does not cost the
   * player the game in front of them. It is the moves and who was playing, and
   * reading it back plays them again (see `./saved-game`).
   *
   * Where it goes is not the session's business (ADR-0002): `src/ui` writes it
   * down, and hands it back through {@link GameSessionOptions.saved}.
   */
  readonly saved: SavedGame;
  /**
   * The settings, which outlive the game they were set during — what to hand
   * back to the session a later visit starts.
   */
  readonly settings: SavedSettings;
  /**
   * Play an intent. An illegal one leaves the state exactly as it was, and so
   * does any of them while the computer is the side to move.
   */
  readonly apply: (intent: Intent) => void;
  /** Watch for state changes. Returns the function that stops watching. */
  readonly subscribe: (listener: () => void) => () => void;
  /**
   * Throw the game away and start another one, played by whoever is given —
   * which is how a rematch swaps the sides over. The difficulty is a setting
   * rather than part of a game, and carries over untouched.
   */
  readonly start: (players: Players) => void;
  /**
   * Change how strongly the computer plays. The game in progress carries on: a
   * player who finds the opponent too hard or too easy meets a different one
   * from its next move rather than starting again. A move already being thought
   * about was asked for at the old difficulty and arrives at it.
   */
  readonly playAt: (difficulty: Difficulty) => void;
  /**
   * Switch teaching on or off. Like difficulty it takes effect at once and
   * outlives the game it was asked for: a player who has said either way is
   * taken at their word in every game after this one.
   */
  readonly teach: (on: boolean) => void;
  /**
   * Ask the engine what it would play here. The answer comes back later and
   * lands on the state as the hint; asking again while it is being worked out
   * changes nothing, and asking when no hint is on offer does nothing at all.
   */
  readonly askForHint: () => void;
  /**
   * Take the last move back, returning the game to the player's own decision
   * point — two plies against the computer, so that its reply goes back with the
   * move that drew it and the player is never handed a board it is to move in.
   *
   * It is teaching's own and it is unlimited: a learner working out why the
   * better move was better is not on a budget. Asking when there is nothing to
   * go back to does nothing at all.
   */
  readonly takeBack: () => void;
  /**
   * Look back at the position a move of this game produced, naming the move by
   * where it stands in the move list. The game itself is left exactly where it
   * stood: nothing on the board being shown is the player's to act on, and
   * everything comes back the moment they do.
   *
   * Asking about a move that was never played does nothing at all, and neither
   * does asking while a move of the player's own is waiting on them.
   */
  readonly review: (move: number) => void;
  /** Come back to the game itself, whether or not it was being looked away from. */
  readonly stopReviewing: () => void;
  /**
   * Ask to be warned before a blunder, or stop asking. It is off until the
   * player asks for it — a learner stopped at every move never has to think for
   * themselves — and, like teaching, it outlives the game it was asked for.
   */
  readonly warnOfBlunders: (on: boolean) => void;
  /** Play the move the warning asked about. What the engine said of it stands as its grade. */
  readonly playAnyway: () => void;
  /** Take that move off the table again: the board is left exactly as it stood. */
  readonly thinkAgain: () => void;
};

/** Start a game. */
export const createGameSession = ({
  chooseMove,
  chooseHint,
  assessMove,
  players = {},
  difficulty = DEFAULT_DIFFICULTY,
  teaching: chosen,
  warnsOfBlunders = false,
  saved,
}: GameSessionOptions = {}): GameSession => {
  // A game read back out of storage is played again from its first move, which
  // is what gives back the history a takeback walks and the record the summary
  // counts. One that cannot be played again — a move the rules do not allow, in
  // a game somebody has edited — is not read back at all, and the player is
  // handed a new one instead of a board they may not be able to move on.
  const restored = saved === undefined ? undefined : playedBack(saved);
  const opponentSide = restored === undefined ? players.opponentSide : saved?.opponentSide;

  let recorded = NEW_SESSION;
  const restoredHistory: Recorded[] = [];
  const restoredMoves: Played[] = [];

  // The game is walked forward exactly as playing it walks it: each move goes
  // into the record alongside the state it was played from going into the
  // history, which is what keeps the two in step and a takeback honest.
  for (const { move, by, game, assessment } of restored ?? []) {
    restoredHistory.push(recorded);
    restoredMoves.push({ move, by, game, assessment });
    // The game before the move is the one the walk has reached; the one the
    // record carries is where the move left it.
    recorded = restedAt(recorded.game, game, move);
  }

  // Whether the player has said either way about teaching. Until they have, who
  // is playing answers for them, which is why this is not simply a boolean: a
  // player who switched it on in a hotseat game means it, and a player who has
  // never touched it means nothing at all.
  let chosenTeaching: boolean | undefined = chosen;
  let playing: Playing = { opponentSide, thinking: false, difficulty };
  let teaching: Teaching = {
    on: taughtIn(opponentSide, chosenTeaching),
    hasEngine: chooseHint !== undefined,
    hint: undefined,
    hinting: false,
    // A move graded while the page was being closed is a grade nobody ever saw
    // and nobody gets back: the record keeps what the engine said about the
    // moves it answered for, and a move it never answered for is read back
    // ungraded, exactly as a move played before teaching was switched on is.
    assessment: undefined,
    assessing: false,
  };
  let secondThoughts: SecondThoughts = {
    history: restoredHistory,
    startedFrom: recorded,
    warns: warnsOfBlunders,
    held: undefined,
  };
  let list: MoveList = { moves: restoredMoves, reviewing: undefined };
  let state = stateOf(recorded, playing, teaching, secondThoughts, list);
  const listeners = new Set<() => void>();

  // How many times the game in front of the player has been put aside — another
  // one started, or a move taken back. A search still running when one of those
  // happens answers all the same, and this is what tells that answer from one
  // worth acting on.
  let putAside = 0;

  const publish = () => {
    state = stateOf(recorded, playing, teaching, secondThoughts, list);
    for (const listener of listeners) listener();
  };

  /**
   * Whether the player is looking back at a move rather than at the game. The
   * board they are being shown is not the one the game is on, so nothing that
   * acts on the game answers while it stands.
   */
  const isLookingBack = () => list.reviewing !== undefined;

  /**
   * Come back to the game itself. It is not only the player's to ask for: the
   * move list is teaching's, so switching teaching off takes away the way back
   * and the game has to be handed over rather than left on a board nobody can
   * play or leave.
   */
  const watchTheGame = () => {
    if (!isLookingBack()) return;

    list = { ...list, reviewing: undefined };
  };

  /**
   * A whole move goes into the record, alongside the state it was played from
   * going into the history: the two are appended to together, here and in the
   * computer's own answer, and nowhere else. That is what lets a takeback
   * truncate the one by the length of the other.
   */
  const record = (move: Move, by: Side, game: Game, assessment: Assessment | undefined) => {
    list = { ...list, moves: [...list.moves, { move, by, game, assessment }] };
  };

  /**
   * Write what the engine said into the move it was said about, wherever that
   * move now stands in the record. It is written by the move rather than by when
   * the question was asked, because an answer that is stale for the line in
   * front of the player is still true of the move it is about — and it is
   * written only while that move is still the one standing there, so a takeback
   * that took the move out of the game takes its answer with it.
   */
  const remember = (at: number, move: Move, assessment: Assessment | undefined): boolean => {
    if (assessment === undefined || list.moves[at]?.move !== move) return false;

    list = {
      ...list,
      moves: list.moves.map((played, index) => (index === at ? { ...played, assessment } : played)),
    };

    return true;
  };

  /**
   * Ask the computer for its move, where the game is waiting on one. The answer
   * comes back later, so this returns long before the move is played.
   */
  const think = () => {
    if (chooseMove === undefined) return;
    if (playing.thinking || !isOpponentToMove(recorded.game, playing.opponentSide)) return;

    const asked = putAside;
    const from = recorded;
    const thought = recorded.game;
    playing = { ...playing, thinking: true };

    const played = (move: Move | undefined) => {
      if (asked !== putAside) return; // the game has moved on without this answer

      playing = { ...playing, thinking: false };
      // The computer's move goes into the history as a player's does: it is what
      // a takeback steps back past on its way to the player's own decision.
      if (move) {
        secondThoughts = { ...secondThoughts, history: [...secondThoughts.history, from] };
        recorded = afterChoosing(thought, move);
        // Its moves are in the list as the player's are: a move list that showed
        // one side of a game would be half a game to read back.
        record(move, thought.sideToMove, recorded.game, undefined);
      }
      publish();
    };

    // A search that fails is a computer with no move to play: the game stays
    // where it stood, with the move still its own. There is nowhere here to say
    // so, and the interface reads a computer that has stopped thinking.
    void chooseMove(thought, playing.difficulty).then(played, () => played(undefined));
  };

  // How many moves have been sent to be graded. An answer to any but the last of
  // them is about a move the player has already moved on from.
  let assessmentsAsked = 0;

  /**
   * Send a move a player has just made to be assessed, where teaching is on and
   * there is an engine to send it to. The answer comes back later, so this
   * returns long before there is a verdict to show — and the one the player was
   * looking at goes now rather than then, because it was about the move before
   * this one.
   *
   * Only the moves a player makes come through here. The computer's own arrive
   * by another road, and assessing them would teach nobody anything.
   */
  const assess = (about: Game, move: Move) => {
    if (assessMove === undefined || !teaching.on) return;

    const asked = putAside;
    assessmentsAsked += 1;
    const question = assessmentsAsked;
    // Where the move stands in the record. It is already in it: a move is played
    // before it is sent to be graded.
    const at = list.moves.length - 1;
    teaching = { ...teaching, assessing: true, assessment: undefined };

    const graded = (answer: Assessment | undefined) => {
      // The record keeps the answer whichever of the guards below turn it away:
      // what the engine made of a move is true of that move however much of the
      // game has happened since. So an answer that is stale in front of the
      // player still changes the move list, and is still published.
      const remembered = remember(at, move, answer);

      // The game has moved on without this answer, or another move has been
      // played since and this one is about neither of them.
      if (asked !== putAside || question !== assessmentsAsked) {
        if (remembered) publish();
        return;
      }

      // A search that fails and a move there was nothing to say about come to
      // the same thing: the player is left with no assessment. So does an answer to a
      // question they have withdrawn by switching teaching off while it was
      // being worked out.
      teaching = { ...teaching, assessing: false, assessment: teaching.on ? answer : undefined };
      publish();
    };

    void assessMove(about, move).then(graded, () => graded(undefined));
  };

  /**
   * A whole move is played out: the state it was played from goes into the
   * history, and the game moves on.
   */
  const play = (from: Recorded, next: Recorded, assessment?: Assessment | undefined) => {
    secondThoughts = { ...secondThoughts, history: [...secondThoughts.history, from], held: undefined };
    // A move checked before it was played arrives with what the engine made of
    // it; one graded after it is played is written into the record when the
    // answer comes back.
    if (next.lastMove) record(next.lastMove, from.game.sideToMove, next.game, assessment);
    recorded = next;
    // The computer is asked before the engine is: the two think in the same
    // thread, and the move somebody is waiting for goes first.
    think();
  };

  /** Play a move the player was being asked to stand by, however the asking ended. */
  const playHeld = () => {
    const { held } = secondThoughts;
    if (held === undefined) return;

    play(held.from, held.next, held.assessment);
    teaching = { ...teaching, assessing: false, assessment: held.assessment };
  };

  /**
   * Put a move to the engine before it is played, so that a blunder can be asked
   * about rather than merely reported afterwards. Nothing goes onto the board
   * while it thinks: the move is still the player's until they stand by it.
   *
   * It is the grading run early rather than a second opinion — the same
   * question, about the same move in the same position — so the answer it comes
   * back with stands as the move's grade the moment the move is played, and no
   * second search is ever run.
   *
   * Only a blunder comes back to the player. A move the engine had nothing to
   * say about and a search that failed are both played: a check that cannot say
   * a move is a blunder has not said it is one.
   */
  const check = (from: Recorded, next: Recorded, about: Game, move: Move) => {
    if (assessMove === undefined) return;

    const asked = putAside;
    // A check is a move sent to be graded, and is counted as one: a move played
    // out from under a check that was still running — by teaching or the warning
    // itself being switched off — leaves an answer behind that must not land on
    // the move played after it. Nothing can be sent while a move is held, so an
    // answer to a move still held is never a stale one.
    assessmentsAsked += 1;
    const question = assessmentsAsked;
    secondThoughts = { ...secondThoughts, held: { from, next, assessment: undefined } };
    // What was said about the move before this one stands until this one is
    // played. Nothing has gone onto the board yet, so a player who thinks again
    // is left looking at exactly what they were looking at.
    teaching = { ...teaching, assessing: true };

    const answered = (assessment: Assessment | undefined) => {
      if (asked !== putAside) return; // the game has moved on without this answer
      if (question !== assessmentsAsked) return; // and another move has been graded since

      const { held } = secondThoughts;

      if (held !== undefined && assessment?.grade === "blunder") {
        secondThoughts = { ...secondThoughts, held: { ...held, assessment } };
        teaching = { ...teaching, assessing: false };
        publish();
        return;
      }

      // The move goes onto the board, whether it is still held or was played
      // while the answer was on its way — by teaching or the warning itself
      // being switched off, either of which plays a move rather than taking it
      // away from the player who committed to it.
      if (held !== undefined) play(held.from, held.next, assessment);
      teaching = {
        ...teaching,
        assessing: false,
        assessment: teaching.on ? assessment : undefined,
      };
      publish();
    };

    void assessMove(about, move).then(answered, () => answered(undefined));
  };

  // A game the computer opens is under way from the moment it is created.
  think();
  publish();

  return {
    get state() {
      return state;
    },

    get saved() {
      // Half a move is left out: a piece picked up, a piece that has landed with
      // the capture it earned still owed, and a move held for the player to
      // stand by are none of them in the record, so a reload puts the player
      // back at the start of the turn they were in the middle of.
      return {
        opponentSide: playing.opponentSide,
        moves: list.moves.map(({ move, assessment }) => ({ move, assessment })),
      };
    },

    get settings() {
      return {
        difficulty: playing.difficulty,
        teaching: chosenTeaching,
        warnsOfBlunders: secondThoughts.warns,
      };
    },

    apply: (intent) => {
      // A move waiting on the player is the only thing there is for them to
      // answer, and it is not answered by tapping the board.
      if (secondThoughts.held !== undefined) return;
      // Neither is the board being looked back at the board the game is on.
      if (isLookingBack()) return;
      if (isOpponentToMove(recorded.game, playing.opponentSide)) return;

      const next = nextRecorded(recorded, intent);
      if (next === recorded) return;

      // A move is over exactly when the game moves on, and the game it moved on
      // from is the position the move has to be graded in.
      const played = next.game === recorded.game ? undefined : next.lastMove;
      const about = recorded.game;
      const from =
        recorded.arrival === undefined ? withNothingPickedUp(recorded) : secondThoughts.startedFrom;
      secondThoughts = { ...secondThoughts, startedFrom: from };

      // Half a move: a piece picked up or put down, or an arrival with the
      // capture it earned still owed. There is nothing yet to grade, to check or
      // to take back.
      if (played === undefined) {
        recorded = next;
        publish();
        return;
      }

      // Where the player has asked to be warned, the move is checked before it
      // is played rather than graded after it: the same question either way, and
      // the answer to it is the grade whichever way round it was asked.
      if (secondThoughts.warns && teaching.on && assessMove !== undefined) {
        check(from, next, about, played);
        publish();
        return;
      }

      play(from, next);
      assess(about, played);
      publish();
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    start: (next) => {
      putAside += 1;
      recorded = NEW_SESSION;
      playing = {
        opponentSide: next.opponentSide,
        thinking: false,
        difficulty: playing.difficulty,
      };
      // Nothing of the game just thrown away is a move of this one, so there is
      // nowhere in it to take a move back to — and a move it was still checking
      // is a move nobody will ever play. Whether the player asked to be warned is
      // not a game's own, and stays where they put it, as the difficulty does.
      secondThoughts = { ...secondThoughts, history: [], startedFrom: NEW_SESSION, held: undefined };
      // Nothing of the game just thrown away is a move of this one, so the
      // record goes with it — which is the whole of the scope a summary has: a
      // weakness is what the player did in the game in front of them.
      list = NOTHING_PLAYED;
      // A hint asked for in the game just thrown away says nothing about this
      // one, and neither does the answer to it, which may still be on its way.
      // Nor does an assessment: the move it was about is not in this game.
      teaching = {
        ...teaching,
        on: taughtIn(next.opponentSide, chosenTeaching),
        hint: undefined,
        hinting: false,
        assessment: undefined,
        assessing: false,
      };
      think();
      publish();
    },

    playAt: (chosen) => {
      if (chosen === playing.difficulty) return;

      playing = { ...playing, difficulty: chosen };
      publish();
    },

    teach: (on) => {
      // Said either way, and so said for every game after this one — even where
      // the answer is the one who is playing would have given anyway. That case
      // changes nothing about the game and is still published, because the
      // choice outlives the game and has to reach whoever is writing it down.
      const said = chosenTeaching !== on;
      chosenTeaching = on;
      if (on === teaching.on) {
        if (said) publish();
        return;
      }

      // A move held for the player to answer for is played rather than dropped:
      // they committed to it, and switching teaching off asks not to be checked
      // rather than asking to have the move back.
      if (!on) playHeld();
      // And a player looking back at a move is handed the game back. The move
      // list is teaching's, so switching it off takes the way back off the page
      // — and a board frozen on a move already played, with nothing on it to
      // play and nothing to say why, is the worst thing this could leave behind.
      if (!on) watchTheGame();

      // Teaching switched off takes its hint and its assessment with it, so switching
      // it back on is a clean slate rather than what they turned away from.
      teaching = {
        ...teaching,
        on,
        hint: on ? teaching.hint : undefined,
        assessment: on ? teaching.assessment : undefined,
      };
      publish();
    },

    askForHint: () => {
      if (chooseHint === undefined || isLookingBack()) return;
      if (teaching.hinting || !hintIsOffered(recorded, playing, teaching, secondThoughts)) return;

      const asked = putAside;
      const about = recorded.game;
      teaching = { ...teaching, hinting: true };

      const shown = (move: Move | undefined) => {
        if (asked !== putAside) return; // the game has moved on without this answer

        // A search that fails, and a position with no move in it, both come to
        // the same thing: there is nothing to show, and the player is left with
        // an engine that has stopped working one out. So does an answer to a
        // question the player has withdrawn by switching teaching off while it
        // was being worked out — kept, it would come back when they switched
        // teaching on again.
        const answered = move !== undefined && teaching.on;

        teaching = { ...teaching, hinting: false, hint: answered ? { about, move } : undefined };
        publish();
      };

      void chooseHint(about).then(shown, () => shown(undefined));
      publish();
    },

    takeBack: () => {
      if (!teaching.on || secondThoughts.held !== undefined) return;
      if (isLookingBack()) return;

      const back = takenBackTo(recorded, secondThoughts, playing);
      if (back === undefined) return;

      putAside += 1;
      secondThoughts = { ...secondThoughts, history: back.earlier };
      // The record runs in step with the history, so the moves that go are the
      // ones whose starting states went — none of them, where what was taken
      // back was half a move.
      list = { moves: list.moves.slice(0, back.earlier.length), reviewing: undefined };
      recorded = back.to;
      // A move the computer was still thinking about is not played: the position
      // it was asked about is one nobody is looking at any more.
      playing = { ...playing, thinking: false };
      // The grade goes back with the move it was about. A verdict left standing
      // would be a verdict on a move that is no longer in the game, over a board
      // that is waiting for the player to make another one.
      teaching = { ...teaching, hinting: false, assessment: undefined, assessing: false };
      publish();
    },

    review: (move) => {
      // A move waiting on the player is answered by standing by it or thinking
      // again, and not by looking somewhere else.
      if (secondThoughts.held !== undefined) return;
      if (list.moves[move] === undefined || move === list.reviewing) return;

      list = { ...list, reviewing: move };
      publish();
    },

    stopReviewing: () => {
      if (!isLookingBack()) return;

      watchTheGame();
      publish();
    },

    warnOfBlunders: (on) => {
      if (on === secondThoughts.warns) return;

      // A move already being checked is played rather than dropped: the check
      // the player has just switched off was the only thing standing between
      // them and the board.
      if (!on) playHeld();

      secondThoughts = { ...secondThoughts, warns: on };
      publish();
    },

    playAnyway: () => {
      // Only a move the engine has judged is a move to stand by: one still being
      // checked has asked the player nothing yet.
      if (secondThoughts.held?.assessment === undefined) return;

      playHeld();
      publish();
    },

    thinkAgain: () => {
      if (secondThoughts.held?.assessment === undefined) return;

      // Nothing of the move was ever recorded, so there is nothing to put back:
      // the board, the piece picked up, the capture still owed and what was said
      // about the move before are all exactly where the player left them.
      secondThoughts = { ...secondThoughts, held: undefined };
      publish();
    },
  };
};
