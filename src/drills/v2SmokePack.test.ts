import { describe, it, expect } from "vitest";
import sourceCatalog from "./sourceCatalog.json";
import v2Smoke from "./packs/v2-smoke.json";
import { loadDrillPackV2, loadSourceCatalog } from "./drillLoaderV2.ts";
import { playableStartFromVariant } from "./playableStart.ts";
import {
  createEngineFromPlayableStart,
  hold,
  snapshot,
} from "../engine/gameState.ts";

describe("V2 source catalog", () => {
  it("loads via loadSourceCatalog", () => {
    const catalog = loadSourceCatalog(sourceCatalog);
    expect(catalog.version).toBe(1);
    expect(catalog.entries.length).toBeGreaterThan(0);
  });
});

describe("V2 smoke pack fixture", () => {
  const catalog = loadSourceCatalog(sourceCatalog);
  const pack = loadDrillPackV2(v2Smoke, catalog);

  it("loads via loadDrillPackV2", () => {
    expect(pack.version).toBe(2);
    expect(pack.id).toBe("mvp2-smoke");
    expect(pack.title).toBe("MVP 2 Smoke Pack");
  });

  it("contains exactly one drill with the documented id", () => {
    expect(pack.drills).toHaveLength(1);
    expect(pack.drills[0].id).toBe("v2-smoke-hold-route-001");
  });

  it("includes at least one variant with a non-null hold", () => {
    const variant = pack.drills[0].variants[0];
    expect(variant.hold).not.toBeNull();
    expect(variant.hold).toBe("T");
  });

  it("includes at least one accepted outcome with a non-empty mask", () => {
    const outcome = pack.drills[0].acceptedOutcomes[0];
    expect(outcome.id).toBe("o-floor-i-over");
    expect(outcome.mask.length).toBeGreaterThan(0);
    for (const row of outcome.mask) {
      expect(row).toHaveLength(10);
    }
    const hasConstrained = outcome.mask.some((row) =>
      row.some((c) => c === null || c.kind !== "any"),
    );
    expect(hasConstrained).toBe(true);
  });

  it("includes at least one multi-placement solution route linked to that outcome", () => {
    const drill = pack.drills[0];
    const route = drill.solutionRoutes[0];
    expect(route.id).toBe("route-o-then-i");
    expect(route.variantId).toBe("main");
    expect(route.outcomeId).toBe("o-floor-i-over");
    expect(route.placements.length).toBeGreaterThan(1);
    const outcome = drill.acceptedOutcomes.find(
      (o) => o.id === route.outcomeId,
    );
    expect(outcome).toBeDefined();
  });

  it("initializes the smoke variant through createEngineFromPlayableStart via the playable-start adapter", () => {
    const variant = pack.drills[0].variants[0];
    const start = playableStartFromVariant(variant);
    const result = createEngineFromPlayableStart(start);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const snap = snapshot(result.state);
    expect(snap.drillId).toBe("main");
    expect(snap.active?.piece).toBe("O");
    expect(snap.hold).toBe("T");
    expect(snap.queue).toEqual(["I"]);
    expect(snap.canHold).toBe(true);
  });
});

describe("engine handles authored non-null hold from a PlayableStart", () => {
  it("initializes hold from a PlayableStart with non-null hold and swaps on hold()", () => {
    const result = createEngineFromPlayableStart({
      id: "playable-non-null-hold",
      board: [],
      active: "O",
      hold: "T",
      queue: ["I"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(`engine init failed: ${result.reason}`);
    }
    const state = result.state;
    const init = snapshot(state);
    expect(init.hold).toBe("T");
    expect(init.active?.piece).toBe("O");
    expect(init.queue).toEqual(["I"]);
    expect(init.canHold).toBe(true);

    const res = hold(state);
    expect(res.ok).toBe(true);
    expect(state.hold).toBe("O");
    expect(state.active?.piece).toBe("T");
    expect(state.queue).toEqual(["I"]);
    expect(state.canHold).toBe(false);
  });
});
