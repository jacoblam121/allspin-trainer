import { describe, it, expect } from "vitest";
import { loadDrillPack } from "./drillLoader.ts";
import { createEngineFromDrill, lowestValidY } from "../engine/gameState.ts";
import { cellsOf } from "../engine/tetrominoes.ts";
import { clearLines, type Field } from "../engine/board.ts";
import { BOARD_WIDTH, FIELD_HEIGHT } from "../engine/constants.ts";
import mvp1Pack from "./packs/mvp1.json";

describe("mvp1 pack", () => {
  const drills = loadDrillPack(mvp1Pack);

  it("loads exactly 5 drills", () => {
    expect(drills).toHaveLength(5);
  });

  for (const drill of drills) {
    it(`${drill.id} initializes through createEngineFromDrill`, () => {
      const result = createEngineFromDrill(drill);
      expect(result.ok).toBe(true);
    });

    it(`${drill.id} first accepted route placements are in-bounds and collision-free`, () => {
      const init = createEngineFromDrill(drill);
      if (!init.ok) {
        throw new Error(`engine init failed for ${drill.id}: ${init.reason}`);
      }
      // Simulate the placement-collision check. The engine's normalized field
      // (post createEngineFromDrill) is the starting point: anything on the
      // authored board is non-null, the rest is null. We then walk the
      // route's authored placements top-to-bottom: for each placement,
      // compute cellsOf, assert in-bounds and non-colliding, then write
      // those cells into the simulated field and call clearLines so
      // multi-placement routes are checked against the same locked-cell
      // semantics the engine uses.
      const simulated: Field = init.state.field.map((row) => row.slice());
      const firstRoute = drill.acceptedSolutions[0];
      expect(
        firstRoute,
        `${drill.id} must have at least one accepted route`,
      ).toBeDefined();
      for (let i = 0; i < firstRoute.placements.length; i++) {
        const p = firstRoute.placements[i];
        const cells = cellsOf(p.piece, p.rotation, p.x, p.y);
        for (const c of cells) {
          expect(
            c.x,
            `${drill.id} route ${firstRoute.id} placement[${i}] cell x=${c.x} out of bounds`,
          ).toBeGreaterThanOrEqual(0);
          expect(c.x).toBeLessThan(BOARD_WIDTH);
          expect(
            c.y,
            `${drill.id} route ${firstRoute.id} placement[${i}] cell y=${c.y} out of bounds`,
          ).toBeGreaterThanOrEqual(0);
          expect(c.y).toBeLessThan(FIELD_HEIGHT);
          expect(
            simulated[c.y][c.x],
            `${drill.id} route ${firstRoute.id} placement[${i}] collides at (${c.x},${c.y})`,
          ).toBeNull();
        }
        // Grounding invariant: the authored origin must equal the grounded
        // hard-drop origin (lowestValidY). A floating SRS piece (e.g. flat I,
        // JLSTZ spawn orientation) has a grounded origin one row below its
        // spawn-grid origin; authoring y=0 for such a piece on an empty board
        // would produce a strict-route mismatch on real hard-drop lock.
        const grounded = lowestValidY(simulated, p.piece, p.rotation, p.x, p.y);
        expect(
          grounded,
          `${drill.id} route ${firstRoute.id} placement[${i}] origin y=${p.y} is not grounded (lowestValidY=${grounded})`,
        ).toBe(p.y);
        for (const c of cells) {
          simulated[c.y][c.x] = { kind: "filled", piece: p.piece };
        }
        const result = clearLines(simulated);
        simulated.splice(0, simulated.length, ...result.field);
      }
    });
  }
});
