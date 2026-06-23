import { describe, it, expect } from "vitest";
import { BOARD_WIDTH, FIELD_HEIGHT } from "../engine/constants.ts";
import type { Field } from "../engine/board.ts";
import type { BoardCell, ExpectedPlacement } from "./drillTypes.ts";
import type {
  AcceptedOutcome,
  BoardMaskRow,
  DrillVariant,
  MaskCell,
  SolutionRoute,
} from "./drillTypesV2.ts";
import {
  buildSolutionSteps,
  formatSolutionReplayError,
  validateRoutePieceOrder,
  type SolutionReplayError,
} from "./solutionSteps.ts";

// --- helpers ---------------------------------------------------------------

function placement(
  piece: ExpectedPlacement["piece"],
  x: number,
  y: number,
  rotation: ExpectedPlacement["rotation"],
): ExpectedPlacement {
  return { piece, x, y, rotation };
}

function variant(overrides: Partial<DrillVariant> = {}): DrillVariant {
  return {
    id: "v",
    label: "Variant",
    board: [],
    active: "O",
    hold: null,
    queue: [],
    ...overrides,
  };
}

function route(overrides: Partial<SolutionRoute> = {}): SolutionRoute {
  return {
    id: "r",
    label: "Route",
    variantId: "v",
    outcomeId: "o",
    placements: [],
    explanation: "",
    ...overrides,
  };
}

function anyRow(): BoardMaskRow {
  return new Array<MaskCell>(BOARD_WIDTH).fill({ kind: "any" });
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

function outcome(overrides: Partial<AcceptedOutcome> = {}): AcceptedOutcome {
  return {
    id: "o",
    label: "Outcome",
    mask: [anyRow()],
    explanation: "",
    ...overrides,
  };
}

function fillCell(piece: ExpectedPlacement["piece"]): BoardCell {
  return { kind: "filled", piece };
}

function emptyRow(): BoardCell[] {
  return new Array<BoardCell>(BOARD_WIDTH).fill(null);
}

function rowWith(pairs: { x: number; cell: BoardCell }[]): BoardCell[] {
  const row = emptyRow();
  for (const { x, cell } of pairs) row[x] = cell;
  return row;
}

// A row full except the given columns (used to set up imminent line clears).
function almostFullRow(except: number[]): BoardCell[] {
  const row = emptyRow();
  for (let x = 0; x < BOARD_WIDTH; x++) {
    if (!except.includes(x)) row[x] = { kind: "filled", piece: "I" };
  }
  return row;
}

function cellAt(field: Field, x: number, y: number): BoardCell {
  return field[y][x];
}

// --- valid replay ----------------------------------------------------------

describe("buildSolutionSteps: valid route", () => {
  it("produces post-lock, post-clear steps for a reachable route", () => {
    const v = variant({
      id: "v",
      active: "O",
      hold: "T",
      queue: ["I"],
    });
    const r = route({
      id: "r",
      variantId: "v",
      outcomeId: "o",
      placements: [placement("O", 4, 0, "0"), placement("I", 3, 1, "0")],
    });
    const o = outcome({
      id: "o",
      mask: [
        maskRow([
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "filled", piece: "O" },
          { kind: "filled", piece: "O" },
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
        ]),
        maskRow([
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "filled", piece: "O" },
          { kind: "filled", piece: "O" },
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
        ]),
        maskRow([
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "filled", piece: "I" },
          { kind: "filled", piece: "I" },
          { kind: "filled", piece: "I" },
          { kind: "filled", piece: "I" },
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
        ]),
      ],
    });
    const result = buildSolutionSteps(v, r, [o]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps).toHaveLength(2);

    // Step 0: O locked at rows 0-1, columns 4-5.
    expect(result.steps[0].label).toBe("Step 1: O at (4, 0) 0");
    expect(cellAt(result.steps[0].field, 4, 0)).toEqual(fillCell("O"));
    expect(cellAt(result.steps[0].field, 5, 0)).toEqual(fillCell("O"));
    expect(cellAt(result.steps[0].field, 4, 1)).toEqual(fillCell("O"));
    expect(cellAt(result.steps[0].field, 5, 1)).toEqual(fillCell("O"));
    expect(cellAt(result.steps[0].field, 0, 0)).toBeNull();

    // Step 1: I shelf on row 2 columns 3-6 on top of the O.
    expect(result.steps[1].label).toBe("Step 2: I at (3, 1) 0");
    expect(cellAt(result.steps[1].field, 3, 2)).toEqual(fillCell("I"));
    expect(cellAt(result.steps[1].field, 6, 2)).toEqual(fillCell("I"));
    // O cells remain underneath.
    expect(cellAt(result.steps[1].field, 4, 0)).toEqual(fillCell("O"));
  });
});

// --- spatial failures ------------------------------------------------------

describe("buildSolutionSteps: spatial failures", () => {
  it("rejects an out-of-bounds placement", () => {
    const v = variant({ active: "O", hold: null, queue: [] });
    const r = route({
      placements: [placement("O", -1, 0, "0")],
    });
    const o = outcome({ mask: [anyRow()] });
    const result = buildSolutionSteps(v, r, [o]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("out-of-bounds");
    if (result.error.kind !== "out-of-bounds") return;
    expect(result.error.routeId).toBe("r");
    expect(result.error.placementIndex).toBe(0);
    expect(result.error.cell).toEqual({ x: -1, y: 0 });
  });

  it("rejects an above-field out-of-bounds placement", () => {
    const v = variant({ active: "O", hold: null, queue: [] });
    const r = route({
      placements: [placement("O", 4, FIELD_HEIGHT, "0")],
    });
    const o = outcome({ mask: [anyRow()] });
    const result = buildSolutionSteps(v, r, [o]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("out-of-bounds");
  });

  it("rejects a colliding placement", () => {
    const v = variant({
      board: [rowWith([{ x: 4, cell: fillCell("O") }])],
      active: "O",
      hold: null,
      queue: [],
    });
    const r = route({
      placements: [placement("O", 4, 0, "0")],
    });
    const o = outcome({ mask: [anyRow()] });
    const result = buildSolutionSteps(v, r, [o]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("collision");
    if (result.error.kind !== "collision") return;
    expect(result.error.routeId).toBe("r");
    expect(result.error.placementIndex).toBe(0);
    expect(result.error.cell).toEqual({ x: 4, y: 0 });
  });

  it("rejects a floating (ungrounded) placement", () => {
    const v = variant({ active: "O", hold: null, queue: [] });
    const r = route({
      placements: [placement("O", 4, 5, "0")],
    });
    const o = outcome({ mask: [anyRow()] });
    const result = buildSolutionSteps(v, r, [o]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("ungrounded");
    if (result.error.kind !== "ungrounded") return;
    expect(result.error.routeId).toBe("r");
    expect(result.error.placementIndex).toBe(0);
    expect(result.error.expectedY).toBe(0);
  });
});

// --- line clears -----------------------------------------------------------

describe("buildSolutionSteps: line clears", () => {
  it("clears a completed row before the next step and before outcome matching", () => {
    // Row 0 is full except columns 8-9; O at (8,0) completes row 0, which
    // clears. The O cells that landed in row 1 survive as the new row 0
    // (columns 8-9). Then I at (6,0) rests on the cleared field: its cells
    // are at row 1 columns 6-9, grounded because the O cells at row 0
    // columns 8-9 block it from dropping further.
    const v = variant({
      board: [almostFullRow([8, 9])],
      active: "O",
      hold: null,
      queue: ["I"],
    });
    const r = route({
      placements: [placement("O", 8, 0, "0"), placement("I", 6, 0, "0")],
    });
    const o = outcome({
      mask: [
        maskRow([
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "filled", piece: "O" },
          { kind: "filled", piece: "O" },
        ]),
        maskRow([
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "filled", piece: "I" },
          { kind: "filled", piece: "I" },
          { kind: "filled", piece: "I" },
          { kind: "filled", piece: "I" },
        ]),
      ],
    });
    const result = buildSolutionSteps(v, r, [o]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps).toHaveLength(2);

    // Step 0: row 0 cleared; O cells from row 1 collapsed to new row 0
    // (columns 8-9).
    expect(cellAt(result.steps[0].field, 8, 0)).toEqual(fillCell("O"));
    expect(cellAt(result.steps[0].field, 9, 0)).toEqual(fillCell("O"));
    // The pre-filled cells that were in the cleared row are gone.
    expect(cellAt(result.steps[0].field, 0, 0)).toBeNull();
    expect(cellAt(result.steps[0].field, 7, 0)).toBeNull();
    // Row 1 (new) is empty before the second placement.
    expect(cellAt(result.steps[0].field, 6, 1)).toBeNull();

    // Step 1: I rests on the cleared field at row 1, columns 6-9.
    expect(cellAt(result.steps[1].field, 6, 1)).toEqual(fillCell("I"));
    expect(cellAt(result.steps[1].field, 9, 1)).toEqual(fillCell("I"));
    // O cells remain at row 0 columns 8-9.
    expect(cellAt(result.steps[1].field, 8, 0)).toEqual(fillCell("O"));
  });

  it("applies a line clear on the final placement before outcome matching", () => {
    // Single placement completes row 0; the cleared field must match the
    // outcome mask (which describes the post-clear state).
    const v = variant({
      board: [almostFullRow([4, 5])],
      active: "O",
      hold: null,
      queue: [],
    });
    const r = route({
      placements: [placement("O", 4, 0, "0")],
    });
    const o = outcome({
      mask: [
        maskRow([
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "filled", piece: "O" },
          { kind: "filled", piece: "O" },
        ]),
      ],
    });
    const result = buildSolutionSteps(v, r, [o]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps).toHaveLength(1);
    // The cleared row is gone; O cells from row 1 collapsed to row 0.
    expect(cellAt(result.steps[0].field, 4, 0)).toEqual(fillCell("O"));
    expect(cellAt(result.steps[0].field, 5, 0)).toEqual(fillCell("O"));
    expect(cellAt(result.steps[0].field, 0, 0)).toBeNull();
  });
});

// --- outcome resolution ----------------------------------------------------

describe("buildSolutionSteps: outcome resolution", () => {
  it("rejects a final field that does not match the linked outcome mask", () => {
    const v = variant({ active: "O", hold: null, queue: [] });
    const r = route({
      placements: [placement("O", 4, 0, "0")],
    });
    const o = outcome({
      mask: [maskRow([{ kind: "filled", piece: "O" }, { kind: "any" }])],
    });
    const result = buildSolutionSteps(v, r, [o]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("outcome-mismatch");
    if (result.error.kind !== "outcome-mismatch") return;
    expect(result.error.routeId).toBe("r");
    expect(result.error.outcomeId).toBe("o");
    expect(result.error.variantId).toBe("v");
  });

  it("rejects a missing linked outcome", () => {
    const v = variant({ active: "O", hold: null, queue: [] });
    const r = route({
      outcomeId: "nope",
      placements: [placement("O", 4, 0, "0")],
    });
    const result = buildSolutionSteps(v, r, [outcome({ id: "o" })]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("missing-outcome");
    if (result.error.kind !== "missing-outcome") return;
    expect(result.error.routeId).toBe("r");
    expect(result.error.outcomeId).toBe("nope");
  });

  it("rejects an outcome limited to another variant", () => {
    const v = variant({ id: "v" });
    const r = route({ variantId: "v", outcomeId: "o" });
    const o = outcome({
      id: "o",
      variantIds: ["other"],
      mask: [anyRow()],
    });
    const result = buildSolutionSteps(v, r, [o]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("outcome-variant-mismatch");
    if (result.error.kind !== "outcome-variant-mismatch") return;
    expect(result.error.routeId).toBe("r");
    expect(result.error.outcomeId).toBe("o");
    expect(result.error.variantId).toBe("v");
  });
});

// --- board-too-tall --------------------------------------------------------

describe("buildSolutionSteps: board-too-tall", () => {
  it("rejects a variant board taller than FIELD_HEIGHT", () => {
    const tooTall: BoardCell[][] = [];
    for (let i = 0; i < FIELD_HEIGHT + 1; i++) tooTall.push(emptyRow());
    const v = variant({ board: tooTall });
    const r = route({ placements: [placement("O", 4, 0, "0")] });
    const result = buildSolutionSteps(v, r, [outcome()]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("board-too-tall");
    if (result.error.kind !== "board-too-tall") return;
    expect(result.error.variantId).toBe("v");
    expect(result.error.rows).toBe(FIELD_HEIGHT + 1);
    expect(result.error.maxRows).toBe(FIELD_HEIGHT);
  });
});

// --- mask semantics --------------------------------------------------------

describe("buildSolutionSteps: mask semantics", () => {
  it("honors {kind:'any'} cells through matchesBoardMask", () => {
    const v = variant({ active: "O", hold: null, queue: [] });
    const r = route({ placements: [placement("O", 4, 0, "0")] });
    // Only row 0 is constrained to any; everything else don't-care.
    const o = outcome({ mask: [anyRow()] });
    const result = buildSolutionSteps(v, r, [o]);
    expect(result.ok).toBe(true);
  });

  it("honors omitted mask rows as don't-care", () => {
    const v = variant({ active: "O", hold: null, queue: [] });
    const r = route({ placements: [placement("O", 4, 0, "0")] });
    // Mask only covers row 0 with O at columns 4-5; rows above are omitted
    // and therefore don't-care, even though the field has O at row 1.
    const o = outcome({
      mask: [
        maskRow([
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "any" },
          { kind: "filled", piece: "O" },
          { kind: "filled", piece: "O" },
        ]),
      ],
    });
    const result = buildSolutionSteps(v, r, [o]);
    expect(result.ok).toBe(true);
  });
});

// --- no mutation -----------------------------------------------------------

describe("buildSolutionSteps: no input mutation", () => {
  it("does not mutate variant.board, route placements, or prior step fields", () => {
    const v = variant({
      board: [rowWith([{ x: 0, cell: fillCell("I") }])],
      active: "O",
      hold: "T",
      queue: ["I"],
    });
    const r = route({
      placements: [placement("O", 4, 0, "0"), placement("I", 3, 1, "0")],
    });
    const o = outcome({ mask: [anyRow()] });

    const boardSnapshot = JSON.stringify(v.board);
    const placementsSnapshot = JSON.stringify(r.placements);

    const result = buildSolutionSteps(v, r, [o]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(JSON.stringify(v.board)).toBe(boardSnapshot);
    expect(JSON.stringify(r.placements)).toBe(placementsSnapshot);

    // Prior step field is not mutated by a later placement.
    const step0FieldSnapshot = JSON.stringify(result.steps[0].field);
    // Re-run to ensure idempotency and no shared mutable state.
    const result2 = buildSolutionSteps(v, r, [o]);
    if (!result2.ok) {
      throw new Error("second replay should succeed");
    }
    expect(JSON.stringify(result.steps[0].field)).toBe(step0FieldSnapshot);
    expect(JSON.stringify(result2.steps[0].field)).toBe(step0FieldSnapshot);
    expect(JSON.stringify(result2.steps[1].field)).toBe(
      JSON.stringify(result.steps[1].field),
    );
  });
});

// --- piece-order reachability ----------------------------------------------

describe("validateRoutePieceOrder: reachability", () => {
  it("empty-hold route order can be reachable", () => {
    const v = variant({
      active: "T",
      hold: null,
      queue: ["O", "I"],
    });
    const r = route({
      placements: [placement("O", 0, 0, "0"), placement("I", 0, 0, "0")],
    });
    expect(validateRoutePieceOrder(v, r)).toEqual({ ok: true });
  });

  it("non-null hold route order can be reachable", () => {
    const v = variant({
      active: "O",
      hold: "T",
      queue: ["I"],
    });
    const r = route({
      placements: [placement("O", 0, 0, "0"), placement("I", 0, 0, "0")],
    });
    expect(validateRoutePieceOrder(v, r)).toEqual({ ok: true });
  });

  it("playing the held piece via a swap is reachable", () => {
    const v = variant({
      active: "O",
      hold: "T",
      queue: ["I"],
    });
    const r = route({
      placements: [placement("T", 0, 0, "0"), placement("O", 0, 0, "0")],
    });
    // i=0: expected T, active O, hold T -> swap. hold=O, active=I.
    // i=1: expected O, active I, hold O -> swap. hold=I, active=null.
    expect(validateRoutePieceOrder(v, r)).toEqual({ ok: true });
  });

  it("impossible piece order fails with piece-order-unreachable", () => {
    const v = variant({
      active: "O",
      hold: "T",
      queue: ["I"],
    });
    const r = route({
      placements: [placement("Z", 0, 0, "0")],
    });
    const result = validateRoutePieceOrder(v, r);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("piece-order-unreachable");
    expect(result.error.placementIndex).toBe(0);
    expect(result.error.expected).toBe("Z");
    expect(result.error.active).toBe("O");
    expect(result.error.hold).toBe("T");
    expect(result.error.queueHead).toBe("I");
  });

  it("hold misuse (need a piece neither active, hold, nor queue head) fails", () => {
    const v = variant({
      active: "O",
      hold: "T",
      queue: ["I"],
    });
    const r = route({
      placements: [placement("S", 0, 0, "0")],
    });
    const result = validateRoutePieceOrder(v, r);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("piece-order-unreachable");
  });

  it("a route requiring the held piece after queue exhaustion is unreachable", () => {
    // active=O, hold=T, queue=[]. Lock O -> active=null. Next route piece
    // is T, but active is null and hold cannot be used without an active
    // piece.
    const v = variant({
      active: "O",
      hold: "T",
      queue: [],
    });
    const r = route({
      placements: [placement("O", 0, 0, "0"), placement("T", 0, 0, "0")],
    });
    const result = validateRoutePieceOrder(v, r);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("piece-order-unreachable");
    expect(result.error.placementIndex).toBe(1);
    expect(result.error.expected).toBe("T");
    expect(result.error.active).toBeNull();
    expect(result.error.hold).toBe("T");
  });
});

// --- multiple routes replay independently ----------------------------------

describe("buildSolutionSteps: multiple routes replay independently", () => {
  it("replays two routes for one variant without interfering", () => {
    const v = variant({
      active: "O",
      hold: null,
      queue: ["I"],
    });
    const r1 = route({
      id: "r1",
      placements: [placement("O", 4, 0, "0"), placement("I", 3, 1, "0")],
    });
    const r2 = route({
      id: "r2",
      outcomeId: "o2",
      placements: [placement("O", 0, 0, "0")],
    });
    const o1 = outcome({
      id: "o",
      mask: [anyRow()],
    });
    const o2 = outcome({
      id: "o2",
      mask: [
        maskRow([
          { kind: "filled", piece: "O" },
          { kind: "filled", piece: "O" },
        ]),
      ],
    });
    const res1 = buildSolutionSteps(v, r1, [o1, o2]);
    const res2 = buildSolutionSteps(v, r2, [o1, o2]);
    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
    if (!res1.ok || !res2.ok) return;
    expect(res1.steps).toHaveLength(2);
    expect(res2.steps).toHaveLength(1);
    // r2's O is at columns 0-1, independent of r1's O at columns 4-5.
    expect(cellAt(res2.steps[0].field, 0, 0)).toEqual(fillCell("O"));
    expect(cellAt(res2.steps[0].field, 4, 0)).toBeNull();
  });
});

// --- formatter -------------------------------------------------------------

describe("formatSolutionReplayError", () => {
  const errors: { name: string; error: SolutionReplayError }[] = [
    {
      name: "piece-order-unreachable",
      error: {
        kind: "piece-order-unreachable",
        routeId: "r",
        placementIndex: 1,
        expected: "T",
        active: null,
        hold: "T",
        queueHead: null,
        remainingQueue: [],
      },
    },
    {
      name: "board-too-tall",
      error: {
        kind: "board-too-tall",
        variantId: "v",
        rows: FIELD_HEIGHT + 1,
        maxRows: FIELD_HEIGHT,
      },
    },
    {
      name: "missing-outcome",
      error: { kind: "missing-outcome", routeId: "r", outcomeId: "o" },
    },
    {
      name: "outcome-variant-mismatch",
      error: {
        kind: "outcome-variant-mismatch",
        routeId: "r",
        outcomeId: "o",
        variantId: "v",
      },
    },
    {
      name: "out-of-bounds",
      error: {
        kind: "out-of-bounds",
        routeId: "r",
        placementIndex: 0,
        placement: placement("O", -1, 0, "0"),
        cell: { x: -1, y: 0 },
      },
    },
    {
      name: "collision",
      error: {
        kind: "collision",
        routeId: "r",
        placementIndex: 0,
        placement: placement("O", 4, 0, "0"),
        cell: { x: 4, y: 0 },
      },
    },
    {
      name: "ungrounded",
      error: {
        kind: "ungrounded",
        routeId: "r",
        placementIndex: 0,
        placement: placement("O", 4, 5, "0"),
        expectedY: 0,
      },
    },
    {
      name: "outcome-mismatch",
      error: {
        kind: "outcome-mismatch",
        routeId: "r",
        outcomeId: "o",
        variantId: "v",
      },
    },
  ];

  for (const { name, error } of errors) {
    it(`returns a non-empty message for ${name}`, () => {
      const msg = formatSolutionReplayError(error);
      expect(typeof msg).toBe("string");
      expect(msg.length).toBeGreaterThan(0);
      // Errors that carry a route id include it.
      if ("routeId" in error) {
        expect(msg).toContain(error.routeId);
      }
      // Errors that carry a placement index include it.
      if ("placementIndex" in error) {
        expect(msg).toContain(String(error.placementIndex));
      }
      // Spatial errors include the offending coordinate.
      if ("cell" in error) {
        expect(msg).toContain(`(${error.cell.x}, ${error.cell.y})`);
      }
      // Ungrounded errors include the expected y.
      if ("expectedY" in error) {
        expect(msg).toContain(`y=${error.expectedY}`);
      }
    });
  }
});
