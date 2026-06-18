// Snapshot change comparison (plan §7). Compares two EngineSnapshots on the
// render-relevant fields and returns true if the renderer would produce a
// different result. Used by the loop to skip publishes when nothing has
// actually changed — important because hardDrop returns ok:true even at
// the floor, so SDF=Infinity would otherwise produce one publish per tick
// with no state change.
//
// Render-relevant fields:
//   - active: by value (piece / rotation / x / y; null vs non-null)
//   - field: by content (cell-by-cell; ~400 null checks per frame at 60fps,
//     negligible)
//   - hold, queue (length + element equality), canHold, status, lastClear,
//     drillId
//
// activeCells and ghostCells are derived from active + field, so they don't
// need a separate comparison — if active and field are unchanged, the
// derived cells are unchanged.

import type { EngineSnapshot } from "../engine/gameState.ts";
import { FIELD_HEIGHT, BOARD_WIDTH } from "../engine/constants.ts";

function activeEqual(
  a: EngineSnapshot["active"],
  b: EngineSnapshot["active"],
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return (
    a.piece === b.piece &&
    a.rotation === b.rotation &&
    a.x === b.x &&
    a.y === b.y
  );
}

function cellEqual(
  a: EngineSnapshot["field"][number][number],
  b: EngineSnapshot["field"][number][number],
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === "filled" && b.kind === "filled") {
    return a.piece === b.piece;
  }
  return true;
}

function fieldEqual(
  a: EngineSnapshot["field"],
  b: EngineSnapshot["field"],
): boolean {
  for (let y = 0; y < FIELD_HEIGHT; y++) {
    const rowA = a[y];
    const rowB = b[y];
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (!cellEqual(rowA[x], rowB[x])) return false;
    }
  }
  return true;
}

function queueEqual(
  a: EngineSnapshot["queue"],
  b: EngineSnapshot["queue"],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function snapshotChanged(
  prev: EngineSnapshot,
  next: EngineSnapshot,
): boolean {
  if (!activeEqual(prev.active, next.active)) return true;
  if (prev.status !== next.status) return true;
  if (prev.lastClear !== next.lastClear) return true;
  if (prev.drillId !== next.drillId) return true;
  if (prev.canHold !== next.canHold) return true;
  if (prev.hold !== next.hold) return true;
  if (!queueEqual(prev.queue, next.queue)) return true;
  if (!fieldEqual(prev.field, next.field)) return true;
  return false;
}
