// Fumen export adapter (Sprint 5).
//
// The adapter is the only module that imports `tetris-fumen`. It exposes a
// pure, UI-agnostic function that converts a locked engine field into a
// single-page fumen code. No active piece, hold, queue, ghost, accepted
// routes, settings, B2B/combo, or drill metadata are exported.
//
// The engine's visible playfield is rows y=0..19 (bottom-origin). Fumen uses
// the same y-axis convention (y=0 is the bottom row, y=22 is the top of the
// 23-row playfield). Locked cells in the engine's hidden rows (y >= 20) are
// not exportable: the fumen standard only covers the visible 20 rows plus
// 3 spawn rows above them, and silently dropping data would corrupt the
// user's intended share. Reject with a clear reason instead.

import { encoder, Field as FumenField } from "tetris-fumen";
import { BOARD_WIDTH, VISIBLE_HEIGHT } from "../engine/constants.ts";
import type { Field } from "../engine/board.ts";
import type { BoardCell } from "../drills/drillTypes.ts";

const FIELD_AT_TOP_OF_FUMEN_VISIBLE_ROWS = VISIBLE_HEIGHT; // 20

export type ExportResult =
  | { ok: true; code: string }
  | { ok: false; reason: string };

function cellToFumenType(cell: BoardCell): string | null {
  if (cell === null) return null;
  if (cell.kind === "garbage") return "X";
  return cell.piece;
}

// Walk every row in the engine field that is outside the visible 20-row
// playfield (y >= VISIBLE_HEIGHT) and confirm none of them hold a non-null
// cell. Returns null on success or a human-readable reason on failure.
function hiddenRowProblem(field: Field): string | null {
  for (let y = FIELD_AT_TOP_OF_FUMEN_VISIBLE_ROWS; y < field.length; y++) {
    const row = field[y];
    if (row === undefined) continue;
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== null) {
        return `locked cell at y=${y} (x=${x}) is above the visible 20-row playfield and cannot be exported to fumen`;
      }
    }
  }
  return null;
}

export function exportVisiblePlayfieldToFumen(field: Field): ExportResult {
  const hiddenProblem = hiddenRowProblem(field);
  if (hiddenProblem !== null) {
    return { ok: false, reason: hiddenProblem };
  }

  const fumenField = FumenField.create();
  for (let y = 0; y < VISIBLE_HEIGHT; y++) {
    const row = field[y];
    if (row === undefined) continue;
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const type = cellToFumenType(row[x] ?? null);
      if (type !== null) {
        fumenField.set(x, y, type);
      }
    }
  }

  try {
    const code = encoder.encode([
      { field: fumenField, flags: { colorize: true } },
    ]);
    return { ok: true, code };
  } catch (err) {
    return { ok: false, reason: `fumen encode failed: ${String(err)}` };
  }
}
