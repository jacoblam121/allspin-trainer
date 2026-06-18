import { BOARD_WIDTH, FIELD_HEIGHT } from "./constants.ts";
import type { BoardCell } from "../drills/drillTypes.ts";
import type { PieceId } from "./pieces.ts";
import type { Coord } from "./tetrominoes.ts";

// Field is indexed field[y][x] with y=0 at the bottom and y=FIELD_HEIGHT-1 at
// the top (plan §6). Authored drill boards are bottom-origin as well; the
// renderer already displays them top-first. Engine code never mixes renderer
// coordinates into field access.
export type Field = BoardCell[][];

export function emptyRow(): BoardCell[] {
  return new Array<BoardCell>(BOARD_WIDTH).fill(null);
}

export function emptyField(): Field {
  const field: Field = new Array(FIELD_HEIGHT);
  for (let y = 0; y < FIELD_HEIGHT; y++) {
    field[y] = emptyRow();
  }
  return field;
}

// Normalize an authored drill board into a 10 x FIELD_HEIGHT field.
// Authored rows are bottom-origin (row 0 = bottom); missing rows are padded as
// empty rows ON TOP. The caller (createEngineFromDrill) must reject boards with
// more than FIELD_HEIGHT authored rows before calling this (plan §9).
export function normalizeField(authored: BoardCell[][]): Field {
  const field = emptyField();
  const count = Math.min(authored.length, FIELD_HEIGHT);
  for (let y = 0; y < count; y++) {
    const row = authored[y];
    for (let x = 0; x < BOARD_WIDTH; x++) {
      field[y][x] = row[x] ?? null;
    }
  }
  return field;
}

export function cloneField(field: Field): Field {
  const copy: Field = new Array(field.length);
  for (let y = 0; y < field.length; y++) {
    copy[y] = field[y].slice();
  }
  return copy;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_WIDTH && y >= 0 && y < FIELD_HEIGHT;
}

// A cell collides if it is against a wall/floor, or if its in-field cell is
// occupied. Cells above the field (y >= FIELD_HEIGHT) are open air — pieces
// spawn and rotate in the hidden buffer and must not collide with an
// out-of-range top edge. The bottom (y < 0) is the floor.
export function isOccupied(field: Field, x: number, y: number): boolean {
  if (x < 0 || x >= BOARD_WIDTH || y < 0) {
    return true;
  }
  if (y >= FIELD_HEIGHT) {
    return false;
  }
  return field[y][x] !== null;
}

export function collides(field: Field, cells: ReadonlyArray<Coord>): boolean {
  for (const c of cells) {
    if (isOccupied(field, c.x, c.y)) {
      return true;
    }
  }
  return false;
}

// Write concrete {kind:"filled"; piece} cells for a locked placement. The
// caller guarantees the cells are in-bounds and non-overlapping with existing
// filled cells (verified via collides() before lock).
export function lockCells(
  field: Field,
  cells: ReadonlyArray<Coord>,
  piece: PieceId,
): void {
  for (const c of cells) {
    field[c.y][c.x] = { kind: "filled", piece };
  }
}

function isRowFull(row: BoardCell[]): boolean {
  for (let x = 0; x < BOARD_WIDTH; x++) {
    if (row[x] === null) {
      return false;
    }
  }
  return true;
}

// Clear full rows and collapse above rows downward. Returns a new field plus the
// number of cleared rows. Pure: does not mutate the input field. A row is full
// if every cell is non-null (garbage or filled). Surviving rows keep their
// bottom-origin order; empty rows are padded on top to maintain FIELD_HEIGHT.
export function clearLines(field: Field): {
  field: Field;
  cleared: number;
} {
  const surviving: BoardCell[][] = [];
  let cleared = 0;
  for (let y = 0; y < field.length; y++) {
    if (isRowFull(field[y])) {
      cleared++;
    } else {
      surviving.push(field[y]);
    }
  }
  const newField: Field = new Array(FIELD_HEIGHT);
  for (let y = 0; y < surviving.length; y++) {
    newField[y] = surviving[y];
  }
  for (let y = surviving.length; y < FIELD_HEIGHT; y++) {
    newField[y] = emptyRow();
  }
  return { field: newField, cleared };
}
