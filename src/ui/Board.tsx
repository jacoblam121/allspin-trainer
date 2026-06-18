import { useMemo } from "react";
import {
  BOARD_WIDTH,
  VISIBLE_HEIGHT,
  VISIBLE_SPAWN_ROWS,
} from "../engine/constants.ts";
import type { EngineSnapshot } from "../engine/gameState.ts";
import type { BoardCell } from "../drills/drillTypes.ts";

const EMPTY_ROW: ReadonlyArray<BoardCell> = Array.from(
  { length: BOARD_WIDTH },
  () => null,
);

function rowAt(
  field: EngineSnapshot["field"],
  y: number,
): ReadonlyArray<BoardCell> {
  const row = field[y];
  if (Array.isArray(row) && row.length === BOARD_WIDTH) {
    return row;
  }
  return EMPTY_ROW;
}

function cellClass(
  cell: BoardCell | undefined,
  activeClass: string | null,
  ghostClass: string | null,
): string {
  if (activeClass !== null) {
    return `cell ${activeClass}`;
  }
  if (ghostClass !== null) {
    return `cell ${ghostClass}`;
  }
  if (cell === null || cell === undefined) {
    return "cell";
  }
  if (cell.kind === "garbage") {
    return "cell piece--garbage";
  }
  return `cell piece--${cell.piece}`;
}

export function Board({ snapshot }: { snapshot: EngineSnapshot }) {
  // Build coord -> "active" / "ghost" sets once per render. activeCells
  // win at shared coords (common with SDF=Infinity: piece sits on the
  // floor and activeCells === ghostCells).
  const { activeSet, ghostSet, ghostPiece } = useMemo(() => {
    const activeSet = new Set<string>();
    for (const c of snapshot.activeCells) {
      activeSet.add(`${c.x},${c.y}`);
    }
    const ghostSet = new Set<string>();
    for (const c of snapshot.ghostCells) {
      ghostSet.add(`${c.x},${c.y}`);
    }
    const ghostPiece = snapshot.active?.piece ?? null;
    return { activeSet, ghostSet, ghostPiece };
  }, [snapshot]);

  const rows: number[] = [];
  for (let y = VISIBLE_HEIGHT + VISIBLE_SPAWN_ROWS - 1; y >= 0; y--) {
    rows.push(y);
  }

  return (
    <div
      className="board"
      role="img"
      aria-label={`10 by ${VISIBLE_HEIGHT} board with ${VISIBLE_SPAWN_ROWS} spawn rows for drill ${snapshot.drillId}`}
    >
      {rows.map((y) => (
        <div
          className={
            y >= VISIBLE_HEIGHT ? "board__row board__row--spawn" : "board__row"
          }
          key={y}
        >
          {rowAt(snapshot.field, y).map((cell, x) => {
            const key = `${x},${y}`;
            const isActive = activeSet.has(key);
            const isGhost = !isActive && ghostSet.has(key);
            const activeClass = isActive
              ? `piece--${snapshot.active?.piece ?? ""} cell--active`
              : null;
            const ghostClass =
              isGhost && ghostPiece ? `piece--${ghostPiece} cell--ghost` : null;
            return (
              <div
                className={cellClass(cell, activeClass, ghostClass)}
                key={x}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
