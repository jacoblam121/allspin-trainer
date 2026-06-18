import { describe, it, expect } from "vitest";
import { VISIBLE_HEIGHT, VISIBLE_SPAWN_ROWS } from "./constants.ts";
import {
  SPAWN_ORIGIN,
  CW_NEXT,
  CCW_NEXT,
  ROTATE_180_NEXT,
  targetRotation,
  resolveRotation,
} from "./ruleset.ts";
import { KICKS_180, transition180Key } from "./fixtures/srsPlus180Kicks.ts";
import { cellsOf } from "./tetrominoes.ts";
import type { PieceId, RotationState } from "./pieces.ts";
import type { Coord } from "./tetrominoes.ts";

// Synthetic collision predicate: collide if any cell has x or y in the given
// blocked set, or is out of bounds (x<0, x>=10, y<0). y>=FIELD_HEIGHT is open
// air (matches board.isOccupied).
function makeCollider(blocked: string[]): (cells: Coord[]) => boolean {
  const set = new Set(blocked);
  return (cells) =>
    cells.some(
      (c) => c.x < 0 || c.x >= 10 || c.y < 0 || set.has(`${c.x},${c.y}`),
    );
}

function resolve(
  piece: PieceId,
  from: RotationState,
  direction: "cw" | "ccw" | "180",
  originX: number,
  originY: number,
  blocked: string[],
) {
  return resolveRotation(
    piece,
    from,
    direction,
    originX,
    originY,
    makeCollider(blocked),
    (target, x, y) => cellsOf(piece, target, x, y),
  );
}

describe("ruleset SPAWN_ORIGIN", () => {
  it("places every piece's lowest cell at y=20 in the visible spawn buffer", () => {
    for (const id of ["I", "O", "T", "S", "Z", "J", "L"] as PieceId[]) {
      const o = SPAWN_ORIGIN[id];
      const cells = cellsOf(id, "0", o.x, o.y);
      const minY = Math.min(...cells.map((c) => c.y));
      expect(minY).toBe(VISIBLE_HEIGHT);
    }
  });

  it("uses x=3 for I/J/L/S/T/Z and x=4 for O", () => {
    for (const id of ["I", "T", "S", "Z", "J", "L"] as PieceId[]) {
      expect(SPAWN_ORIGIN[id].x).toBe(3);
    }
    expect(SPAWN_ORIGIN.O.x).toBe(4);
  });

  it("fits every spawn orientation within the three rendered spawn rows", () => {
    const maxRenderedY = VISIBLE_HEIGHT + VISIBLE_SPAWN_ROWS - 1;
    for (const id of ["I", "O", "T", "S", "Z", "J", "L"] as PieceId[]) {
      const o = SPAWN_ORIGIN[id];
      const ys = cellsOf(id, "0", o.x, o.y).map((c) => c.y);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(VISIBLE_HEIGHT);
      expect(Math.max(...ys)).toBeLessThanOrEqual(maxRenderedY);
    }
  });

  it("keeps I visible in the rendered spawn window after a spawn rotation", () => {
    const o = SPAWN_ORIGIN.I;
    const result = resolve("I", "0", "cw", o.x, o.y, []);
    expect(result).not.toBeNull();
    const cells = cellsOf("I", result!.rotation, result!.x, result!.y);
    const ys = cells.map((c) => c.y);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(VISIBLE_HEIGHT - 1);
    expect(Math.max(...ys)).toBeLessThanOrEqual(
      VISIBLE_HEIGHT + VISIBLE_SPAWN_ROWS - 1,
    );
  });
});

describe("ruleset rotation transitions", () => {
  it("CW cycles 0->R->2->L->0", () => {
    expect(CW_NEXT["0"]).toBe("R");
    expect(CW_NEXT.R).toBe("2");
    expect(CW_NEXT["2"]).toBe("L");
    expect(CW_NEXT.L).toBe("0");
  });

  it("CCW cycles 0->L->2->R->0", () => {
    expect(CCW_NEXT["0"]).toBe("L");
    expect(CCW_NEXT.L).toBe("2");
    expect(CCW_NEXT["2"]).toBe("R");
    expect(CCW_NEXT.R).toBe("0");
  });

  it("180 maps 0<->2 and R<->L", () => {
    expect(ROTATE_180_NEXT["0"]).toBe("2");
    expect(ROTATE_180_NEXT["2"]).toBe("0");
    expect(ROTATE_180_NEXT.R).toBe("L");
    expect(ROTATE_180_NEXT.L).toBe("R");
  });

  it("targetRotation dispatches by direction", () => {
    expect(targetRotation("0", "cw")).toBe("R");
    expect(targetRotation("0", "ccw")).toBe("L");
    expect(targetRotation("0", "180")).toBe("2");
  });
});

describe("90° SRS kicks — JLSTZ specific (dx,dy) assertions", () => {
  // Verify the verbatim Hard Drop JLSTZ table by checking that the kick
  // resolution picks the expected first-success offset for a T piece (0->R)
  // when basic rotation (0,0) is blocked but (-1,0) succeeds.
  it("T 0->R uses (0,0) in open space", () => {
    const r = resolve("T", "0", "cw", 3, 5, []);
    expect(r).not.toBeNull();
    expect(r!.rotation).toBe("R");
    expect(r!.x).toBe(3);
    expect(r!.y).toBe(5);
  });

  it("T 0->R uses (-1,0) when (0,0) is blocked but (-1,0) is open", () => {
    // T "R" at (3,5): cells {1,0},{1,1},{1,2},{2,1} -> (4,5),(4,6),(4,7),(5,6).
    // Block (4,5) so (0,0) fails. (-1,0) shifts origin to (2,5): cells (3,5),(3,6),(3,7),(4,6) — open.
    const r = resolve("T", "0", "cw", 3, 5, ["4,5"]);
    expect(r).not.toBeNull();
    expect(r!.x).toBe(2); // origin shifted by -1
    expect(r!.y).toBe(5);
    expect(r!.rotation).toBe("R");
  });

  it("T 0->R uses (-1,+1) when (0,0) and (-1,0) are blocked", () => {
    // Block (4,5) [0,0 target] and (3,5) [-1,0 target cell]. (-1,+1)->origin (2,6):
    // T"R" cells (3,6),(3,7),(3,8),(4,7) — open.
    const r = resolve("T", "0", "cw", 3, 5, ["4,5", "3,5"]);
    expect(r).not.toBeNull();
    expect(r!.x).toBe(2);
    expect(r!.y).toBe(6);
  });

  it("J 0->R kicks mirror L 0->L (symmetry): J uses (-1,0), L uses (+1,0)", () => {
    // J "R" at (3,5): cells {1,0},{1,1},{1,2},{2,2} -> (4,5),(4,6),(4,7),(5,7).
    // Block (4,5) -> (0,0) fails. (-1,0)->origin (2,5): cells (3,5),(3,6),(3,7),(4,7) open.
    const j = resolve("J", "0", "cw", 3, 5, ["4,5"]);
    expect(j!.x).toBe(2); // J 0->R kick (-1,0)
    // L "L" at (3,5): cells {1,0},{1,1},{1,2},{0,2} -> (4,5),(4,6),(4,7),(3,7).
    // 0->L JLSTZ kicks: (0,0),(+1,0),(+1,+1),(0,-2),(+1,-2). Block (4,5) -> (0,0) fails.
    // (+1,0)->origin (4,5): L"L" cells (5,5),(5,6),(5,7),(4,7) open.
    const l = resolve("L", "0", "ccw", 3, 5, ["4,5"]);
    expect(l!.x).toBe(4); // L 0->L kick (+1,0)
  });
});

describe("90° SRS kicks — I-piece specific (dx,dy) assertions", () => {
  it("I 0->R uses (0,0) in open space", () => {
    const r = resolve("I", "0", "cw", 3, 5, []);
    expect(r).not.toBeNull();
    expect(r!.rotation).toBe("R");
    expect(r!.x).toBe(3);
    expect(r!.y).toBe(5);
  });

  it("I 0->R uses (-2,0) when (0,0) is blocked (standard SRS I kick)", () => {
    // I "R" at (3,5): cells {2,0},{2,1},{2,2},{2,3} -> (5,5),(5,6),(5,7),(5,8).
    // Block (5,5) -> (0,0) fails. (-2,0)->origin (1,5): cells (3,5),(3,6),(3,7),(3,8) open.
    const r = resolve("I", "0", "cw", 3, 5, ["5,5"]);
    expect(r).not.toBeNull();
    expect(r!.x).toBe(1); // -2 shift
    expect(r!.y).toBe(5);
  });

  it("I 0->R uses (+1,0) when (0,0) and (-2,0) are blocked", () => {
    // Block (5,5) [0,0] and (3,5) [-2,0 target cell]. (+1,0)->origin (4,5): cells (6,5),(6,6),(6,7),(6,8) open.
    const r = resolve("I", "0", "cw", 3, 5, ["5,5", "3,5"]);
    expect(r).not.toBeNull();
    expect(r!.x).toBe(4); // +1 shift
  });
});

describe("TETR.IO SRS+ I-piece symmetry (left-side mirrored)", () => {
  // Standard SRS I L->0: [(0,0),(+1,0),(-2,0),(+1,-2),(-2,+1)].
  // SRS+ mirrors the left-side transitions (0->L, L->0) along y-axis (dx negated).
  // So SRS+ I L->0: [(0,0),(-1,0),(+2,0),(-1,-2),(+2,+1)].
  it("I L->0 SRS+ uses (-1,0) [mirrored from standard (+1,0)] when (0,0) blocked", () => {
    // I "0" at (3,5): cells {0,1},{1,1},{2,1},{3,1} -> (3,6),(4,6),(5,6),(6,6).
    // Block (3,6) -> (0,0) fails. SRS+ (-1,0)->origin (2,5): cells (2,6),(3,6),(4,6),(5,6) — (3,6) blocked!
    // So (-1,0) also fails. Next SRS+ kick (+2,0)->origin (5,5): cells (5,6),(6,6),(7,6),(8,6) open.
    // To isolate (-1,0) success, block only the (0,0) target and let (-1,0) target be open.
    // (0,0) target cell is (3,6). (-1,0) target cells: origin (2,5) -> (2,6),(3,6),(4,6),(5,6). (3,6) is blocked.
    // Hmm, blocking (3,6) blocks both. Instead block a cell unique to (0,0): the (0,0) cells are
    // (3,6),(4,6),(5,6),(6,6). The (-1,0) cells are (2,6),(3,6),(4,6),(5,6). The unique cell is (6,6).
    // Block (6,6) -> (0,0) fails (its rightmost cell). (-1,0) cells (2,6),(3,6),(4,6),(5,6) all open -> succeeds.
    const r = resolve("I", "L", "cw", 3, 5, ["6,6"]);
    expect(r).not.toBeNull();
    expect(r!.x).toBe(2); // -1 shift (SRS+ mirrored)
    expect(r!.y).toBe(5);
    expect(r!.rotation).toBe("0");
  });

  it("I 0->L SRS+ uses (+1,0) [mirrored from standard (-1,0)] when (0,0) blocked", () => {
    // I "L" at (3,5): cells {1,0},{1,1},{1,2},{1,3} -> (4,5),(4,6),(4,7),(4,8).
    // 0->L: standard I 0->L is [(0,0),(-1,0),(+2,0),(-1,+2),(+2,-1)].
    // SRS+ mirrors 0->L: [(0,0),(+1,0),(-2,0),(+1,+2),(-2,-1)].
    // Block (4,5) -> (0,0) fails. (+1,0)->origin (4,5): cells (5,5),(5,6),(5,7),(5,8) open.
    const r = resolve("I", "0", "ccw", 3, 5, ["4,5"]);
    expect(r).not.toBeNull();
    expect(r!.x).toBe(4); // +1 shift (SRS+ mirrored, NOT standard -1)
    expect(r!.y).toBe(5);
    expect(r!.rotation).toBe("L");
  });
});

describe("O-piece rotation", () => {
  it("O rotation changes state but occupied cells stay identical, no kick", () => {
    for (const dir of ["cw", "ccw", "180"] as const) {
      const r = resolve("O", "0", dir, 4, 5, []);
      expect(r).not.toBeNull();
      const before = cellsOf("O", "0", 4, 5);
      const after = cellsOf("O", r!.rotation, r!.x, r!.y);
      expect(after.map((c) => `${c.x},${c.y}`).sort()).toEqual(
        before.map((c) => `${c.x},${c.y}`).sort(),
      );
    }
  });

  it("O rotation fails only if the (unchanged) cells collide", () => {
    // Block one of O's cells; rotation (which doesn't move cells) can't escape.
    const r = resolve("O", "0", "cw", 4, 5, ["4,5"]);
    expect(r).toBeNull();
  });
});

describe("180° SRS+ kicks — fixture (dx,dy) assertions", () => {
  it("KICKS_180 has 6 kicks per transition in the confirmed order", () => {
    for (const key of ["0->2", "2->0", "R->L", "L->R"] as const) {
      expect(KICKS_180[key]).toHaveLength(6);
    }
  });

  it("0->2 table matches the confirmed transcription", () => {
    expect(KICKS_180["0->2"]).toEqual([
      { dx: 0, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 1 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
    ]);
  });

  it("2->0 table matches the confirmed transcription", () => {
    expect(KICKS_180["2->0"]).toEqual([
      { dx: 0, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: -1, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ]);
  });

  it("R->L table matches the confirmed transcription", () => {
    expect(KICKS_180["R->L"]).toEqual([
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 1, dy: 2 },
      { dx: 1, dy: 1 },
      { dx: 0, dy: 2 },
      { dx: 0, dy: 1 },
    ]);
  });

  it("L->R table matches the confirmed transcription", () => {
    expect(KICKS_180["L->R"]).toEqual([
      { dx: 0, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: -1, dy: 2 },
      { dx: -1, dy: 1 },
      { dx: 0, dy: 2 },
      { dx: 0, dy: 1 },
    ]);
  });

  it("transition180Key maps state pairs correctly", () => {
    expect(transition180Key("0", "2")).toBe("0->2");
    expect(transition180Key("2", "0")).toBe("2->0");
    expect(transition180Key("R", "L")).toBe("R->L");
    expect(transition180Key("L", "R")).toBe("L->R");
    expect(transition180Key("0", "R")).toBeNull();
  });

  it("180 rotation in open space uses (0,0) for JLSTZ", () => {
    const r = resolve("T", "0", "180", 3, 5, []);
    expect(r).not.toBeNull();
    expect(r!.rotation).toBe("2");
    expect(r!.x).toBe(3);
    expect(r!.y).toBe(5);
  });

  it("180 rotation uses (0,+1) when (0,0) blocked (0->2 second kick)", () => {
    // T "2" at (3,5): cells {0,1},{1,1},{2,1},{1,0} -> (3,6),(4,6),(5,6),(4,5).
    // Block (4,5) -> (0,0) fails. (0,+1)->origin (3,6): cells (3,7),(4,7),(5,7),(4,6) open.
    const r = resolve("T", "0", "180", 3, 5, ["4,5"]);
    expect(r).not.toBeNull();
    expect(r!.x).toBe(3);
    expect(r!.y).toBe(6); // +1 shift
  });

  it("180 rotation uses (+1,0) for R->L when (0,0) blocked", () => {
    // T "R" at (3,5): cells {1,0},{1,1},{1,2},{2,1} -> (4,5),(4,6),(4,7),(5,6).
    // R->L target is "L". T "L" at (3,5): cells {1,0},{1,1},{1,2},{0,1} -> (4,5),(4,6),(4,7),(3,6).
    // Block (3,6) [unique to (0,0)] -> (0,0) fails. R->L (+1,0)->origin (4,5):
    // T"L" cells (5,5),(5,6),(5,7),(4,6) open -> succeeds with +1 shift.
    const r = resolve("T", "R", "180", 3, 5, ["3,6"]);
    expect(r).not.toBeNull();
    expect(r!.x).toBe(4); // +1 shift (R->L second kick)
    expect(r!.y).toBe(5);
    expect(r!.rotation).toBe("L");
  });

  it("180 rotation uses (-1,0) for L->R when (0,0) blocked (mirror of R->L)", () => {
    // T "L" at (3,5): cells (4,5),(4,6),(4,7),(3,6). L->R target "R".
    // T "R" at (3,5): cells (4,5),(4,6),(4,7),(5,6). Block (5,6) [unique to (0,0)].
    // L->R (-1,0)->origin (2,5): T"R" cells (3,5),(3,6),(3,7),(4,6) open.
    const r = resolve("T", "L", "180", 3, 5, ["5,6"]);
    expect(r).not.toBeNull();
    expect(r!.x).toBe(2); // -1 shift (L->R second kick)
    expect(r!.y).toBe(5);
    expect(r!.rotation).toBe("R");
  });

  it("180 rotation uses the same table for I (no separate I 180 table)", () => {
    // I 0->2 at (3,5): I"2" cells {0,2},{1,2},{2,2},{3,2} -> (3,7),(4,7),(5,7),(6,7).
    // Block (3,7) -> (0,0) fails. (0,+1)->origin (3,6): cells (3,8),(4,8),(5,8),(6,8) open.
    const r = resolve("I", "0", "180", 3, 5, ["3,7"]);
    expect(r).not.toBeNull();
    expect(r!.x).toBe(3);
    expect(r!.y).toBe(6); // +1 shift (same 0->2 table as JLSTZ)
  });
});

describe("rotation fully blocked (all kicks fail)", () => {
  it("resolveRotation returns null when every kick offset collides", () => {
    // T 0->R at origin (3,5) in open space: (0,0) succeeds. Block ALL 5 kick
    // target origins' cells. Easiest: fill the entire 10x10 region around the
    // piece so every offset lands on a filled cell (except below floor kicks
    // which auto-collide). Build a block list covering all target cells.
    // T "R" cells at origin (3,5): (4,5),(4,6),(4,7),(5,6). 0->R kicks:
    //   (0,0)->(3,5): (4,5),(4,6),(4,7),(5,6)
    //   (-1,0)->(2,5): (3,5),(3,6),(3,7),(4,6)
    //   (-1,1)->(2,6): (3,6),(3,7),(3,8),(4,7)
    //   (0,-2)->(3,3): (4,3),(4,4),(4,5),(5,4)
    //   (-1,-2)->(2,3): (3,3),(3,4),(3,5),(4,4)
    // Block a cell in each kick's target set so every kick fails:
    //   (0,0): block (4,5)
    //   (-1,0): block (3,5) [or (3,6)/(3,7)/(4,6)]
    //   (-1,1): block (3,8) [unique to this kick]
    //   (0,-2): block (4,3) [or (5,4)]
    //   (-1,-2): block (3,3) [unique]
    const blocked = ["4,5", "3,5", "3,8", "4,3", "3,3"];
    const r = resolve("T", "0", "cw", 3, 5, blocked);
    expect(r).toBeNull();
  });
});
