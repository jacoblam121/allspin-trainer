import { describe, it, expect } from "vitest";
import { BOARD_WIDTH, FIELD_HEIGHT } from "../engine/constants.ts";
import { emptyField, type Field } from "../engine/board.ts";
import type { BoardCell } from "./drillTypes.ts";
import type {
  AcceptedOutcome,
  BoardMaskRow,
  MaskCell,
} from "./drillTypesV2.ts";
import { findAcceptedOutcome, matchesBoardMask } from "./outcomeMatcher.ts";

function anyRow(): BoardMaskRow {
  return new Array(BOARD_WIDTH).fill({ kind: "any" });
}

function nullMaskRow(): BoardMaskRow {
  return new Array<MaskCell>(BOARD_WIDTH).fill(null);
}

function nullFieldRow(): BoardCell[] {
  return new Array<BoardCell>(BOARD_WIDTH).fill(null);
}

function outcome(overrides: Partial<AcceptedOutcome> = {}): AcceptedOutcome {
  return {
    id: "out",
    label: "Outcome",
    mask: [anyRow()],
    explanation: "explanation",
    ...overrides,
  };
}

function fillRow(piece: "I" | "J" | "L" | "O" | "S" | "T" | "Z"): BoardCell[] {
  return new Array<BoardCell>(BOARD_WIDTH).fill(null).map(() => ({
    kind: "filled" as const,
    piece,
  }));
}

function setCell(row: BoardCell[], x: number, cell: BoardCell): BoardCell[] {
  const out = row.slice();
  out[x] = cell;
  return out;
}

function makeField(rows: BoardCell[][]): Field {
  const field = emptyField();
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      field[y][x] = rows[y][x] ?? null;
    }
  }
  return field;
}

function maskRow(cells: (MaskCell | null | undefined)[]): BoardMaskRow {
  const out: BoardMaskRow = new Array<MaskCell>(BOARD_WIDTH).fill({
    kind: "any",
  });
  for (let x = 0; x < cells.length && x < BOARD_WIDTH; x++) {
    const c = cells[x];
    out[x] = c ?? { kind: "any" };
  }
  return out;
}

describe("matchesBoardMask", () => {
  it("matches a null cell against an empty field cell", () => {
    const field = makeField([]);
    expect(matchesBoardMask(field, [nullMaskRow()])).toBe(true);
  });

  it("rejects a null cell against a non-empty field cell", () => {
    const field = makeField([
      setCell(nullFieldRow(), 0, { kind: "filled", piece: "O" }),
    ]);
    expect(matchesBoardMask(field, [nullMaskRow()])).toBe(false);
  });

  it("treats {kind:'any'} as don't-care", () => {
    const field = makeField([fillRow("I")]);
    expect(matchesBoardMask(field, [anyRow()])).toBe(true);
  });

  it("rejects an empty cell for {kind:'occupied'}", () => {
    const field = makeField([nullFieldRow()]);
    expect(matchesBoardMask(field, [maskRow([{ kind: "occupied" }])])).toBe(
      false,
    );
  });

  it("accepts any non-null cell for {kind:'occupied'}", () => {
    const field = makeField([fillRow("I")]);
    expect(matchesBoardMask(field, [maskRow([{ kind: "occupied" }])])).toBe(
      true,
    );
  });

  it("accepts a garbage cell for {kind:'garbage'}", () => {
    const field = makeField([setCell(nullFieldRow(), 0, { kind: "garbage" })]);
    expect(matchesBoardMask(field, [maskRow([{ kind: "garbage" }])])).toBe(
      true,
    );
  });

  it("rejects a filled cell for {kind:'garbage'}", () => {
    const field = makeField([
      setCell(nullFieldRow(), 0, { kind: "filled", piece: "I" }),
    ]);
    expect(matchesBoardMask(field, [maskRow([{ kind: "garbage" }])])).toBe(
      false,
    );
  });

  it("accepts any filled piece cell for {kind:'filled'}", () => {
    const field = makeField([fillRow("I")]);
    expect(matchesBoardMask(field, [maskRow([{ kind: "filled" }])])).toBe(true);
  });

  it("accepts an exact piece match for {kind:'filled', piece}", () => {
    const field = makeField([
      setCell(nullFieldRow(), 0, { kind: "filled", piece: "O" }),
    ]);
    expect(
      matchesBoardMask(field, [maskRow([{ kind: "filled", piece: "O" }])]),
    ).toBe(true);
  });

  it("rejects a different piece for {kind:'filled', piece}", () => {
    const field = makeField([
      setCell(nullFieldRow(), 0, { kind: "filled", piece: "I" }),
    ]);
    expect(
      matchesBoardMask(field, [maskRow([{ kind: "filled", piece: "O" }])]),
    ).toBe(false);
  });

  it("treats rows above the mask as don't-care", () => {
    // Field has an O row at y=1; mask only covers y=0.
    const field = makeField([nullFieldRow(), fillRow("O")]);
    expect(matchesBoardMask(field, [nullMaskRow()])).toBe(true);
  });

  it("rejects a mask that exceeds the field height", () => {
    // Construct a field with only 1 row, then pass a 2-row mask. The
    // loader prevents this in production; the matcher is defensive.
    const field: Field = emptyField();
    field.length = 1;
    expect(matchesBoardMask(field, [anyRow(), anyRow()])).toBe(false);
  });
});

describe("findAcceptedOutcome: variantIds semantics", () => {
  it("applies to all variants when variantIds is omitted", () => {
    const field = makeField([
      setCell(nullFieldRow(), 0, { kind: "filled", piece: "O" }),
    ]);
    const out = outcome({
      mask: [maskRow([{ kind: "filled", piece: "O" }])],
    });
    expect(findAcceptedOutcome(field, [out], "any-variant")).toBe(out);
  });

  it("limits matching to listed variants when variantIds is present", () => {
    const field = makeField([
      setCell(nullFieldRow(), 0, { kind: "filled", piece: "O" }),
    ]);
    const out = outcome({
      variantIds: ["only-this"],
      mask: [maskRow([{ kind: "filled", piece: "O" }])],
    });
    expect(findAcceptedOutcome(field, [out], "different")).toBe(null);
    expect(findAcceptedOutcome(field, [out], "only-this")).toBe(out);
  });

  it("returns the first matching outcome", () => {
    const field = makeField([
      setCell(nullFieldRow(), 0, { kind: "filled", piece: "O" }),
    ]);
    const a = outcome({
      id: "a",
      mask: [maskRow([{ kind: "filled", piece: "O" }])],
    });
    const b = outcome({
      id: "b",
      mask: [maskRow([{ kind: "filled", piece: "O" }])],
    });
    expect(findAcceptedOutcome(field, [a, b], "v")?.id).toBe("a");
  });

  it("returns null when no outcome matches", () => {
    const field = makeField([]);
    const out = outcome({
      mask: [maskRow([{ kind: "filled", piece: "O" }])],
    });
    expect(findAcceptedOutcome(field, [out], "v")).toBe(null);
  });
});

describe("matchesBoardMask: does not mutate the field", () => {
  it("preserves the input field cells after a match", () => {
    const field = makeField([
      setCell(nullFieldRow(), 0, { kind: "filled", piece: "O" }),
    ]);
    const before = JSON.stringify(field);
    const matched = matchesBoardMask(field, [
      maskRow([{ kind: "filled", piece: "O" }]),
    ]);
    expect(matched).toBe(true);
    expect(JSON.stringify(field)).toBe(before);
  });

  it("preserves the input field cells after a non-match", () => {
    const field = makeField([
      setCell(nullFieldRow(), 0, { kind: "filled", piece: "O" }),
    ]);
    const before = JSON.stringify(field);
    const matched = matchesBoardMask(field, [
      maskRow([{ kind: "filled", piece: "T" }]),
    ]);
    expect(matched).toBe(false);
    expect(JSON.stringify(field)).toBe(before);
  });
});

void FIELD_HEIGHT;
