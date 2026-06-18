import { describe, it, expect } from "vitest";
import { decoder } from "tetris-fumen";
import { emptyField, lockCells, type Field } from "../engine/board.ts";
import type { BoardCell } from "../drills/drillTypes.ts";
import {
  BOARD_WIDTH,
  FIELD_HEIGHT,
  VISIBLE_HEIGHT,
} from "../engine/constants.ts";
import { exportVisiblePlayfieldToFumen } from "./fumenAdapter.ts";

function decodeField(code: string): BoardCell[][] {
  // Decode one page; reconstruct an engine-style 10-wide row for the 20
  // visible rows (y=0..VISIBLE_HEIGHT-1). Pieces survive decode as fumen
  // PieceType strings, which match engine PieceId for I/J/L/O/S/T/Z.
  const page = decoder.decode(code)[0];
  const rows: BoardCell[][] = [];
  for (let y = 0; y < VISIBLE_HEIGHT; y++) {
    const row: BoardCell[] = new Array<BoardCell>(BOARD_WIDTH).fill(null);
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const t = page.field.at(x, y);
      if (t === "X") {
        row[x] = { kind: "garbage" };
      } else if (
        t === "I" ||
        t === "J" ||
        t === "L" ||
        t === "O" ||
        t === "S" ||
        t === "T" ||
        t === "Z"
      ) {
        row[x] = { kind: "filled", piece: t };
      } else {
        row[x] = null;
      }
    }
    rows.push(row);
  }
  return rows;
}

describe("exportVisiblePlayfieldToFumen", () => {
  it("exports and decodes an empty 20-row field", () => {
    const field = emptyField();
    const result = exportVisiblePlayfieldToFumen(field);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rows = decodeField(result.code);
    for (let y = 0; y < VISIBLE_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        expect(rows[y][x]).toBeNull();
      }
    }
  });

  it("round-trips filled cells for every piece type", () => {
    const field = emptyField();
    // Place a single-cell "singleton" of each piece at distinct (x, y) so the
    // round-trip can confirm cell mapping. Each cell uses a separate row
    // because the source field has only one cell per row.
    const piecePlacements: Array<{
      piece: "I" | "J" | "L" | "O" | "S" | "T" | "Z";
      x: number;
      y: number;
    }> = [
      { piece: "I", x: 0, y: 0 },
      { piece: "J", x: 1, y: 1 },
      { piece: "L", x: 2, y: 2 },
      { piece: "O", x: 3, y: 3 },
      { piece: "S", x: 4, y: 4 },
      { piece: "T", x: 5, y: 5 },
      { piece: "Z", x: 6, y: 6 },
    ];
    for (const p of piecePlacements) {
      lockCells(field, [{ x: p.x, y: p.y }], p.piece);
    }
    const result = exportVisiblePlayfieldToFumen(field);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rows = decodeField(result.code);
    for (const p of piecePlacements) {
      expect(rows[p.y][p.x]).toEqual({ kind: "filled", piece: p.piece });
    }
  });

  it("preserves a 4-wide horizontal I row at the bottom of the field", () => {
    const field = emptyField();
    lockCells(
      field,
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
      "I",
    );
    const result = exportVisiblePlayfieldToFumen(field);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rows = decodeField(result.code);
    for (const x of [0, 1, 2, 3]) {
      expect(rows[0][x]).toEqual({ kind: "filled", piece: "I" });
    }
    // Row above stays empty.
    for (let x = 0; x < BOARD_WIDTH; x++) {
      expect(rows[1][x]).toBeNull();
    }
  });

  it("round-trips garbage cells as X", () => {
    const field = emptyField();
    field[0][4] = { kind: "garbage" };
    field[3][9] = { kind: "garbage" };
    const result = exportVisiblePlayfieldToFumen(field);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rows = decodeField(result.code);
    expect(rows[0][4]).toEqual({ kind: "garbage" });
    expect(rows[3][9]).toEqual({ kind: "garbage" });
    // And confirm the fumen PieceType is X (i.e. the raw fumen encoding
    // reports it as X, not "G" or similar).
    const page = decoder.decode(result.code)[0];
    expect(page.field.at(4, 0)).toBe("X");
  });

  it("rejects a locked cell at y >= 20 with a useful reason", () => {
    const field: Field = emptyField();
    // Engine field is FIELD_HEIGHT tall; place a cell in the hidden spawn
    // band (y >= 20). This row is above the visible 20-row playfield and
    // cannot be expressed in fumen's visible 20 rows + 3 spawn rows above
    // them without losing context. Reject the export.
    field[20] = new Array<BoardCell>(BOARD_WIDTH).fill(null);
    field[20][3] = { kind: "filled", piece: "I" };
    const result = exportVisiblePlayfieldToFumen(field);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/y=20/);
    expect(result.reason.toLowerCase()).toContain("visible");
  });

  it("rejects a locked cell at the very top of the engine field", () => {
    const field: Field = emptyField();
    const topY = FIELD_HEIGHT - 1;
    field[topY] = new Array<BoardCell>(BOARD_WIDTH).fill(null);
    field[topY][0] = { kind: "filled", piece: "T" };
    const result = exportVisiblePlayfieldToFumen(field);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(new RegExp(`y=${topY}`));
  });

  it("export does not require active, hold, queue, or metadata", () => {
    // The function only takes a Field. Confirm the signature: passing a
    // plain empty field with no other drill context still encodes cleanly.
    const result = exportVisiblePlayfieldToFumen(emptyField());
    expect(result.ok).toBe(true);
  });

  it("encoded code is a fumen v115 string", () => {
    const result = exportVisiblePlayfieldToFumen(emptyField());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.code.startsWith("v115@")).toBe(true);
  });
});
