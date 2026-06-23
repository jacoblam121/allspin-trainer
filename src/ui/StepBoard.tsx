import { BOARD_WIDTH, VISIBLE_HEIGHT } from "../engine/constants.ts";
import type { Field } from "../engine/board.ts";
import type { BoardCell } from "../drills/drillTypes.ts";

function cellClass(cell: BoardCell): string {
  if (cell === null) return "cell";
  if (cell.kind === "garbage") return "cell piece--garbage";
  return `cell piece--${cell.piece}`;
}

function rowAt(field: Field, y: number): ReadonlyArray<BoardCell> {
  const row = field[y];
  if (Array.isArray(row) && row.length === BOARD_WIDTH) {
    return row;
  }
  return new Array<BoardCell>(BOARD_WIDTH).fill(null);
}

// Compact field-only board for rendered solution steps. Renders only the
// visible 20 rows (y = 0..VISIBLE_HEIGHT-1), top-first. Does not accept or
// synthesize EngineSnapshot data.
export function StepBoard({
  field,
  ariaLabel,
}: {
  field: Field;
  ariaLabel: string;
}) {
  const rows: number[] = [];
  for (let y = VISIBLE_HEIGHT - 1; y >= 0; y--) {
    rows.push(y);
  }
  return (
    <div className="step-board" role="img" aria-label={ariaLabel}>
      {rows.map((y) => (
        <div className="step-board__row" key={y}>
          {rowAt(field, y).map((cell, x) => (
            <div className={cellClass(cell)} key={x} />
          ))}
        </div>
      ))}
    </div>
  );
}
