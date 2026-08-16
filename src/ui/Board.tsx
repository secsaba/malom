import { POINTS } from "../engine/board";
import { strings } from "../strings";
import {
  BOARD_SIZE,
  COORDINATE_LABELS,
  LINE_SEGMENTS,
  POINT_RADIUS,
  positionOf,
} from "./board-layout";

type BoardProps = {
  /** Whether the file letters and rank digits are shown around the board. */
  readonly showCoordinates: boolean;
};

/** The board itself: its 16 lines and 24 points, with no pieces on it yet. */
export const Board = ({ showCoordinates }: BoardProps) => (
  <svg
    className="board"
    data-testid="board"
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
        const { x, y } = positionOf(point);
        return (
          <circle key={point} data-testid="point" data-point={point} cx={x} cy={y} r={POINT_RADIUS} />
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
  </svg>
);
