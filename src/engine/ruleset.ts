// Centralized ruleset for the TETR.IO-default rotation system.
//
// Single source of truth for:
//   - SPAWN_ORIGIN (plan §6)
//   - Rotation state transitions (0 <-> R <-> 2 <-> L)
//   - 90° SRS wall kick tables (JLSTZ + I) transcribed from Hard Drop
//   - TETR.IO SRS+ I-piece symmetry rule (left-side kicks mirrored along y-axis)
//   - 180° SRS+ kick resolution via fixtures/srsPlus180Kicks.ts
//
// OFFSETS in tetrominoes.ts is the single source of truth for occupied cells;
// the kick tables here are the single source of truth for rotation transitions
// (plan §6 "Origin stability"). Kick (dx,dy) values apply directly in the same
// origin frame as OFFSETS (the canonical SRS local grid) — no frame conversion.

import type { PieceId, RotationState } from "./pieces.ts";
import type { Coord } from "./tetrominoes.ts";
import {
  KICKS_180,
  transition180Key,
  type Kick,
  type KickList,
} from "./fixtures/srsPlus180Kicks.ts";

// --- Spawn origin (plan §6) ------------------------------------------------
//
// Pieces spawn in the hidden buffer (rows 20..39). x=3 for I/J/L/S/T/Z (the
// 3- and 4-wide pieces lean left per SRS), x=4 for O. y is chosen so the
// piece's lowest occupied cell sits at y=38. For floating pieces (I/J/L/S/T/Z
// occupy dy=1 as their lowest row in their spawn grid), origin y=37 gives
// lowest cell y=38. For O (lowest dy=0), origin y=38 gives lowest cell y=38.
//
// Verified by spawn tests in gameState.test.ts (2A) and ruleset.test.ts (2B).
export const SPAWN_ORIGIN: Record<PieceId, { x: number; y: number }> = {
  I: { x: 3, y: 37 },
  O: { x: 4, y: 38 },
  T: { x: 3, y: 37 },
  S: { x: 3, y: 37 },
  Z: { x: 3, y: 37 },
  J: { x: 3, y: 37 },
  L: { x: 3, y: 37 },
};

// --- Rotation state transitions -------------------------------------------

export const CW_NEXT: Record<RotationState, RotationState> = {
  "0": "R",
  R: "2",
  "2": "L",
  L: "0",
};

export const CCW_NEXT: Record<RotationState, RotationState> = {
  "0": "L",
  L: "2",
  "2": "R",
  R: "0",
};

// 180 rotation target state (same regardless of direction).
export const ROTATE_180_NEXT: Record<RotationState, RotationState> = {
  "0": "2",
  R: "L",
  "2": "0",
  L: "R",
};

// --- 90° SRS kick tables (transcribed from Hard Drop) ----------------------
//
// Source: https://harddrop.com/wiki/SRS (retrieved 2026-06-17).
// Convention: +x right, +y up (matches plan §6 origin frame).
// Each transition lists 5 kick tests in order; the first test (0,0) is the
// basic rotation itself. Tests in ruleset.test.ts assert specific (dx,dy)
// values per transition for I, T, and J (representing JLSTZ).

type Transition90 =
  | "0->R"
  | "R->0"
  | "R->2"
  | "2->R"
  | "2->L"
  | "L->2"
  | "L->0"
  | "0->L";

function transition90Key(
  from: RotationState,
  to: RotationState,
): Transition90 | null {
  const key = `${from}->${to}` as Transition90;
  if (
    key === "0->R" ||
    key === "R->0" ||
    key === "R->2" ||
    key === "2->R" ||
    key === "2->L" ||
    key === "L->2" ||
    key === "L->0" ||
    key === "0->L"
  ) {
    return key;
  }
  return null;
}

// J, L, S, T, Z — shared SRS kick table.
const KICKS_90_JLSTZ: Record<Transition90, KickList> = {
  "0->R": [
    { dx: 0, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: -1, dy: 1 },
    { dx: 0, dy: -2 },
    { dx: -1, dy: -2 },
  ],
  "R->0": [
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 1, dy: -1 },
    { dx: 0, dy: 2 },
    { dx: 1, dy: 2 },
  ],
  "R->2": [
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 1, dy: -1 },
    { dx: 0, dy: 2 },
    { dx: 1, dy: 2 },
  ],
  "2->R": [
    { dx: 0, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: -1, dy: 1 },
    { dx: 0, dy: -2 },
    { dx: -1, dy: -2 },
  ],
  "2->L": [
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 1, dy: 1 },
    { dx: 0, dy: -2 },
    { dx: 1, dy: -2 },
  ],
  "L->2": [
    { dx: 0, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: -1, dy: -1 },
    { dx: 0, dy: 2 },
    { dx: -1, dy: 2 },
  ],
  "L->0": [
    { dx: 0, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: -1, dy: -1 },
    { dx: 0, dy: 2 },
    { dx: -1, dy: 2 },
  ],
  "0->L": [
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 1, dy: 1 },
    { dx: 0, dy: -2 },
    { dx: 1, dy: -2 },
  ],
};

// I — standard SRS kick table (Hard Drop). TETR.IO SRS+ modifies this by
// mirroring the LEFT-side transitions along the y-axis (see below).
const KICKS_90_I_STANDARD: Record<Transition90, KickList> = {
  "0->R": [
    { dx: 0, dy: 0 },
    { dx: -2, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: -2, dy: -1 },
    { dx: 1, dy: 2 },
  ],
  "R->0": [
    { dx: 0, dy: 0 },
    { dx: 2, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 2, dy: 1 },
    { dx: -1, dy: -2 },
  ],
  "R->2": [
    { dx: 0, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 2, dy: 0 },
    { dx: -1, dy: 2 },
    { dx: 2, dy: -1 },
  ],
  "2->R": [
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: -2, dy: 0 },
    { dx: 1, dy: -2 },
    { dx: -2, dy: 1 },
  ],
  "2->L": [
    { dx: 0, dy: 0 },
    { dx: 2, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 2, dy: 1 },
    { dx: -1, dy: -2 },
  ],
  "L->2": [
    { dx: 0, dy: 0 },
    { dx: -2, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: -2, dy: -1 },
    { dx: 1, dy: 2 },
  ],
  "L->0": [
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: -2, dy: 0 },
    { dx: 1, dy: -2 },
    { dx: -2, dy: 1 },
  ],
  "0->L": [
    { dx: 0, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 2, dy: 0 },
    { dx: -1, dy: 2 },
    { dx: 2, dy: -1 },
  ],
};

// TETR.IO SRS+ I-piece symmetry rule (plan §7):
//
//   "TETR.IO SRS+ modifies standard SRS so I wall kicks are symmetrical along
//    the y-axis, similarly to TGM3, but with the LEFT-side kick tables mirrored
//    instead of the right side."
//
// Mirroring a kick table along the y-axis means negating dx for every test.
// The "left-side" transitions are those rotating toward the left/West state:
// 0->L (CW from North goes to East, so 0->L is the CCW/left turn) and L->0
// (the inverse). Per the SRS+ rule, these are mirrored (dx negated) relative
// to standard SRS. The other I transitions keep standard SRS values.
//
// This is implemented as a derived table so the standard SRS I data stays the
// verbatim Hard Drop transcription above; only the SRS+ modification is
// applied separately and is clearly labeled.
const KICKS_90_I_SRS_PLUS: Record<Transition90, KickList> = {
  ...KICKS_90_I_STANDARD,
  "0->L": KICKS_90_I_STANDARD["0->L"].map((k) => ({ dx: -k.dx, dy: k.dy })),
  "L->0": KICKS_90_I_STANDARD["L->0"].map((k) => ({ dx: -k.dx, dy: k.dy })),
};

function kicks90(
  piece: PieceId,
  from: RotationState,
  to: RotationState,
): KickList | null {
  const key = transition90Key(from, to);
  if (key === null) {
    return null;
  }
  // O has no 90° kicks — only the (0,0) identity test applies, and the
  // occupied cells are identical across rotations. The caller handles O by
  // just changing the rotation state label; this function is not called for O.
  if (piece === "O") {
    return [{ dx: 0, dy: 0 }];
  }
  if (piece === "I") {
    return KICKS_90_I_SRS_PLUS[key];
  }
  return KICKS_90_JLSTZ[key];
}

function kicks180(from: RotationState, to: RotationState): KickList | null {
  const key = transition180Key(from, to);
  if (key === null) {
    return null;
  }
  return KICKS_180[key];
}

// --- Kick resolution ------------------------------------------------------
//
// Given a piece, a desired rotation (CW/CCW/180) from its current state, the
// current origin, and a collision predicate, return the resolved origin
// (after applying the first non-colliding kick) or null if no kick succeeds.
//
// The caller passes `cellsAt(origin)` which computes the occupied cells for
// the TARGET rotation at a candidate origin. This keeps ruleset.ts decoupled
// from the field/collision module.

export type RotationDirection = "cw" | "ccw" | "180";

export function targetRotation(
  current: RotationState,
  direction: RotationDirection,
): RotationState {
  switch (direction) {
    case "cw":
      return CW_NEXT[current];
    case "ccw":
      return CCW_NEXT[current];
    case "180":
      return ROTATE_180_NEXT[current];
  }
}

export function resolveRotation(
  piece: PieceId,
  currentRotation: RotationState,
  direction: RotationDirection,
  originX: number,
  originY: number,
  collidesAt: (cells: Coord[]) => boolean,
  cellsForTarget: (
    targetRotation: RotationState,
    x: number,
    y: number,
  ) => Coord[],
): { x: number; y: number; rotation: RotationState } | null {
  const target = targetRotation(currentRotation, direction);

  // O-piece: occupied cells are identical across all rotation states; only
  // the rotation label changes. No kick needed (and no kick table applies).
  if (piece === "O") {
    const cells = cellsForTarget(target, originX, originY);
    if (collidesAt(cells)) {
      return null;
    }
    return { x: originX, y: originY, rotation: target };
  }

  const kicks =
    direction === "180"
      ? kicks180(currentRotation, target)
      : kicks90(piece, currentRotation, target);

  if (kicks === null) {
    return null;
  }

  for (const kick of kicks) {
    const x = originX + kick.dx;
    const y = originY + kick.dy;
    const cells = cellsForTarget(target, x, y);
    if (!collidesAt(cells)) {
      return { x, y, rotation: target };
    }
  }
  return null;
}

export type { Kick, KickList };
