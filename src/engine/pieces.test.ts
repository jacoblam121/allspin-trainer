import { describe, it, expect } from "vitest";
import { PIECE_IDS, PIECE_ID_SET, SPAWN_GRID, isPieceId } from "./pieces.ts";

describe("engine pieces (inert display data)", () => {
  it("covers the seven tetrominoes", () => {
    expect(PIECE_IDS).toEqual(["I", "O", "T", "S", "Z", "J", "L"]);
    expect(PIECE_ID_SET.size).toBe(7);
  });

  it("provides a spawn grid for every piece", () => {
    for (const id of PIECE_IDS) {
      const grid = SPAWN_GRID[id];
      expect(grid.length).toBeGreaterThan(0);
      const occupied = grid.flat().filter(Boolean).length;
      expect(occupied).toBe(4);
    }
  });

  it("uses SRS spawn shapes", () => {
    expect(SPAWN_GRID.I).toEqual([[true, true, true, true]]);
    expect(SPAWN_GRID.O).toEqual([
      [true, true],
      [true, true],
    ]);
    expect(SPAWN_GRID.T).toEqual([
      [false, true, false],
      [true, true, true],
    ]);
    expect(SPAWN_GRID.S).toEqual([
      [false, true, true],
      [true, true, false],
    ]);
    expect(SPAWN_GRID.Z).toEqual([
      [true, true, false],
      [false, true, true],
    ]);
    expect(SPAWN_GRID.J).toEqual([
      [true, false, false],
      [true, true, true],
    ]);
    expect(SPAWN_GRID.L).toEqual([
      [false, false, true],
      [true, true, true],
    ]);
  });

  it("validates piece ids", () => {
    expect(isPieceId("T")).toBe(true);
    expect(isPieceId("X")).toBe(false);
    expect(isPieceId(null)).toBe(false);
  });
});
