import type { CSSProperties } from "react";

import { POINTS, type PointId } from "../engine/board";
import type { Arrival } from "../engine/game";
import type { Position } from "../engine/position";
import { strings } from "../strings";
import {
  BOARD_SIZE,
  COORDINATE_LABELS,
  LINE_SEGMENTS,
  PIECE_RADIUS,
  POINT_RADIUS,
  TARGET_RADIUS,
  centreOf,
} from "./board-layout";

type BoardProps = {
  /** The pieces standing on the board. */
  readonly position: Position;
  /** The points the side to move may act on — everything else ignores a tap. */
  readonly legalPoints: readonly PointId[];
  /** The piece the side to move has picked up, if it has picked one up. */
  readonly selection: PointId | undefined;
  /** Where the last piece to move came to rest, so that it can arrive rather than appear. */
  readonly arrival: Arrival | undefined;
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
 * The board: its 16 lines, its 24 points, and the pieces on them.
 *
 * A point and the piece standing on it are one circle, so a piece can never
 * drift off its point. Over each sits an invisible, much larger circle that
 * takes the tap — a point is a fingertip wide on a phone, and the target has to
 * be too.
 *
 * The piece that moved last carries the mark the animation runs off, so that a
 * move the player did not make — the computer's — is something they watch happen
 * rather than something they find has happened.
 */
export const Board = ({
  position,
  legalPoints,
  selection,
  arrival,
  showCoordinates,
  onSelect,
}: BoardProps) => (
  <svg
    className="board"
    data-testid="board"
    data-selection={selection}
    viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
    role="img"
    aria-label={strings.board.label}
  >
    <g className="board__lines">
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

    <g className="board__points">
      {POINTS.map((point) => {
        const { x, y } = centreOf(point);
        const occupant = position.get(point);
        const arrived = arrival?.to === point ? arrival : undefined;

        return (
          <circle
            key={point}
            data-testid="point"
            data-point={point}
            data-occupant={occupant}
            data-legal={legalPoints.includes(point) ? "" : undefined}
            data-selected={point === selection ? "" : undefined}
            data-arrived={arrived && (arrived.from ? "moved" : "placed")}
            style={arrived?.from ? travelledFrom(arrived.from, point) : undefined}
            cx={x}
            cy={y}
            r={occupant ? PIECE_RADIUS : POINT_RADIUS}
          />
        );
      })}
    </g>

    {showCoordinates && (
      <g className="board__coordinates" data-testid="coordinates">
        {COORDINATE_LABELS.map((label) => (
          <text key={label.text} x={label.x} y={label.y}>
            {label.text}
          </text>
        ))}
      </g>
    )}

    <g className="board__targets">
      {POINTS.map((point) => {
        const { x, y } = centreOf(point);
        return (
          <circle
            key={point}
            data-target={point}
            cx={x}
            cy={y}
            r={TARGET_RADIUS}
            onClick={() => onSelect(point)}
          />
        );
      })}
    </g>
  </svg>
);
