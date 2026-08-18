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
 * them in Hungarian.
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
} from "../engine/position";
import { DEFAULT_DIFFICULTY, DIFFICULTIES, type Difficulty } from "../opponent/difficulty";
import type { Assessment } from "../teaching/assessment";
import type { Grade } from "../teaching/grade";
import type { Pattern } from "../teaching/patterns";
import type { Reason } from "../teaching/reason";

export type { Assessment, Difficulty, Draw, Ending, Grade, Pattern, Phase, Reason, Result };
// The interface offers the difficulties the facade accepts, and asks the facade
// for them rather than reaching past it to the opponent (ADR-0002).
export { DIFFICULTIES };

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
   * Where the last piece to move came to rest — the capture it may have earned
   * is not part of it — so the interface can bring it in from where it came
   * rather than have it appear. Nothing, in a game nobody has moved in yet.
   */
  readonly lastArrival: Arrival | undefined;
};

/** What the engine detected in a move it has nothing to say about. */
const NOTHING_DETECTED: readonly Pattern[] = [];

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

// What the players see is spelled out rather than spread from what is recorded,
// so that a state built from an earlier one cannot smuggle a stale set of legal
// points through with it.
const stateOf = (
  recorded: Recorded,
  playing: Playing,
  teaching: Teaching,
  secondThoughts: SecondThoughts,
): GameState => {
  const { opponentSide, thinking, difficulty } = playing;
  const { held } = secondThoughts;
  const { game, selection, arrival, lastArrival } = recorded;
  const assessment = teaching.on ? teaching.assessment : undefined;
  // A piece that has arrived is on the board and out of its hand from the moment
  // it lands, so what the players see mid-move is the arrival, not the game the
  // capture it owes will complete.
  const arrived = arrival && afterArrival(game, arrival);

  return {
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
    lastArrival,
  };
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
  lastMove: undefined,
};

/**
 * A piece has arrived on a point — put there or moved there — so the mill it may
 * have closed decides whether the move is over or a capture is owed.
 */
const afterSending = (recorded: Recorded, arrival: Arrival): Recorded => {
  const { game, lastMove } = recorded;

  // A move closing two mills still earns one capture: the debt is owed, not counted.
  return afterArrival(game, arrival).captures.length > 0
    ? { game, selection: undefined, arrival, lastArrival: arrival, lastMove }
    : {
        game: afterMove(game, arrival),
        selection: undefined,
        arrival: undefined,
        lastArrival: arrival,
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
    lastMove: move,
  };
};

/**
 * The move the computer chose, played out whole — the capture it earned
 * included. A player assembles a move out of taps and can put a piece back down
 * in the middle of it; the computer arrives at one already decided, so there is
 * no half of it for anyone to see.
 */
const afterChoosing = (game: Game, move: Move): Recorded => ({
  game: afterMove(game, move),
  selection: undefined,
  arrival: undefined,
  lastArrival: { from: move.from, to: move.to },
  lastMove: move,
});

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
}: GameSessionOptions = {}): GameSession => {
  let recorded = NEW_SESSION;
  // Whether the player has said either way about teaching. Until they have, who
  // is playing answers for them, which is why this is not simply a boolean: a
  // player who switched it on in a hotseat game means it, and a player who has
  // never touched it means nothing at all.
  let chosenTeaching: boolean | undefined;
  let playing: Playing = { opponentSide: players.opponentSide, thinking: false, difficulty };
  let teaching: Teaching = {
    on: taughtIn(players.opponentSide, chosenTeaching),
    hasEngine: chooseHint !== undefined,
    hint: undefined,
    hinting: false,
    assessment: undefined,
    assessing: false,
  };
  let secondThoughts: SecondThoughts = {
    history: [],
    startedFrom: NEW_SESSION,
    warns: false,
    held: undefined,
  };
  let state = stateOf(recorded, playing, teaching, secondThoughts);
  const listeners = new Set<() => void>();

  // How many times the game in front of the player has been put aside — another
  // one started, or a move taken back. A search still running when one of those
  // happens answers all the same, and this is what tells that answer from one
  // worth acting on.
  let putAside = 0;

  const publish = () => {
    state = stateOf(recorded, playing, teaching, secondThoughts);
    for (const listener of listeners) listener();
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
    teaching = { ...teaching, assessing: true, assessment: undefined };

    const graded = (answer: Assessment | undefined) => {
      if (asked !== putAside) return; // the game has moved on without this answer
      if (question !== assessmentsAsked) return; // and another move has been played since

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
  const play = (from: Recorded, next: Recorded) => {
    secondThoughts = { ...secondThoughts, history: [...secondThoughts.history, from], held: undefined };
    recorded = next;
    // The computer is asked before the engine is: the two think in the same
    // thread, and the move somebody is waiting for goes first.
    think();
  };

  /** Play a move the player was being asked to stand by, however the asking ended. */
  const playHeld = () => {
    const { held } = secondThoughts;
    if (held === undefined) return;

    play(held.from, held.next);
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
      if (held !== undefined) play(held.from, held.next);
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

    apply: (intent) => {
      // A move waiting on the player is the only thing there is for them to
      // answer, and it is not answered by tapping the board.
      if (secondThoughts.held !== undefined) return;
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
      // the answer is the one who is playing would have given anyway.
      chosenTeaching = on;
      if (on === teaching.on) return;

      // A move held for the player to answer for is played rather than dropped:
      // they committed to it, and switching teaching off asks not to be checked
      // rather than asking to have the move back.
      if (!on) playHeld();

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
      if (chooseHint === undefined) return;
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

      const back = takenBackTo(recorded, secondThoughts, playing);
      if (back === undefined) return;

      putAside += 1;
      secondThoughts = { ...secondThoughts, history: back.earlier };
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
