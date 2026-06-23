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
import { GameLoop, type LoopMatchResult } from "../loop/gameLoop.ts";
import { InputController } from "../input/inputController.ts";
import {
  DEFAULT_HANDLING,
  DEFAULT_KEYBINDS,
} from "../input/defaultSettings.ts";
import {
  buildSolutionSteps,
  validateRoutePieceOrder,
} from "./solutionSteps.ts";
import { matchesBoardMask } from "./outcomeMatcher.ts";

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

describe("V2 smoke pack plays to solved via GameLoop outcome mode", () => {
  const catalog = loadSourceCatalog(sourceCatalog);
  const pack = loadDrillPackV2(v2Smoke, catalog);
  const drill = pack.drills[0];
  const variant = drill.variants[0];

  it("places the authored route (O then I) and reaches a solved outcome", () => {
    const start = playableStartFromVariant(variant);
    const init = createEngineFromPlayableStart(start);
    if (!init.ok) {
      throw new Error(`engine init failed: ${init.reason}`);
    }
    const state = init.state;
    const controller = new InputController({
      version: 1,
      keybinds: DEFAULT_KEYBINDS,
      handling: DEFAULT_HANDLING,
    });
    const matchList: LoopMatchResult[] = [];
    const loop = new GameLoop({
      getEngine: () => state,
      matchMode: {
        kind: "outcome",
        acceptedOutcomes: drill.acceptedOutcomes,
        variantId: variant.id,
      },
      controller,
      onSnapshot: () => {},
      onPhase: () => {},
      onMatchResult: (r) => matchList.push(r),
      onToggleSolution: () => {},
      onResetView: () => {},
      getHandling: () => DEFAULT_HANDLING,
    });

    // Initial pending.
    loop.setEngine(state, {
      kind: "outcome",
      acceptedOutcomes: drill.acceptedOutcomes,
      variantId: variant.id,
    });
    expect(matchList.at(-1)?.status).toBe("pending");

    // O is the active piece (spawn origin (4, 20)); hardDrop places it on
    // the floor at row 0-1, columns 4-5.
    const oDrop = controller.press("Space", {});
    expect(oDrop).toEqual([{ kind: "hardDrop" }]);
    loop.dispatch(oDrop);
    controller.release("Space", {});
    expect(state.active?.piece).toBe("I");
    expect(matchList.at(-1)?.status).toBe("pending");

    // I spawns at (3, 19) and rests on top of the O block at row 2,
    // columns 3-6.
    const iDrop = controller.press("Space", {});
    expect(iDrop).toEqual([{ kind: "hardDrop" }]);
    loop.dispatch(iDrop);
    controller.release("Space", {});
    expect(matchList.at(-1)).toMatchObject({
      status: "solved",
      outcome: { id: "o-floor-i-over" },
    });
  });

  it("non-null hold behavior remains correct: hold() swaps active and hold", () => {
    const start = playableStartFromVariant(variant);
    const init = createEngineFromPlayableStart(start);
    if (!init.ok) {
      throw new Error(`engine init failed: ${init.reason}`);
    }
    const state = init.state;
    // Pre-lock state: active=O, hold=T, queue=[I], canHold=true.
    expect(state.active?.piece).toBe("O");
    expect(state.hold).toBe("T");
    expect(state.queue).toEqual(["I"]);
    expect(state.canHold).toBe(true);

    const res = hold(state);
    expect(res.ok).toBe(true);
    // After hold: active=T (from hold), hold=O (just-active), queue=[I],
    // canHold=false.
    expect(state.active?.piece).toBe("T");
    expect(state.hold).toBe("O");
    expect(state.queue).toEqual(["I"]);
    expect(state.canHold).toBe(false);
  });
});

describe("V2 smoke pack route replay", () => {
  const catalog = loadSourceCatalog(sourceCatalog);
  const pack = loadDrillPackV2(v2Smoke, catalog);
  const drill = pack.drills[0];

  it("every bundled route has reachable piece order", () => {
    for (const variant of drill.variants) {
      const routes = drill.solutionRoutes.filter(
        (r) => r.variantId === variant.id,
      );
      for (const route of routes) {
        const result = validateRoutePieceOrder(variant, route);
        expect(result.ok).toBe(true);
      }
    }
  });

  it("every bundled route replays successfully", () => {
    for (const variant of drill.variants) {
      const routes = drill.solutionRoutes.filter(
        (r) => r.variantId === variant.id,
      );
      for (const route of routes) {
        const result = buildSolutionSteps(
          variant,
          route,
          drill.acceptedOutcomes,
        );
        expect(result.ok).toBe(true);
      }
    }
  });

  it("route-o-then-i generates exactly two steps", () => {
    const variant = drill.variants[0];
    const route = drill.solutionRoutes.find((r) => r.id === "route-o-then-i");
    expect(route).toBeDefined();
    if (route === undefined) return;
    const result = buildSolutionSteps(variant, route, drill.acceptedOutcomes);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps).toHaveLength(2);
  });

  it("the final smoke step matches o-floor-i-over", () => {
    const variant = drill.variants[0];
    const route = drill.solutionRoutes.find((r) => r.id === "route-o-then-i");
    expect(route).toBeDefined();
    if (route === undefined) return;
    const outcome = drill.acceptedOutcomes.find(
      (o) => o.id === "o-floor-i-over",
    );
    expect(outcome).toBeDefined();
    if (outcome === undefined) return;
    const result = buildSolutionSteps(variant, route, drill.acceptedOutcomes);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const finalStep = result.steps[result.steps.length - 1];
    expect(matchesBoardMask(finalStep.field, outcome.mask)).toBe(true);
  });
});
