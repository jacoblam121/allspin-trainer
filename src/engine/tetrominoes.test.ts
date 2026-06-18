import { describe, it, expect } from "vitest";
import { OFFSETS, cellsOf } from "./tetrominoes.ts";
import { PIECE_IDS } from "./pieces.ts";
import type { Coord } from "./tetrominoes.ts";

function asSet(cells: ReadonlyArray<Coord>): string[] {
  return cells.map((c) => `${c.x},${c.y}`).sort();
}

describe("engine tetrominoes OFFSETS", () => {
  it("provides four offsets for every piece and rotation", () => {
    for (const id of PIECE_IDS) {
      for (const rotation of ["0", "R", "2", "L"] as const) {
        const offsets = OFFSETS[id][rotation];
        expect(offsets).toHaveLength(4);
        const unique = new Set(offsets.map((c) => `${c.x},${c.y}`));
        expect(unique.size).toBe(4);
      }
    }
  });

  it("I floats in the second-from-bottom row of its 4x4 grid (origin convention)", () => {
    // I "0": offsets row dy=1 -> translated by origin (3,5) yields y=6 across x=3..6
    expect(asSet(cellsOf("I", "0", 3, 5))).toEqual([
      "3,6",
      "4,6",
      "5,6",
      "6,6",
    ]);
  });

  it("T floats in its 3x3 grid: middle row plus top-middle (origin convention)", () => {
    // T "0": offsets {0,1},{1,1},{2,1},{1,2} translated by (3,5) -> y=6 row + nub at y=7
    // JLSTZ float per SRS (spawn state not touching the bottom of the 3x3 grid).
    expect(asSet(cellsOf("T", "0", 3, 5))).toEqual([
      "3,6",
      "4,6",
      "4,7",
      "5,6",
    ]);
  });

  it("O has identical occupied cells across all rotation states", () => {
    const spawn = asSet(cellsOf("O", "0", 5, 5));
    for (const rotation of ["R", "2", "L"] as const) {
      expect(asSet(cellsOf("O", rotation, 5, 5))).toEqual(spawn);
    }
    expect(spawn).toEqual(["5,5", "5,6", "6,5", "6,6"]);
  });

  it("I vertical states occupy a single column of the 4x4 grid", () => {
    // I "R" -> column x=2 (offsets dx=2 across dy=0..3)
    expect(asSet(cellsOf("I", "R", 3, 5))).toEqual([
      "5,5",
      "5,6",
      "5,7",
      "5,8",
    ]);
    // I "L" -> column x=1
    expect(asSet(cellsOf("I", "L", 3, 5))).toEqual([
      "4,5",
      "4,6",
      "4,7",
      "4,8",
    ]);
  });

  it("rotating I 180 keeps it horizontal but shifts up one row within the 4x4 grid", () => {
    // I "0" at row dy=1, I "2" at row dy=2 (same origin)
    const spawn = asSet(cellsOf("I", "0", 3, 5));
    const rotated180 = asSet(cellsOf("I", "2", 3, 5));
    expect(spawn).toEqual(["3,6", "4,6", "5,6", "6,6"]);
    expect(rotated180).toEqual(["3,7", "4,7", "5,7", "6,7"]);
  });

  it("S and Z spawn shapes match SRS (S: top-right + middle-left; Z: top-left + middle-right)", () => {
    // S "0": offsets {0,1},{1,1},{1,2},{2,2}
    expect(asSet(cellsOf("S", "0", 0, 0))).toEqual([
      "0,1",
      "1,1",
      "1,2",
      "2,2",
    ]);
    // Z "0": offsets {0,2},{1,2},{1,1},{2,1}
    expect(asSet(cellsOf("Z", "0", 0, 0))).toEqual([
      "0,2",
      "1,1",
      "1,2",
      "2,1",
    ]);
  });

  it("J and L spawn shapes mirror each other (nub up-left vs up-right)", () => {
    // J "0": {0,1},{1,1},{2,1},{0,2} (nub up-left)
    expect(asSet(cellsOf("J", "0", 0, 0))).toEqual([
      "0,1",
      "0,2",
      "1,1",
      "2,1",
    ]);
    // L "0": {0,1},{1,1},{2,1},{2,2} (nub up-right)
    expect(asSet(cellsOf("L", "0", 0, 0))).toEqual([
      "0,1",
      "1,1",
      "2,1",
      "2,2",
    ]);
  });

  it("all occupied cells stay within the local grid bounds (I 4x4, JLSTZ 3x3, O 2x2)", () => {
    for (const id of PIECE_IDS) {
      const maxBound = id === "I" ? 4 : id === "O" ? 2 : 3;
      for (const rotation of ["0", "R", "2", "L"] as const) {
        for (const o of OFFSETS[id][rotation]) {
          expect(o.x).toBeGreaterThanOrEqual(0);
          expect(o.y).toBeGreaterThanOrEqual(0);
          expect(o.x).toBeLessThan(maxBound);
          expect(o.y).toBeLessThan(maxBound);
        }
      }
    }
  });
});
