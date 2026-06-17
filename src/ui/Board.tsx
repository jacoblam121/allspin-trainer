import { BOARD_WIDTH, VISIBLE_HEIGHT } from "../engine/constants.ts";
import type { BoardCell, Drill } from "../drills/drillTypes.ts";

const EMPTY_ROW: ReadonlyArray<BoardCell> = Array.from(
  { length: BOARD_WIDTH },
  () => null,
);

function rowAt(board: Drill["board"], y: number): ReadonlyArray<BoardCell> {
  const row = board[y];
  if (Array.isArray(row) && row.length === BOARD_WIDTH) {
    return row;
  }
  return EMPTY_ROW;
}

function cellClass(cell: BoardCell): string {
  if (cell === null) {
    return "cell";
  }
  if (cell.kind === "garbage") {
    return "cell piece--garbage";
  }
  return `cell piece--${cell.piece}`;
}

export function Board({ drill }: { drill: Drill }) {
  const rows: number[] = [];
  for (let y = VISIBLE_HEIGHT - 1; y >= 0; y--) {
    rows.push(y);
  }
  return (
    <div
      className="board"
      role="img"
      aria-label={`10 by ${VISIBLE_HEIGHT} board for drill ${drill.id}`}
    >
      {rows.map((y) => (
        <div className="board__row" key={y}>
          {rowAt(drill.board, y).map((cell, x) => (
            <div className={cellClass(cell)} key={x} />
          ))}
        </div>
      ))}
    </div>
  );
}
