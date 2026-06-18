import { describe, it, expect } from "vitest";
import { loadDrillPack } from "./drillLoader.ts";
import type { Drill, DrillPack } from "./drillTypes.ts";

const validDrill = {
  id: "test-001",
  title: "Test drill",
  category: "Test",
  tags: ["test"],
  ruleset: "tetrio-default",
  board: [
    [
      { kind: "filled", piece: "J" },
      null,
      { kind: "garbage" },
      { kind: "filled", piece: "T" },
      null,
      null,
      null,
      null,
      null,
      null,
    ],
  ],
  active: "T",
  hold: null,
  queue: ["S", "Z"],
  b2bActive: true,
  combo: 0,
  garbageHoleColumn: 3,
  goal: "Do the thing.",
  acceptedSolutions: [
    {
      id: "sol-1",
      label: "Solution",
      placements: [{ piece: "T", x: 2, y: 3, rotation: "0" }],
      explanation: "Because.",
    },
  ],
} satisfies Drill;

function cloneDrill(overrides: Partial<Record<string, unknown>> = {}): unknown {
  return { ...validDrill, ...overrides };
}

describe("loadDrillPack", () => {
  it("parses a valid drill pack", () => {
    const pack = loadDrillPack([validDrill]) as DrillPack;
    expect(pack).toHaveLength(1);
    const d = pack[0];
    expect(d.id).toBe("test-001");
    expect(d.active).toBe("T");
    expect(d.hold).toBeNull();
    expect(d.queue).toEqual(["S", "Z"]);
    expect(d.board[0]).toHaveLength(10);
    expect(d.board[0][0]).toEqual({ kind: "filled", piece: "J" });
    expect(d.board[0][1]).toBeNull();
    expect(d.board[0][2]).toEqual({ kind: "garbage" });
    expect(d.garbageHoleColumn).toBe(3);
    expect(d.acceptedSolutions[0].placements[0].rotation).toBe("0");
  });

  it("rejects non-array input", () => {
    expect(() => loadDrillPack({})).toThrow(/drills: expected array/);
  });

  it("rejects a board row with the wrong width", () => {
    const d = cloneDrill({
      board: [[{ kind: "filled", piece: "J" }, null]],
    });
    expect(() => loadDrillPack([d])).toThrow(/expected 10 cells/);
  });

  it("rejects an invalid piece id on a cell", () => {
    const d = cloneDrill({
      board: [
        [
          { kind: "filled", piece: "X" },
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ],
      ],
    });
    expect(() => loadDrillPack([d])).toThrow(/invalid piece 'X'/);
  });

  it("rejects a missing active piece", () => {
    const d = cloneDrill({ active: "Q" });
    expect(() => loadDrillPack([d])).toThrow(/active.*expected piece id/);
  });

  it("rejects an unsupported ruleset", () => {
    const d = cloneDrill({ ruleset: "srs-x" });
    expect(() => loadDrillPack([d])).toThrow(/unsupported ruleset/);
  });

  it("rejects a non-string goal", () => {
    const d = cloneDrill({ goal: 42 });
    expect(() => loadDrillPack([d])).toThrow(/goal: expected string/);
  });

  it("accepts garbageHoleColumn as null, omitted, or an integer 0..9", () => {
    expect(() =>
      loadDrillPack([cloneDrill({ garbageHoleColumn: null })]),
    ).not.toThrow();
    const omitted = { ...validDrill } as Partial<Record<string, unknown>>;
    delete omitted.garbageHoleColumn;
    expect(() => loadDrillPack([omitted])).not.toThrow();
    for (const c of [0, 5, 9]) {
      expect(() =>
        loadDrillPack([cloneDrill({ garbageHoleColumn: c })]),
      ).not.toThrow();
    }
  });

  it("rejects a non-integer garbageHoleColumn", () => {
    const d = cloneDrill({ garbageHoleColumn: 4.5 });
    expect(() => loadDrillPack([d])).toThrow(/expected integer, got 4.5/);
  });

  it("rejects an out-of-range garbageHoleColumn", () => {
    expect(() =>
      loadDrillPack([cloneDrill({ garbageHoleColumn: 10 })]),
    ).toThrow(/expected integer in 0\.\.9, got 10/);
    expect(() =>
      loadDrillPack([cloneDrill({ garbageHoleColumn: -1 })]),
    ).toThrow(/expected integer in 0\.\.9, got -1/);
  });

  it("accepts combo as omitted or a non-negative integer", () => {
    expect(() => loadDrillPack([cloneDrill({ combo: 0 })])).not.toThrow();
    expect(() => loadDrillPack([cloneDrill({ combo: 7 })])).not.toThrow();
    const omitted = { ...validDrill } as Partial<Record<string, unknown>>;
    delete omitted.combo;
    expect(() => loadDrillPack([omitted])).not.toThrow();
  });

  it("rejects a non-integer combo", () => {
    const d = cloneDrill({ combo: 1.5 });
    expect(() => loadDrillPack([d])).toThrow(/expected integer, got 1.5/);
  });

  it("rejects a negative combo", () => {
    const d = cloneDrill({ combo: -1 });
    expect(() => loadDrillPack([d])).toThrow(
      /expected non-negative integer, got -1/,
    );
  });
});
