import type { PieceId, RotationState } from "./pieces.ts";

// Origin convention (plan §6, locked by synthetic tests in tetrominoes.test.ts):
//
// The piece origin is the bottom-left of the piece's canonical SRS local grid
// in engine coordinates (y-up). Local grid sizes: 3x3 for J/L/S/T/Z, 4x4 for I,
// 2x2 for O. Pieces "float" inside that grid per standard SRS (e.g. horizontal
// I occupies the second-from-bottom row of its 4x4; J/L/S/T/Z spawn flat-side
// first in the middle row of their 3x3).
//
// OFFSETS[piece][rotation] is the set of {dx,dy} offsets (dy positive upward)
// that, translated by the origin (x,y), yield the four occupied cells. This is
// NOT the minimal occupied bounding box: the canonical SRS local grid is used
// so that the Hard Drop SRS wall-kick (dx,dy) tables apply directly in this
// same origin frame with no extra frame conversion (plan §7).
//
// ExpectedPlacement.x/y (drill format) uses this same engine origin, so Sprint 4
// solution matching can reuse OFFSETS directly.

export type Coord = { x: number; y: number };

export const OFFSETS: Record<
  PieceId,
  Record<RotationState, ReadonlyArray<Coord>>
> = {
  // I — 4x4 local grid. Rotation center at the gridline intersection (1.5, 1.5).
  I: {
    // ....     ....     ....     .X..
    // XXXX  R: ..X.  2: ....  L: .X..
    // ....     ..X.     XXXX     .X..
    // ....     ..X.     ....     .X..
    "0": [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ],
    R: [
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
    ],
    "2": [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ],
    L: [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 3 },
    ],
  },
  // O — 2x2 local grid. Occupied cells identical across rotation states; only
  // the rotation state label changes. SRS O "wobble" is handled by kick offset
  // data in Sprint 2B, not by OFFSETS.
  O: {
    "0": [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
    R: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
    "2": [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
    L: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
  },
  // T — 3x3 local grid. Rotation center at the center cell (1, 1).
  T: {
    // .X.   .X.    ...     .X.
    // XXX R .XX 2 XXX L XX.
    // ...   .X.    .X.     .X.
    "0": [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
    ],
    R: [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 1 },
    ],
    "2": [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 0 },
    ],
    L: [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 0, y: 1 },
    ],
  },
  // S — 3x3 local grid.
  S: {
    // .XX   .X.    ...     X..
    // XX. R .XX 2 .XX L XX.
    // ...   ..X    XX.     .X.
    "0": [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ],
    R: [
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ],
    "2": [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    L: [
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ],
  },
  // Z — 3x3 local grid.
  Z: {
    // XX.   ..X    ...     .X.
    // .XX R .XX 2 XX. L XX.
    // ...   .X.    .XX     X..
    "0": [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    R: [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ],
    "2": [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ],
    L: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
  },
  // J — 3x3 local grid.
  J: {
    // X..   .XX    ...     XX.
    // XXX R .X. 2 XXX L .X.
    // ...   .X.    ..X     .X.
    "0": [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 0, y: 2 },
    ],
    R: [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ],
    "2": [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 0 },
    ],
    L: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
  },
  // L — 3x3 local grid.
  L: {
    // ..X   .X.    ...     .X.
    // XXX R .X. 2 XXX L XX.
    // ...   .XX    X..     .X.
    "0": [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ],
    R: [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 0 },
    ],
    "2": [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    L: [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ],
  },
};

export function cellsOf(
  piece: PieceId,
  rotation: RotationState,
  originX: number,
  originY: number,
): Coord[] {
  const offsets = OFFSETS[piece][rotation];
  const cells: Coord[] = new Array(offsets.length);
  for (let i = 0; i < offsets.length; i++) {
    const o = offsets[i];
    cells[i] = { x: originX + o.x, y: originY + o.y };
  }
  return cells;
}
