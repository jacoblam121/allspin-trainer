import { describe, it, expect } from "vitest";
import {
  emptyField,
  normalizeField,
  cloneField,
  inBounds,
  isOccupied,
  collides,
  lockCells,
  clearLines,
} from "./board.ts";
import { BOARD_WIDTH, FIELD_HEIGHT } from "./constants.ts";
import type { BoardCell } from "../drills/drillTypes.ts";

function row(piece: string, holes: number[] = []): BoardCell[] {
  const cells: BoardCell[] = new Array(BOARD_WIDTH).fill(null);
  if (piece === "garbage") {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (!holes.includes(x)) {
        cells[x] = { kind: "garbage" };
      }
    }
  } else {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (!holes.includes(x)) {
        cells[x] = { kind: "filled", piece: piece as never };
      }
    }
  }
  return cells;
}

describe("board field", () => {
  it("emptyField is FIELD_HEIGHT x BOARD_WIDTH of nulls", () => {
    const f = emptyField();
    expect(f).toHaveLength(FIELD_HEIGHT);
    for (const r of f) {
      expect(r).toHaveLength(BOARD_WIDTH);
      expect(r.every((c) => c === null)).toBe(true);
    }
  });

  it("normalizes a short bottom-origin board by padding empty rows on top", () => {
    const authored: BoardCell[][] = [row("I"), row("O", [3])];
    expect(authored).toHaveLength(2);
    const f = normalizeField(authored);
    expect(f).toHaveLength(FIELD_HEIGHT);
    // Bottom row (y=0) is the first authored row (full I row).
    expect(f[0][0]).toEqual({ kind: "filled", piece: "I" as never });
    // Second authored row at y=1 with a hole at x=3.
    expect(f[1][3]).toBeNull();
    expect(f[1][0]).toEqual({ kind: "filled", piece: "O" as never });
    // Everything from y=2 up is empty (padded on top).
    for (let y = 2; y < FIELD_HEIGHT; y++) {
      expect(f[y].every((c) => c === null)).toBe(true);
    }
  });

  it("normalizeField preserves authored row order (bottom-origin)", () => {
    const authored: BoardCell[][] = [row("J"), row("L")];
    const f = normalizeField(authored);
    expect(f[0][0]).toEqual({ kind: "filled", piece: "J" as never });
    expect(f[1][0]).toEqual({ kind: "filled", piece: "L" as never });
  });

  it("cloneField produces an equal but independent field", () => {
    const f = emptyField();
    f[0][0] = { kind: "filled", piece: "T" as never };
    const c = cloneField(f);
    expect(c).toEqual(f);
    c[0][0] = null;
    expect(f[0][0]).toEqual({ kind: "filled", piece: "T" as never });
  });
});

describe("board collision", () => {
  it("inBounds covers 0..9 x 0..FIELD_HEIGHT-1", () => {
    expect(inBounds(0, 0)).toBe(true);
    expect(inBounds(9, FIELD_HEIGHT - 1)).toBe(true);
    expect(inBounds(-1, 0)).toBe(false);
    expect(inBounds(10, 0)).toBe(false);
    expect(inBounds(0, -1)).toBe(false);
    expect(inBounds(0, FIELD_HEIGHT)).toBe(false);
  });

  it("isOccupied treats walls and floor as occupied, open air above as free", () => {
    const f = emptyField();
    expect(isOccupied(f, -1, 5)).toBe(true);
    expect(isOccupied(f, 10, 5)).toBe(true);
    expect(isOccupied(f, 5, -1)).toBe(true);
    expect(isOccupied(f, 5, FIELD_HEIGHT)).toBe(false);
    expect(isOccupied(f, 5, FIELD_HEIGHT + 5)).toBe(false);
    f[5][5] = { kind: "filled", piece: "I" as never };
    expect(isOccupied(f, 5, 5)).toBe(true);
    expect(isOccupied(f, 6, 5)).toBe(false);
  });

  it("collides returns true if any cell hits a wall/floor/occupied cell", () => {
    const f = emptyField();
    expect(collides(f, [{ x: 0, y: 0 }])).toBe(false);
    expect(collides(f, [{ x: -1, y: 0 }])).toBe(true);
    expect(
      collides(f, [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]),
    ).toBe(true);
    f[0][3] = { kind: "garbage" };
    expect(collides(f, [{ x: 3, y: 0 }])).toBe(true);
  });
});

describe("board lock and line clear", () => {
  it("lockCells writes concrete filled cells", () => {
    const f = emptyField();
    lockCells(
      f,
      [
        { x: 2, y: 0 },
        { x: 2, y: 1 },
      ],
      "I",
    );
    expect(f[0][2]).toEqual({ kind: "filled", piece: "I" });
    expect(f[1][2]).toEqual({ kind: "filled", piece: "I" });
    expect(f[0][3]).toBeNull();
  });

  it("clearLines removes full rows and collapses above rows downward", () => {
    const f = emptyField();
    // y=0: full garbage row (with a hole? no -> full)
    f[0] = row("garbage");
    // y=1: one cell
    f[1][0] = { kind: "filled", piece: "T" };
    // y=2: full I row
    f[2] = row("I");
    // y=3: two cells
    f[3][5] = { kind: "filled", piece: "O" };
    f[3][6] = { kind: "filled", piece: "O" };

    const result = clearLines(f);
    expect(result.cleared).toBe(2);
    expect(result.field).toHaveLength(FIELD_HEIGHT);
    // After clearing y=0 and y=2, the surviving rows (y=1, y=3) collapse to
    // y=0 and y=1 respectively, and the rest are empty on top.
    expect(result.field[0][0]).toEqual({ kind: "filled", piece: "T" });
    expect(result.field[1][5]).toEqual({ kind: "filled", piece: "O" });
    expect(result.field[1][6]).toEqual({ kind: "filled", piece: "O" });
    for (let y = 2; y < FIELD_HEIGHT; y++) {
      expect(result.field[y].every((c) => c === null)).toBe(true);
    }
  });

  it("clearLines is pure and does not mutate the input", () => {
    const f = emptyField();
    f[0] = row("I");
    const before = cloneField(f);
    const result = clearLines(f);
    expect(result.cleared).toBe(1);
    expect(f).toEqual(before);
  });

  it("clearLines leaves an empty field unchanged (cleared=0)", () => {
    const f = emptyField();
    const result = clearLines(f);
    expect(result.cleared).toBe(0);
    expect(result.field).toEqual(f);
  });

  it("a row with a hole is not cleared", () => {
    const f = emptyField();
    f[0] = row("I", [4]);
    const result = clearLines(f);
    expect(result.cleared).toBe(0);
    expect(result.field[0][4]).toBeNull();
  });
});
