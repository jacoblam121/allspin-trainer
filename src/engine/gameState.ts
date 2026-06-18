import { FIELD_HEIGHT } from "./constants.ts";
import type { PieceId, RotationState } from "./pieces.ts";
import type { Drill } from "../drills/drillTypes.ts";
import { type Coord, cellsOf } from "./tetrominoes.ts";
import {
  type Field,
  cloneField,
  clearLines,
  collides,
  lockCells,
  normalizeField,
} from "./board.ts";
import {
  SPAWN_ORIGIN,
  resolveRotation,
  type RotationDirection,
} from "./ruleset.ts";

export type ActivePiece = {
  piece: PieceId;
  rotation: RotationState;
  x: number;
  y: number;
};

export type LockedPlacement = {
  piece: PieceId;
  x: number;
  y: number;
  rotation: RotationState;
};

export type EngineStatus = "active" | "blocked";

export type EngineSnapshot = {
  field: Field;
  active: ActivePiece | null;
  activeCells: Coord[];
  ghostCells: Coord[];
  hold: PieceId | null;
  queue: PieceId[];
  canHold: boolean;
  status: EngineStatus;
  lastClear: number;
  drillId: string;
};

export type EngineState = {
  field: Field;
  active: ActivePiece | null;
  hold: PieceId | null;
  queue: PieceId[];
  canHold: boolean;
  status: EngineStatus;
  drillId: string;
  lastClear: number;
  initial: EngineSnapshot;
  history: EngineSnapshot[];
};

export type EngineCommandResult =
  | { ok: true; snapshot: EngineSnapshot; lockedPlacement?: LockedPlacement }
  | { ok: false; reason: string; snapshot: EngineSnapshot };

export type EngineInitResult =
  | { ok: true; state: EngineState }
  | { ok: false; reason: string };

function activeCellsOf(active: ActivePiece): Coord[] {
  return cellsOf(active.piece, active.rotation, active.x, active.y);
}

// Lowest valid y for the active piece at its current x/rotation: the largest y
// such that the piece does not collide. Used for both hardDrop and ghost cells.
function lowestValidY(
  field: Field,
  piece: PieceId,
  rotation: RotationState,
  x: number,
  y: number,
): number {
  let testY = y;
  while (
    testY > -1 &&
    !collides(field, cellsOf(piece, rotation, x, testY - 1))
  ) {
    testY--;
  }
  return testY;
}

function computeGhostCells(state: EngineState): Coord[] {
  if (state.active === null) {
    return [];
  }
  const { piece, rotation, x, y } = state.active;
  const ghostY = lowestValidY(state.field, piece, rotation, x, y);
  return cellsOf(piece, rotation, x, ghostY);
}

export function snapshot(state: EngineState): EngineSnapshot {
  return {
    field: cloneField(state.field),
    active: state.active === null ? null : { ...state.active },
    activeCells: state.active === null ? [] : activeCellsOf(state.active),
    ghostCells: computeGhostCells(state),
    hold: state.hold,
    queue: [...state.queue],
    canHold: state.canHold,
    status: state.status,
    lastClear: state.lastClear,
    drillId: state.drillId,
  };
}

function ok(
  state: EngineState,
  lockedPlacement?: LockedPlacement,
): EngineCommandResult {
  const snap = snapshot(state);
  return lockedPlacement === undefined
    ? { ok: true, snapshot: snap }
    : { ok: true, snapshot: snap, lockedPlacement };
}

function fail(state: EngineState, reason: string): EngineCommandResult {
  return { ok: false, reason, snapshot: snapshot(state) };
}

// Internal: spawn a piece at SPAWN_ORIGIN. Returns true on success, false on
// spawn collision (caller decides what to do — constructor rejects, post-lock
// spawn collision sets terminal status:"blocked").
function spawnPiece(state: EngineState, piece: PieceId): boolean {
  const origin = SPAWN_ORIGIN[piece];
  const active: ActivePiece = {
    piece,
    rotation: "0",
    x: origin.x,
    y: origin.y,
  };
  if (collides(state.field, activeCellsOf(active))) {
    return false;
  }
  state.active = active;
  state.canHold = true;
  return true;
}

export function createEngineFromDrill(drill: Drill): EngineInitResult {
  if (drill.board.length > FIELD_HEIGHT) {
    return {
      ok: false,
      reason: `board has ${drill.board.length} rows; engine field is ${FIELD_HEIGHT}`,
    };
  }

  const field = normalizeField(drill.board);

  const state: EngineState = {
    field,
    active: null,
    hold: drill.hold,
    queue: [...drill.queue],
    canHold: true,
    status: "active",
    drillId: drill.id,
    lastClear: 0,
    initial: null as unknown as EngineSnapshot,
    history: [],
  };

  if (!spawnPiece(state, drill.active)) {
    return { ok: false, reason: "spawn collision" };
  }

  state.initial = snapshot(state);
  return { ok: true, state };
}

// Reject all commands while terminal. Failed commands do not flip status
// (plan §8): only post-lock spawn collision sets status:"blocked".
function requireActive(state: EngineState): EngineCommandResult | null {
  if (state.status === "blocked") {
    return fail(state, "blocked");
  }
  if (state.active === null) {
    return fail(state, "no active piece");
  }
  return null;
}

export function moveLeft(state: EngineState): EngineCommandResult {
  const blocked = requireActive(state);
  if (blocked) return blocked;
  const active = state.active!;
  const next = cellsOf(active.piece, active.rotation, active.x - 1, active.y);
  if (collides(state.field, next)) {
    return fail(state, "blocked by wall or cell");
  }
  active.x -= 1;
  return ok(state);
}

export function moveRight(state: EngineState): EngineCommandResult {
  const blocked = requireActive(state);
  if (blocked) return blocked;
  const active = state.active!;
  const next = cellsOf(active.piece, active.rotation, active.x + 1, active.y);
  if (collides(state.field, next)) {
    return fail(state, "blocked by wall or cell");
  }
  active.x += 1;
  return ok(state);
}

export function moveDown(state: EngineState): EngineCommandResult {
  const blocked = requireActive(state);
  if (blocked) return blocked;
  const active = state.active!;
  const next = cellsOf(active.piece, active.rotation, active.x, active.y - 1);
  if (collides(state.field, next)) {
    return fail(state, "blocked by floor or cell");
  }
  active.y -= 1;
  return ok(state);
}

function rotate(
  state: EngineState,
  direction: RotationDirection,
): EngineCommandResult {
  const blocked = requireActive(state);
  if (blocked) return blocked;
  const active = state.active!;
  const resolved = resolveRotation(
    active.piece,
    active.rotation,
    direction,
    active.x,
    active.y,
    (cells) => collides(state.field, cells),
    (targetRotation, x, y) => cellsOf(active.piece, targetRotation, x, y),
  );
  if (resolved === null) {
    return fail(state, "rotation blocked (no kick succeeded)");
  }
  active.rotation = resolved.rotation;
  active.x = resolved.x;
  active.y = resolved.y;
  return ok(state);
}

export function rotateCw(state: EngineState): EngineCommandResult {
  return rotate(state, "cw");
}

export function rotateCcw(state: EngineState): EngineCommandResult {
  return rotate(state, "ccw");
}

export function rotate180(state: EngineState): EngineCommandResult {
  return rotate(state, "180");
}

export function hardDrop(state: EngineState): EngineCommandResult {
  const blocked = requireActive(state);
  if (blocked) return blocked;
  const active = state.active!;
  active.y = lowestValidY(
    state.field,
    active.piece,
    active.rotation,
    active.x,
    active.y,
  );
  return ok(state);
}

// Hold (plan §3, §8): usable once per active piece. Empty hold -> store active,
// spawn next queue piece. Occupied hold -> swap active and hold. Either way
// canHold flips false. If the queue is empty and hold is empty, hold fails
// (no piece to spawn). Hold collision (spawn of the new active collides) sets
// terminal status:"blocked".
export function hold(state: EngineState): EngineCommandResult {
  const blocked = requireActive(state);
  if (blocked) return blocked;
  if (!state.canHold) {
    return fail(state, "hold already used for this piece");
  }
  const active = state.active!;
  const previousHold = state.hold;

  if (previousHold === null) {
    // Empty hold: store the active piece, spawn the next queue piece.
    if (state.queue.length === 0) {
      return fail(state, "no piece in queue to spawn after hold");
    }
    const nextPiece = state.queue[0];
    state.hold = active.piece;
    state.queue = state.queue.slice(1);
    state.active = null;
    if (!spawnPiece(state, nextPiece)) {
      state.status = "blocked";
      return fail(state, "post-hold spawn collision");
    }
    state.canHold = false;
    return ok(state);
  }

  // Occupied hold: swap active and hold. Spawn the previously-held piece; the
  // just-active piece goes into hold (without its rotation/position).
  state.hold = active.piece;
  state.active = null;
  if (!spawnPiece(state, previousHold)) {
    state.status = "blocked";
    return fail(state, "post-hold spawn collision");
  }
  state.canHold = false;
  return ok(state);
}

// Lock (plan §3, §8):
//   1. Push a deep-copied pre-lock snapshot onto history.
//   2. Write concrete filled cells.
//   3. Clear full rows; collapse above rows.
//   4. Advance the queue: queue[0] becomes the new active piece; queue shifts.
//   5. If the queue is empty, active becomes null (no top-out yet — the player
//      has simply exhausted the queue; status stays "active" until a spawn
//      collision actually occurs).
//   6. If the next piece's spawn collides, set terminal status:"blocked".
function lockWithHistory(
  state: EngineState,
  historySnapshot: EngineSnapshot,
): EngineCommandResult {
  const blocked = requireActive(state);
  if (blocked) return blocked;
  const active = state.active!;
  const cells = activeCellsOf(active);
  if (collides(state.field, cells)) {
    return fail(state, "lock position collides");
  }
  // Reject lock if any active cell is above the field (y >= FIELD_HEIGHT).
  // `collides` treats above-field as open air so pieces can rotate there, but
  // the field array has no rows beyond
  // FIELD_HEIGHT-1 and lockCells would throw on `field[40]`. This is a "lock
  // out" condition: the command is rejected without mutating state. Terminal
  // status:"blocked" is reserved for post-lock spawn collision per plan §8;
  // whether lock-out should also be a top-out is a deferred policy decision.
  for (const c of cells) {
    if (c.y >= FIELD_HEIGHT) {
      return fail(state, "lock out: piece is above the field");
    }
  }
  const lockedPlacement: LockedPlacement = {
    piece: active.piece,
    x: active.x,
    y: active.y,
    rotation: active.rotation,
  };

  // 1. Push pre-lock snapshot for undo.
  state.history.push(historySnapshot);

  // 2. Lock cells.
  lockCells(state.field, cells, active.piece);

  // 3. Clear lines.
  const result = clearLines(state.field);
  state.field = result.field;
  state.lastClear = result.cleared;

  // 4-6. Advance the queue and spawn the next piece (or go terminal).
  state.active = null;
  if (state.queue.length > 0) {
    const nextPiece = state.queue[0];
    state.queue = state.queue.slice(1);
    if (!spawnPiece(state, nextPiece)) {
      state.status = "blocked";
    }
  }
  // If the queue is empty, active stays null and status stays "active" — the
  // player has run out of pieces, which is not a top-out per plan §8.
  return ok(state, lockedPlacement);
}

export function lock(state: EngineState): EngineCommandResult {
  return lockWithHistory(state, snapshot(state));
}

// Atomic gameplay placement: hard-drop the active piece and lock it while
// storing undo history from before the placement command. This keeps user
// Undo placement-level: one Undo restores the state from before pressing
// hard drop, not the intermediate grounded active piece.
export function hardDropAndLock(state: EngineState): EngineCommandResult {
  const prePlacement = snapshot(state);
  const dropped = hardDrop(state);
  if (!dropped.ok) {
    return dropped;
  }
  return lockWithHistory(state, prePlacement);
}

// Undo (plan §8): pop the top pre-lock snapshot from history and restore
// field, active, hold, queue, canHold, status, lastClear from it. The public
// EngineSnapshot excludes history; after undo, history is simply the remaining
// stack. No redo.
export function undo(state: EngineState): EngineCommandResult {
  if (state.history.length === 0) {
    return fail(state, "no history to undo");
  }
  const popped = state.history.pop()!;
  state.field = popped.field;
  state.active = popped.active === null ? null : { ...popped.active };
  state.hold = popped.hold;
  state.queue = [...popped.queue];
  state.canHold = popped.canHold;
  state.status = popped.status;
  state.lastClear = popped.lastClear;
  return ok(state);
}

// Reset (plan §8): restore the initial snapshot and clear history.
export function reset(state: EngineState): EngineCommandResult {
  state.field = cloneField(state.initial.field);
  state.active =
    state.initial.active === null ? null : { ...state.initial.active };
  state.hold = state.initial.hold;
  state.queue = [...state.initial.queue];
  state.canHold = state.initial.canHold;
  state.status = state.initial.status;
  state.lastClear = state.initial.lastClear;
  state.history = [];
  return ok(state);
}
