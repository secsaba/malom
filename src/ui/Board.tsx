import { POINTS } from "../engine/board";
import { strings } from "../strings";
import {
  BOARD_SIZE,
  FILE_LABELS,
  LINE_SEGMENTS,
  RANK_LABELS,
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
      {LINE_SEGMENTS.map((segment) => (
        <line
          key={segment.line.join("-")}
          data-testid="line"
          data-line={segment.line.join("-")}
          x1={segment.x1}
          y1={segment.y1}
          x2={segment.x2}
          y2={segment.y2}
        />
      ))}
    </g>

    <g className="board__points">
      {POINTS.map((point) => {
        const { x, y } = positionOf(point);
        return <circle key={point} data-testid="point" data-point={point} cx={x} cy={y} r={18} />;
      })}
    </g>

    {showCoordinates && (
      <g className="board__coordinates" data-testid="coordinates">
        {FILE_LABELS.map((label) => (
          <text key={label.file} x={label.x} y={label.y}>
            {label.file}
          </text>
        ))}
        {RANK_LABELS.map((label) => (
          <text key={label.rank} x={label.x} y={label.y}>
            {label.rank}
          </text>
        ))}
      </g>
    )}
  </svg>
);
