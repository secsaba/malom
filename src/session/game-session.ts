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

export type { Difficulty, Draw, Ending, Phase, Result };
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

/** Who is playing: the side the computer takes, or nobody, for two people sharing a device. */
export type Players = {
  readonly opponentSide?: Side | undefined;
};

export type GameSessionOptions = {
  /** Asked for the computer's move. Without it, both sides are played by hand. */
  readonly chooseMove?: ChooseMove | undefined;
  /** Asked for the move a hint shows. Without it, no hint is ever on offer. */
  readonly chooseHint?: ChooseHint | undefined;
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
   * Where the last piece to move came to rest — the capture it may have earned
   * is not part of it — so the interface can bring it in from where it came
   * rather than have it appear. Nothing, in a game nobody has moved in yet.
   */
  readonly lastArrival: Arrival | undefined;
};

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
): boolean =>
  on &&
  hasEngine &&
  arrival === undefined &&
  game.result === undefined &&
  !isOpponentToMove(game, opponentSide);

// What the players see is spelled out rather than spread from what is recorded,
// so that a state built from an earlier one cannot smuggle a stale set of legal
// points through with it.
const stateOf = (
  recorded: Recorded,
  playing: Playing,
  teaching: Teaching,
): GameState => {
  const { opponentSide, thinking, difficulty } = playing;
  const { game, selection, arrival, lastArrival } = recorded;
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
    // offer them while it is thinking about it.
    legalPoints: isOpponentToMove(game, opponentSide) ? [] : legalPointsOf(recorded),
    opponentSide,
    thinking,
    difficulty,
    teaching: teaching.on,
    hint: hintShown(recorded, teaching),
    hinting: teaching.hinting,
    hintOffered: hintIsOffered(recorded, playing, teaching),
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
};

/**
 * A piece has arrived on a point — put there or moved there — so the mill it may
 * have closed decides whether the move is over or a capture is owed.
 */
const afterSending = ({ game }: Recorded, arrival: Arrival): Recorded =>
  // A move closing two mills still earns one capture: the debt is owed, not counted.
  afterArrival(game, arrival).captures.length > 0
    ? { game, selection: undefined, arrival, lastArrival: arrival }
    : {
        game: afterMove(game, arrival),
        selection: undefined,
        arrival: undefined,
        lastArrival: arrival,
      };

/** The capture the arrival owed has been taken, so the move is played out in full. */
const afterCapturing = (game: Game, arrival: Arrival, point: PointId): Recorded => ({
  game: afterMove(game, { ...arrival, capture: point }),
  selection: undefined,
  arrival: undefined,
  lastArrival: arrival,
});

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
};

/** Start a game. */
export const createGameSession = ({
  chooseMove,
  chooseHint,
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
  };
  let state = stateOf(recorded, playing, teaching);
  const listeners = new Set<() => void>();

  // How many games have been started here. A game thrown away while the computer
  // was still thinking about it gets its answer all the same, and this is what
  // tells that answer from one worth playing.
  let gamesStarted = 0;

  const publish = () => {
    state = stateOf(recorded, playing, teaching);
    for (const listener of listeners) listener();
  };

  /**
   * Ask the computer for its move, where the game is waiting on one. The answer
   * comes back later, so this returns long before the move is played.
   */
  const think = () => {
    if (chooseMove === undefined) return;
    if (playing.thinking || !isOpponentToMove(recorded.game, playing.opponentSide)) return;

    const asked = gamesStarted;
    const thought = recorded.game;
    playing = { ...playing, thinking: true };

    const played = (move: Move | undefined) => {
      if (asked !== gamesStarted) return; // another game is being played now

      playing = { ...playing, thinking: false };
      if (move) recorded = afterChoosing(thought, move);
      publish();
    };

    // A search that fails is a computer with no move to play: the game stays
    // where it stood, with the move still its own. There is nowhere here to say
    // so, and the interface reads a computer that has stopped thinking.
    void chooseMove(thought, playing.difficulty).then(played, () => played(undefined));
  };

  // A game the computer opens is under way from the moment it is created.
  think();
  publish();

  return {
    get state() {
      return state;
    },

    apply: (intent) => {
      if (isOpponentToMove(recorded.game, playing.opponentSide)) return;

      const next = nextRecorded(recorded, intent);
      if (next === recorded) return;

      recorded = next;
      think();
      publish();
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    start: (next) => {
      gamesStarted += 1;
      recorded = NEW_SESSION;
      playing = {
        opponentSide: next.opponentSide,
        thinking: false,
        difficulty: playing.difficulty,
      };
      // A hint asked for in the game just thrown away says nothing about this
      // one, and neither does the answer to it, which may still be on its way.
      teaching = {
        ...teaching,
        on: taughtIn(next.opponentSide, chosenTeaching),
        hint: undefined,
        hinting: false,
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

      // Teaching switched off takes its hint off the board with it, so switching
      // it back on is a clean slate rather than the hint they turned away from.
      teaching = { ...teaching, on, hint: on ? teaching.hint : undefined };
      publish();
    },

    askForHint: () => {
      if (chooseHint === undefined) return;
      if (teaching.hinting || !hintIsOffered(recorded, playing, teaching)) return;

      const asked = gamesStarted;
      const about = recorded.game;
      teaching = { ...teaching, hinting: true };

      const shown = (move: Move | undefined) => {
        if (asked !== gamesStarted) return; // another game is being played now

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
  };
};
