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
});
