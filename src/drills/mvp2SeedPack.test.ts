import { describe, it, expect } from "vitest";
import sourceCatalog from "./sourceCatalog.json";
import mvp2Seed from "./packs/mvp2-seed.json";
import { loadDrillPackV2, loadSourceCatalog } from "./drillLoaderV2.ts";
import { playableStartFromVariant } from "./playableStart.ts";
import { createEngineFromPlayableStart } from "../engine/gameState.ts";
import {
  buildSolutionSteps,
  validateRoutePieceOrder,
} from "./solutionSteps.ts";
import { matchesBoardMask } from "./outcomeMatcher.ts";

const SMOKE_DRILL_ID = "v2-smoke-hold-route-001";

const EXPECTED_DRILL_IDS = [
  "mvp2-seed-allspin-validity",
  "mvp2-seed-allspin-secondary-b2b-filler",
  "mvp2-seed-allspin-stack-balance",
  "mvp2-seed-allspin-local-parity-repair",
  "mvp2-seed-allspin-clean-vs-dirty",
  "mvp2-seed-allspin-scarlet",
  "mvp2-seed-allspin-coral",
  "mvp2-seed-allspin-amaranth",
  "mvp2-seed-core-kaidan",
  "mvp2-seed-core-parapet",
  "mvp2-seed-core-stmb-cave-clean",
  "mvp2-seed-core-sky-prop",
] as const;

const CERTAIN_VARIANT_COUNTS: Record<string, number> = {
  "mvp2-seed-allspin-secondary-b2b-filler": 2,
  "mvp2-seed-core-kaidan": 2,
};

const REQUIRED_BADTEMPTATION_DRILLS = [
  "mvp2-seed-allspin-validity",
  "mvp2-seed-allspin-clean-vs-dirty",
];

describe("MVP 2 seed pack", () => {
  const catalog = loadSourceCatalog(sourceCatalog);
  const pack = loadDrillPackV2(mvp2Seed, catalog);

  it("loads through loadDrillPackV2", () => {
    expect(pack.version).toBe(2);
  });

  it("pack id is mvp2-seed", () => {
    expect(pack.id).toBe("mvp2-seed");
  });

  it("pack title is MVP 2 Seed Curriculum", () => {
    expect(pack.title).toBe("MVP 2 Seed Curriculum");
  });

  it("has exactly 12 drills", () => {
    expect(pack.drills).toHaveLength(12);
  });

  it("has exactly 8 all-spin drills and 4 core-tspin drills", () => {
    const allspin = pack.drills.filter((d) => d.family === "all-spin");
    const core = pack.drills.filter((d) => d.family === "core-tspin");
    expect(allspin).toHaveLength(8);
    expect(core).toHaveLength(4);
  });

  it("matches the exact expected drill id list", () => {
    const ids = pack.drills.map((d) => d.id);
    expect(ids.sort()).toEqual([...EXPECTED_DRILL_IDS].sort());
  });

  it("has exactly 14 variants total", () => {
    const total = pack.drills.reduce((sum, d) => sum + d.variants.length, 0);
    expect(total).toBe(14);
  });

  it("matches the required variant counts for multi-variant drills", () => {
    for (const [drillId, count] of Object.entries(CERTAIN_VARIANT_COUNTS)) {
      const drill = pack.drills.find((d) => d.id === drillId);
      expect(drill).toBeDefined();
      if (drill === undefined) continue;
      expect(drill.variants).toHaveLength(count);
    }
  });

  it("every other drill has exactly one variant", () => {
    for (const drill of pack.drills) {
      if (CERTAIN_VARIANT_COUNTS[drill.id] !== undefined) continue;
      expect(drill.variants).toHaveLength(1);
    }
  });

  it("has exactly 14 solution routes total", () => {
    const total = pack.drills.reduce(
      (sum, d) => sum + d.solutionRoutes.length,
      0,
    );
    expect(total).toBe(14);
  });

  it("does not contain the smoke drill id", () => {
    const ids = pack.drills.map((d) => d.id);
    expect(ids).not.toContain(SMOKE_DRILL_ID);
  });

  it("every variant initializes via playableStartFromVariant + createEngineFromPlayableStart", () => {
    for (const drill of pack.drills) {
      for (const variant of drill.variants) {
        const start = playableStartFromVariant(variant);
        const init = createEngineFromPlayableStart(start);
        if (!init.ok) {
          throw new Error(
            `init failed for ${drill.id}/${variant.id}: ${init.reason}`,
          );
        }
        expect(init.ok).toBe(true);
      }
    }
  });

  it("every variant has at least one route", () => {
    for (const drill of pack.drills) {
      for (const variant of drill.variants) {
        const routes = drill.solutionRoutes.filter(
          (r) => r.variantId === variant.id,
        );
        expect(routes.length).toBeGreaterThan(0);
      }
    }
  });

  it("every accepted outcome is reached by at least one route", () => {
    for (const drill of pack.drills) {
      for (const outcome of drill.acceptedOutcomes) {
        const routes = drill.solutionRoutes.filter(
          (r) => r.outcomeId === outcome.id,
        );
        expect(routes.length).toBeGreaterThan(0);
      }
    }
  });

  it("every route has reachable piece order via validateRoutePieceOrder", () => {
    for (const drill of pack.drills) {
      for (const route of drill.solutionRoutes) {
        const variant = drill.variants.find((v) => v.id === route.variantId);
        expect(variant).toBeDefined();
        if (variant === undefined) continue;
        const result = validateRoutePieceOrder(variant, route);
        if (!result.ok) {
          throw new Error(
            `piece order unreachable for ${drill.id}/${route.id}`,
          );
        }
        expect(result.ok).toBe(true);
      }
    }
  });

  it("every route replays successfully via buildSolutionSteps", () => {
    for (const drill of pack.drills) {
      for (const route of drill.solutionRoutes) {
        const variant = drill.variants.find((v) => v.id === route.variantId);
        expect(variant).toBeDefined();
        if (variant === undefined) continue;
        const result = buildSolutionSteps(
          variant,
          route,
          drill.acceptedOutcomes,
        );
        if (!result.ok) {
          throw new Error(`replay failed for ${drill.id}/${route.id}`);
        }
        expect(result.ok).toBe(true);
      }
    }
  });

  it("every final route step matches its linked accepted outcome", () => {
    for (const drill of pack.drills) {
      for (const route of drill.solutionRoutes) {
        const variant = drill.variants.find((v) => v.id === route.variantId);
        expect(variant).toBeDefined();
        if (variant === undefined) continue;
        const result = buildSolutionSteps(
          variant,
          route,
          drill.acceptedOutcomes,
        );
        expect(result.ok).toBe(true);
        if (!result.ok) continue;
        const finalStep = result.steps[result.steps.length - 1];
        const outcome = drill.acceptedOutcomes.find(
          (o) => o.id === route.outcomeId,
        );
        expect(outcome).toBeDefined();
        if (outcome === undefined) continue;
        expect(matchesBoardMask(finalStep.field, outcome.mask)).toBe(true);
      }
    }
  });

  it("every playable source ref resolves to a catalog entry", () => {
    const catIds = new Set(catalog.entries.map((e) => e.id));
    for (const drill of pack.drills) {
      for (const ref of drill.sourceRefs) {
        expect(catIds.has(ref.catalogId)).toBe(true);
      }
    }
  });

  it("every playable catalog entry links to an existing seed drill", () => {
    const drillIds = new Set(pack.drills.map((d) => d.id));
    for (const entry of catalog.entries) {
      if (entry.status !== "playable") continue;
      expect(entry.drillIds.length).toBeGreaterThan(0);
      for (const id of entry.drillIds) {
        expect(drillIds.has(id)).toBe(true);
      }
    }
  });

  it("every seed drill is referenced by at least one playable catalog entry", () => {
    for (const drill of pack.drills) {
      const referrers = catalog.entries.filter(
        (e) => e.status === "playable" && e.drillIds.includes(drill.id),
      );
      expect(referrers.length).toBeGreaterThan(0);
    }
  });

  it("required bad-temptation drills have non-empty badTemptations", () => {
    for (const drillId of REQUIRED_BADTEMPTATION_DRILLS) {
      const drill = pack.drills.find((d) => d.id === drillId);
      expect(drill).toBeDefined();
      if (drill === undefined) continue;
      expect(drill.badTemptations).toBeDefined();
      expect((drill.badTemptations ?? []).length).toBeGreaterThan(0);
    }
  });

  it("no catalog entry references v2-smoke-hold-route-001", () => {
    for (const entry of catalog.entries) {
      expect(entry.drillIds).not.toContain(SMOKE_DRILL_ID);
    }
  });

  it("honesty review: goals use final-form/shape wording and disclaim spin/B2B verification", () => {
    const POSITIVE = [
      "final form",
      "final-form",
      "shape",
      "setup",
      "intended route",
    ];
    for (const drill of pack.drills) {
      const text = drill.goal.toLowerCase();
      const hasPositive = POSITIVE.some((p) => text.includes(p));
      expect(hasPositive, `positive wording in ${drill.id} goal`).toBe(true);
      // No positive claim of verifying spin/B2B/combo/attack execution
      expect(text).not.toMatch(/\bverifies?\b[^.]*\b(spin|b2b|combo|attack)\b/);
      // Each goal must contain a model-limit disclaimer
      const disclaimers = [
        "not modeled",
        "does not check",
        "does not detect",
        "not the spin",
        "spin is not",
        "spin was not",
        "are not modeled",
      ];
      const hasDisclaimer = disclaimers.some((d) => text.includes(d));
      expect(hasDisclaimer, `disclaimer in ${drill.id} goal`).toBe(true);
    }
  });
});
