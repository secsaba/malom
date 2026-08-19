import { Fragment, type CSSProperties, type KeyboardEvent } from "react";

import { POINTS, type PointId } from "../engine/board";
import type { Arrival, Move } from "../engine/game";
import type { Position } from "../engine/position";
import { strings } from "../strings";
import {
  BOARD_SIZE,
  COORDINATE_LABELS,
  FOCUS_SIZE,
  GROUND_CORNER,
  HINT_RADIUS,
  LAST_MOVE_RADIUS,
  LINE_SEGMENTS,
  PIECE_RADIUS,
  POINT_RADIUS,
  TARGET_RADIUS,
  centreOf,
} from "./board-layout";
import { type PointState, hintedAt, pointLabel } from "./point-state";

type BoardProps = {
  /** The pieces standing on the board. */
  readonly position: Position;
  /** The points the side to move may act on — everything else ignores a tap. */
  readonly legalPoints: readonly PointId[];
  /** The piece the side to move has picked up, if it has picked one up. */
  readonly selection: PointId | undefined;
  /** Where the last piece to move came to rest, so that it can arrive rather than appear. */
  readonly arrival: Arrival | undefined;
  /** The move the engine prefers, where the player has asked to see it. */
  readonly hint: Move | undefined;
  /** Whether the file letters and rank digits are shown around the board. */
  readonly showCoordinates: boolean;
  /** What the player tapped. What that means is the game session's business. */
  readonly onSelect: (point: PointId) => void;
};

/**
 * How far the piece that has just landed has to be put back for the animation to
 * bring it in: the board is drawn in the viewBox's units, so the distance is
 * measured in those and not in anything the screen knows about.
 */
const travelledFrom = (from: PointId, to: PointId): CSSProperties => {
  const start = centreOf(from);
  const end = centreOf(to);

  return {
    "--arrived-x": `${start.x - end.x}px`,
    "--arrived-y": `${start.y - end.y}px`,
  } as CSSProperties;
};

/**
 * Every point is in the tab order, so all 24 are reached by Tab alone, in the
 * board's own order — up each file, files left to right. Roving focus over the
 * board would be fewer keystrokes, but the board is drawn on a grid with holes
 * in it and arrowing across one is a guess about where the player meant to go;
 * Tab is a guess about nothing.
 */
const IN_TAB_ORDER = 0;

/** What a tap is, to a keyboard: the keys that play the point focus is on. */
const PLAY_KEYS = ["Enter", " "];

/**
 * The board: its 16 lines, its 24 points, and the pieces on them.
 *
 * A point and the piece standing on it are one circle, so a piece can never
 * drift off its point. Over each sits an invisible, much larger circle that
 * takes the tap — a point is a fingertip wide on a phone, and the target has to
 * be too. That circle is also the point's control: it takes focus, it answers
 * Enter and Space, and it carries the point's name and state for a player who
 * cannot see either. Everything else the board draws is hidden from assistive
 * technology, because everything else the board draws is one of those states
 * said again in ink.
 *
 * Every group below is drawn off the one list of states worked out at the top,
 * and every name is worded from the same entry of it, so no mark is derived a
 * second time and no mark can come to disagree with what the point says it is.
 * Each of the states carries a shape of its own rather than only a colour: a
 * dashed ring on a point that may be acted on, a solid one round the piece
 * picked up, the hint's own ring outside them all, and a small ring inside the
 * piece that moved last — and, for the point the keyboard has reached rather
 * than for any state of the game, a square.
 *
 * The piece that moved last also carries the mark the animation runs off, so
 * that a move the player did not make — the computer's — is something they watch
 * happen rather than something they find has happened. The animation is the
 * lesser half of that mark: a player who has asked for no movement still sees
 * the ring.
 */
export const Board = ({
  position,
  legalPoints,
  selection,
  arrival,
  hint,
  showCoordinates,
  onSelect,
}: BoardProps) => {
  const stateOf = (point: PointId): PointState => ({
    occupant: position.get(point),
    legal: legalPoints.includes(point),
    selected: point === selection,
    hint: hintedAt(hint, point),
    lastMove: arrival?.to === point,
  });

  const board = POINTS.map((point) => ({
    point,
    state: stateOf(point),
    centre: centreOf(point),
  }));

  // Where the picked-up piece may go, drawn as the outline of the piece that
  // would land there. Empty points are outlined only while a piece is picked up:
  // during the placing phase every empty point is legal, so outlining them all
  // would say nothing — which is why the announcement and the ink part company
  // there, and only there.
  const destinations =
    selection === undefined ? [] : board.filter(({ state }) => state.legal && !state.occupant);

  const hinted = board.filter(({ state }) => state.hint !== undefined);
  const arrived = board.filter(({ state }) => state.lastMove);

  const play = (event: KeyboardEvent, point: PointId) => {
    if (!PLAY_KEYS.includes(event.key)) return;

    // Space scrolls the page otherwise, which would take the board out from
    // under the player at the moment they played on it.
    event.preventDefault();
    onSelect(point);
  };

  return (
    <svg
      className="board"
      data-testid="board"
      viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
      role="group"
      aria-label={strings.board.label}
    >
      {/*
       * What makes a piece an object standing on the board rather than a disc
       * printed on it: a dome, lit from the upper left, and a shadow beneath.
       *
       * Both have to be SVG. A gradient can only paint a `fill` as a paint
       * server, and the shadow is measured in the viewBox's units, so it scales
       * with the board rather than with the viewport — a CSS `drop-shadow()`
       * would be in screen pixels and would grow coarser the smaller the board
       * got. The stop colours could have been custom properties, but a gradient
       * split half into the stylesheet is harder to read than one kept whole.
       */}
      <defs>
        <radialGradient id="piece-light" cx="36%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="62%" stopColor="#f7f3e9" />
          <stop offset="100%" stopColor="#d3ccbd" />
        </radialGradient>

        <radialGradient id="piece-dark" cx="36%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#565049" />
          <stop offset="62%" stopColor="#322e29" />
          <stop offset="100%" stopColor="#1a1815" />
        </radialGradient>

        {/*
         * Room for the blur: the default filter region is a tenth of the shape
         * around it, which is narrower than this shadow and would cut it into a
         * square.
         */}
        <filter id="piece-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="0"
            dy="6"
            stdDeviation="5"
            floodColor="#2e2a24"
            floodOpacity="0.42"
          />
        </filter>
      </defs>

      {/*
       * The ground the board stands on, drawn rather than set behind the
       * element: the element is given whatever room the page has and the
       * drawing centres itself in it, so a ground that was the background would
       * spread into the room the board did not use.
       */}
      <rect
        className="board__ground"
        data-testid="board-ground"
        aria-hidden="true"
        width={BOARD_SIZE}
        height={BOARD_SIZE}
        rx={GROUND_CORNER}
      />

      <g className="board__lines" aria-hidden="true">
        {LINE_SEGMENTS.map(({ line, from, to }) => (
          <line
            key={line.join("-")}
            data-testid="line"
            data-line={line.join("-")}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
          />
        ))}
      </g>

      <g className="board__points" aria-hidden="true">
        {board.map(({ point, state, centre }) => (
          <circle
            key={point}
            data-testid="point"
            data-point={point}
            data-occupant={state.occupant}
            data-legal={state.legal ? "" : undefined}
            data-selected={state.selected ? "" : undefined}
            data-hint={state.hint}
            data-arrived={state.lastMove ? (arrival?.from ? "moved" : "placed") : undefined}
            style={
              state.lastMove && arrival?.from ? travelledFrom(arrival.from, point) : undefined
            }
            cx={centre.x}
            cy={centre.y}
            r={state.occupant ? PIECE_RADIUS : POINT_RADIUS}
          />
        ))}
      </g>

      {destinations.length > 0 && (
        <g className="board__destinations" data-testid="destinations" aria-hidden="true">
          {destinations.map(({ point, centre }) => (
            <circle
              key={point}
              data-destination={point}
              cx={centre.x}
              cy={centre.y}
              r={PIECE_RADIUS}
            />
          ))}
        </g>
      )}

      {/*
       * Where the last move came to rest: a ring inside the piece, in whichever
       * of the board's two inks the piece it sits on is not, so it reads on a
       * cream dome and on a near-black one alike. It carries the arrival too, so
       * that it travels in with the piece rather than waiting at the destination
       * for it.
       */}
      {arrived.length > 0 && (
        <g className="board__last-move" data-testid="last-move" aria-hidden="true">
          {arrived.map(({ point, state, centre }) => (
            <circle
              key={point}
              data-piece={state.occupant}
              data-arrived={arrival?.from ? "moved" : "placed"}
              style={arrival?.from ? travelledFrom(arrival.from, point) : undefined}
              cx={centre.x}
              cy={centre.y}
              r={LAST_MOVE_RADIUS}
            />
          ))}
        </g>
      )}

      {/*
       * The hint, drawn as a ring round each point the engine's move touches
       * rather than as a mark on the point itself. The point keeps every mark it
       * had — a piece it may pick up still looks like one, a destination still
       * looks like one — and the hint is drawn outside it, which is what stops the
       * board saying two things at once about the same circle.
       */}
      {hinted.length > 0 && (
        <g className="board__hints" data-testid="hints" aria-hidden="true">
          {hinted.map(({ point, state, centre }) => (
            <circle
              key={point}
              data-hint={state.hint}
              cx={centre.x}
              cy={centre.y}
              r={HINT_RADIUS}
            />
          ))}
        </g>
      )}

      {showCoordinates && (
        <g className="board__coordinates" data-testid="coordinates" aria-hidden="true">
          {COORDINATE_LABELS.map((label) => (
            <text key={label.text} x={label.x} y={label.y}>
              {label.text}
            </text>
          ))}
        </g>
      )}

      {/*
       * The control for each point, and — drawn straight after it, so the
       * stylesheet can reach it from the control's own focus — the square that
       * marks the point the keyboard has got to. The square takes no taps: the
       * circle before it is the whole of what a pointer touches, and it is the
       * same circle it was before the board could be played without one.
       */}
      <g className="board__targets">
        {board.map(({ point, state, centre }) => (
          <Fragment key={point}>
            <circle
              data-target={point}
              role="button"
              tabIndex={IN_TAB_ORDER}
              aria-label={pointLabel(point, state)}
              cx={centre.x}
              cy={centre.y}
              r={TARGET_RADIUS}
              onClick={() => onSelect(point)}
              onKeyDown={(event) => play(event, point)}
            />
            <rect
              aria-hidden="true"
              x={centre.x - FOCUS_SIZE / 2}
              y={centre.y - FOCUS_SIZE / 2}
              width={FOCUS_SIZE}
              height={FOCUS_SIZE}
            />
          </Fragment>
        ))}
      </g>
    </svg>
  );
};
