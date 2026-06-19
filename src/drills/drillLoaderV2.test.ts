import { describe, it, expect } from "vitest";
import { loadDrillPackV2, loadSourceCatalog } from "./drillLoaderV2.ts";
import type { SourceCatalog } from "./drillTypesV2.ts";
import sourceCatalog from "./sourceCatalog.json";
import v2Smoke from "./packs/v2-smoke.json";

const ANY_CELL = { kind: "any" };
const FILL_O = { kind: "filled", piece: "O" };

function makeCatalogEntry(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: "test-entry",
    title: "Test entry",
    family: "all-spin",
    source: {
      title: "Test source",
      path: "docs/test.pdf",
    },
    tags: ["test"],
    priority: "seed",
    status: "playable",
    drillIds: [],
    ...overrides,
  };
}

function makeValidPack(overrides: Record<string, unknown> = {}): unknown {
  return {
    version: 2,
    id: "pack-001",
    title: "Test pack",
    drills: [makeValidDrill()],
    ...overrides,
  };
}

function makeValidDrill(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: "drill-001",
    title: "Test drill",
    category: "Test",
    family: "decision",
    tags: ["test"],
    sourceRefs: [{ catalogId: "test-entry" }],
    goal: "Test goal",
    variants: [makeValidVariant()],
    acceptedOutcomes: [makeValidOutcome()],
    solutionRoutes: [makeValidRoute()],
    ...overrides,
  };
}

function makeValidVariant(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: "main",
    label: "Main variant",
    board: [],
    active: "O",
    hold: null,
    queue: ["I"],
    ...overrides,
  };
}

function makeValidOutcome(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: "o-1",
    label: "Outcome",
    mask: [
      [
        FILL_O,
        FILL_O,
        ANY_CELL,
        ANY_CELL,
        ANY_CELL,
        ANY_CELL,
        ANY_CELL,
        ANY_CELL,
        ANY_CELL,
        ANY_CELL,
      ],
    ],
    explanation: "Smoke outcome.",
    ...overrides,
  };
}

function makeValidRoute(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: "route-1",
    label: "Route",
    variantId: "main",
    outcomeId: "o-1",
    placements: [{ piece: "O", x: 4, y: 0, rotation: "0" }],
    explanation: "Smoke route.",
    ...overrides,
  };
}

function makeCatalog(
  overrides: Partial<Record<string, unknown>> = {},
): SourceCatalog {
  return loadSourceCatalog({
    version: 1,
    entries: [makeCatalogEntry()],
    ...overrides,
  });
}

describe("loadSourceCatalog", () => {
  it("accepts a minimal valid catalog", () => {
    const catalog = loadSourceCatalog({
      version: 1,
      entries: [makeCatalogEntry()],
    });
    expect(catalog.version).toBe(1);
    expect(catalog.entries).toHaveLength(1);
    expect(catalog.entries[0].id).toBe("test-entry");
  });

  it("rejects a non-object input", () => {
    expect(() => loadSourceCatalog(null)).toThrow(/root: expected object/);
    expect(() => loadSourceCatalog([])).toThrow(/root: expected object/);
    expect(() => loadSourceCatalog("nope")).toThrow(/root: expected object/);
  });

  it("rejects a non-1 version", () => {
    expect(() =>
      loadSourceCatalog({ version: 2, entries: [makeCatalogEntry()] }),
    ).toThrow(/root\.version: expected version 1, got 2/);
  });

  it("rejects an empty entries array", () => {
    expect(() => loadSourceCatalog({ version: 1, entries: [] })).toThrow(
      /root\.entries: expected at least one catalog entry/,
    );
  });

  it("rejects duplicate catalog ids", () => {
    expect(() =>
      loadSourceCatalog({
        version: 1,
        entries: [
          makeCatalogEntry({ id: "dup" }),
          makeCatalogEntry({ id: "dup" }),
        ],
      }),
    ).toThrow(
      /entries\[1\]\.id: duplicate catalog id 'dup' \(also at entries\[0\]\)/,
    );
  });

  it("rejects entries with neither source.path nor source.url", () => {
    expect(() =>
      loadSourceCatalog({
        version: 1,
        entries: [makeCatalogEntry({ source: { title: "No source" } })],
      }),
    ).toThrow(/entries\[0\]\.source: expected at least one of 'path' or 'url'/);
  });

  it("rejects an unknown family", () => {
    expect(() =>
      loadSourceCatalog({
        version: 1,
        entries: [makeCatalogEntry({ family: "not-a-family" })],
      }),
    ).toThrow(/entries\[0\]\.family/);
  });

  it("rejects an unknown priority", () => {
    expect(() =>
      loadSourceCatalog({
        version: 1,
        entries: [makeCatalogEntry({ priority: "urgent" })],
      }),
    ).toThrow(/entries\[0\]\.priority/);
  });

  it("rejects an unknown status", () => {
    expect(() =>
      loadSourceCatalog({
        version: 1,
        entries: [makeCatalogEntry({ status: "wip" })],
      }),
    ).toThrow(/entries\[0\]\.status/);
  });

  it("accepts a url-only source", () => {
    const catalog = loadSourceCatalog({
      version: 1,
      entries: [
        makeCatalogEntry({
          source: { title: "Web", url: "https://example.com" },
        }),
      ],
    });
    expect(catalog.entries[0].source.url).toBe("https://example.com");
    expect(catalog.entries[0].source.path).toBeUndefined();
  });

  it("rejects non-string tag entries", () => {
    expect(() =>
      loadSourceCatalog({
        version: 1,
        entries: [makeCatalogEntry({ tags: ["ok", 7] })],
      }),
    ).toThrow(/entries\[0\]\.tags\[1\]: expected string/);
  });
});

describe("loadDrillPackV2", () => {
  it("accepts a minimal valid pack", () => {
    const pack = loadDrillPackV2(makeValidPack(), makeCatalog());
    expect(pack.version).toBe(2);
    expect(pack.drills).toHaveLength(1);
    expect(pack.drills[0].id).toBe("drill-001");
    expect(pack.drills[0].variants[0].hold).toBeNull();
  });

  it("rejects a non-2 version", () => {
    expect(() =>
      loadDrillPackV2(
        { version: 1, id: "p", title: "t", drills: [makeValidDrill()] },
        makeCatalog(),
      ),
    ).toThrow(/root\.version: expected version 2, got 1/);
  });

  it("rejects missing version", () => {
    expect(() =>
      loadDrillPackV2(
        { id: "p", title: "t", drills: [makeValidDrill()] },
        makeCatalog(),
      ),
    ).toThrow(/root\.version/);
  });

  it("rejects an empty drills array", () => {
    expect(() =>
      loadDrillPackV2(
        { version: 2, id: "p", title: "t", drills: [] },
        makeCatalog(),
      ),
    ).toThrow(/root\.drills: pack must contain at least one drill/);
  });

  it("rejects duplicate drill ids with an id-specific error", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({ id: "dup" }),
            makeValidDrill({ id: "dup" }),
          ],
        }),
        makeCatalog(),
      ),
    ).toThrow(
      /drills\[1\]\.id: duplicate drill id 'dup' \(also at drills\[0\]\)/,
    );
  });

  it("rejects duplicate variant ids within a drill", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({
              variants: [
                makeValidVariant({ id: "a" }),
                makeValidVariant({ id: "a" }),
              ],
            }),
          ],
        }),
        makeCatalog(),
      ),
    ).toThrow(/duplicate variant id 'a' within drill/);
  });

  it("rejects a non-null hold with an invalid piece id", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({
              variants: [makeValidVariant({ hold: "X" })],
            }),
          ],
        }),
        makeCatalog(),
      ),
    ).toThrow(/variants\[0\]\.hold.*expected piece id, got 'X'/);
  });

  it("accepts a non-null hold with a valid piece id", () => {
    const pack = loadDrillPackV2(
      makeValidPack({
        drills: [
          makeValidDrill({
            variants: [makeValidVariant({ hold: "T" })],
          }),
        ],
      }),
      makeCatalog(),
    );
    expect(pack.drills[0].variants[0].hold).toBe("T");
  });

  it("rejects a missing hold (must be null or a piece id)", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({
              variants: [
                (() => {
                  const v = makeValidVariant();
                  delete v.hold;
                  return v;
                })(),
              ],
            }),
          ],
        }),
        makeCatalog(),
      ),
    ).toThrow(/variants\[0\]\.hold: missing hold/);
  });

  it("rejects a board row with the wrong width", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({
              variants: [makeValidVariant({ board: [[FILL_O]] })],
            }),
          ],
        }),
        makeCatalog(),
      ),
    ).toThrow(/variants\[0\]\.board\[0\]: expected 10 cells, got 1/);
  });

  it("rejects an invalid active piece", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({
              variants: [makeValidVariant({ active: "Q" })],
            }),
          ],
        }),
        makeCatalog(),
      ),
    ).toThrow(/variants\[0\]\.active/);
  });

  it("rejects an unknown family", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [makeValidDrill({ family: "spin-thing" })],
        }),
        makeCatalog(),
      ),
    ).toThrow(/drills\[0\]\.family/);
  });

  it("rejects a difficulty out of 1..5", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [makeValidDrill({ difficulty: 6 })],
        }),
        makeCatalog(),
      ),
    ).toThrow(/difficulty: expected integer in 1\.\.5, got 6/);
  });

  it("accepts a difficulty inside 1..5", () => {
    const pack = loadDrillPackV2(
      makeValidPack({
        drills: [makeValidDrill({ difficulty: 3 })],
      }),
      makeCatalog(),
    );
    expect(pack.drills[0].difficulty).toBe(3);
  });

  it("rejects an empty sourceRefs array", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [makeValidDrill({ sourceRefs: [] })],
        }),
        makeCatalog(),
      ),
    ).toThrow(/sourceRefs: expected at least one source ref/);
  });

  it("rejects a sourceRef whose catalogId is unknown", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [makeValidDrill({ sourceRefs: [{ catalogId: "missing" }] })],
        }),
        makeCatalog(),
      ),
    ).toThrow(
      /drills\[0\]\.sourceRefs\[0\]\.catalogId: references unknown catalog id 'missing'/,
    );
  });

  it("accepts a sourceRef whose catalogId exists in the catalog", () => {
    const pack = loadDrillPackV2(
      makeValidPack({
        drills: [makeValidDrill({ sourceRefs: [{ catalogId: "test-entry" }] })],
      }),
      makeCatalog(),
    );
    expect(pack.drills[0].sourceRefs[0].catalogId).toBe("test-entry");
  });

  it("rejects an empty variants array", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [makeValidDrill({ variants: [] })],
        }),
        makeCatalog(),
      ),
    ).toThrow(/drills\[0\]\.variants: expected at least one variant/);
  });

  it("rejects an empty acceptedOutcomes array", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [makeValidDrill({ acceptedOutcomes: [] })],
        }),
        makeCatalog(),
      ),
    ).toThrow(/drills\[0\]\.acceptedOutcomes/);
  });

  it("rejects empty variantIds on an outcome", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({
              acceptedOutcomes: [makeValidOutcome({ variantIds: [] })],
            }),
          ],
        }),
        makeCatalog(),
      ),
    ).toThrow(
      /drills\[0\]\.acceptedOutcomes\[0\]\.variantIds: empty variantIds array is invalid/,
    );
  });

  it("rejects variantIds that reference an unknown variant", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({
              acceptedOutcomes: [
                makeValidOutcome({ variantIds: ["main", "alt"] }),
              ],
            }),
          ],
        }),
        makeCatalog(),
      ),
    ).toThrow(
      /drills\[0\]\.acceptedOutcomes\[0\]\.variantIds\[1\]: references unknown variant id 'alt'/,
    );
  });

  it("accepts omitted variantIds (means all variants)", () => {
    const pack = loadDrillPackV2(
      makeValidPack({
        drills: [
          makeValidDrill({
            acceptedOutcomes: [makeValidOutcome()],
          }),
        ],
      }),
      makeCatalog(),
    );
    expect(pack.drills[0].acceptedOutcomes[0].variantIds).toBeUndefined();
  });

  it("rejects a mask with no constrained cells", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({
              acceptedOutcomes: [
                makeValidOutcome({
                  mask: [
                    new Array(10).fill(ANY_CELL),
                    new Array(10).fill(ANY_CELL),
                  ],
                }),
              ],
            }),
          ],
        }),
        makeCatalog(),
      ),
    ).toThrow(
      /drills\[0\]\.acceptedOutcomes\[0\]\.mask: mask has no constrained cells/,
    );
  });

  it("accepts a mask that constrains via a null cell", () => {
    const pack = loadDrillPackV2(
      makeValidPack({
        drills: [
          makeValidDrill({
            acceptedOutcomes: [
              makeValidOutcome({
                mask: [
                  [null, null, null, null, null, null, null, null, null, null],
                ],
              }),
            ],
          }),
        ],
      }),
      makeCatalog(),
    );
    expect(pack.drills[0].acceptedOutcomes[0].mask[0][0]).toBeNull();
  });

  it("rejects a mask row with the wrong width", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({
              acceptedOutcomes: [
                makeValidOutcome({ mask: [[FILL_O, FILL_O, FILL_O]] }),
              ],
            }),
          ],
        }),
        makeCatalog(),
      ),
    ).toThrow(
      /drills\[0\]\.acceptedOutcomes\[0\]\.mask\[0\]: expected 10 cells, got 3/,
    );
  });

  it("rejects a mask with an unknown cell kind", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({
              acceptedOutcomes: [
                makeValidOutcome({
                  mask: [
                    [
                      FILL_O,
                      FILL_O,
                      FILL_O,
                      FILL_O,
                      { kind: "weird" },
                      FILL_O,
                      FILL_O,
                      FILL_O,
                      FILL_O,
                      FILL_O,
                    ],
                  ],
                }),
              ],
            }),
          ],
        }),
        makeCatalog(),
      ),
    ).toThrow(/unknown mask cell kind 'weird'/);
  });

  it("rejects a filled mask cell with an invalid piece", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({
              acceptedOutcomes: [
                makeValidOutcome({
                  mask: [
                    [
                      FILL_O,
                      FILL_O,
                      FILL_O,
                      FILL_O,
                      { kind: "filled", piece: "X" },
                      FILL_O,
                      FILL_O,
                      FILL_O,
                      FILL_O,
                      FILL_O,
                    ],
                  ],
                }),
              ],
            }),
          ],
        }),
        makeCatalog(),
      ),
    ).toThrow(/'filled' mask cell has invalid piece 'X'/);
  });

  it("rejects extra keys on mask cells", () => {
    for (const cell of [
      { kind: "any", foo: 1 },
      { kind: "occupied", foo: 1 },
      { kind: "garbage", foo: 1 },
      { kind: "filled", piece: "O", foo: 1 },
    ]) {
      expect(() =>
        loadDrillPackV2(
          makeValidPack({
            drills: [
              makeValidDrill({
                acceptedOutcomes: [
                  makeValidOutcome({
                    mask: [
                      [
                        FILL_O,
                        FILL_O,
                        FILL_O,
                        FILL_O,
                        cell,
                        FILL_O,
                        FILL_O,
                        FILL_O,
                        FILL_O,
                        FILL_O,
                      ],
                    ],
                  }),
                ],
              }),
            ],
          }),
          makeCatalog(),
        ),
      ).toThrow(/mask\[0\]\[4\]: unexpected key 'foo'/);
    }
  });

  it("rejects misspelled piece keys on filled mask cells", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({
              acceptedOutcomes: [
                makeValidOutcome({
                  mask: [
                    [
                      FILL_O,
                      FILL_O,
                      FILL_O,
                      FILL_O,
                      { kind: "filled", peice: "O" },
                      FILL_O,
                      FILL_O,
                      FILL_O,
                      FILL_O,
                      FILL_O,
                    ],
                  ],
                }),
              ],
            }),
          ],
        }),
        makeCatalog(),
      ),
    ).toThrow(/mask\[0\]\[4\]: unexpected key 'peice'/);
  });

  it("accepts filled mask cells with and without a piece", () => {
    const pack = loadDrillPackV2(
      makeValidPack({
        drills: [
          makeValidDrill({
            acceptedOutcomes: [
              makeValidOutcome({
                mask: [
                  [
                    { kind: "filled" },
                    FILL_O,
                    ANY_CELL,
                    ANY_CELL,
                    ANY_CELL,
                    ANY_CELL,
                    ANY_CELL,
                    ANY_CELL,
                    ANY_CELL,
                    ANY_CELL,
                  ],
                ],
              }),
            ],
          }),
        ],
      }),
      makeCatalog(),
    );
    expect(pack.drills[0].acceptedOutcomes[0].mask[0][0]).toEqual({
      kind: "filled",
    });
    expect(pack.drills[0].acceptedOutcomes[0].mask[0][1]).toEqual(FILL_O);
  });

  it("rejects a solution route whose variantId is unknown", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({
              solutionRoutes: [makeValidRoute({ variantId: "alt" })],
            }),
          ],
        }),
        makeCatalog(),
      ),
    ).toThrow(
      /drills\[0\]\.solutionRoutes\[0\]\.variantId: references unknown variant id 'alt'/,
    );
  });

  it("rejects a solution route whose outcomeId is unknown", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({
              solutionRoutes: [makeValidRoute({ outcomeId: "missing" })],
            }),
          ],
        }),
        makeCatalog(),
      ),
    ).toThrow(
      /drills\[0\]\.solutionRoutes\[0\]\.outcomeId: references unknown accepted outcome id 'missing'/,
    );
  });

  it("rejects a route whose outcome is limited to a different variant", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({
              variants: [
                makeValidVariant({ id: "main" }),
                makeValidVariant({ id: "alt" }),
              ],
              acceptedOutcomes: [
                makeValidOutcome({ id: "o-1", variantIds: ["alt"] }),
              ],
              solutionRoutes: [makeValidRoute({ variantId: "main" })],
            }),
          ],
        }),
        makeCatalog(),
      ),
    ).toThrow(/is limited to variants \[alt\], not 'main'/);
  });

  it("rejects an empty solutionRoutes array", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [makeValidDrill({ solutionRoutes: [] })],
        }),
        makeCatalog(),
      ),
    ).toThrow(
      /drills\[0\]\.solutionRoutes: expected at least one solution route/,
    );
  });

  it("rejects an empty placements array on a route", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({
              solutionRoutes: [makeValidRoute({ placements: [] })],
            }),
          ],
        }),
        makeCatalog(),
      ),
    ).toThrow(/placements: expected at least one placement/);
  });

  it("rejects a route placement with an invalid rotation", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({
              solutionRoutes: [
                makeValidRoute({
                  placements: [{ piece: "O", x: 4, y: 0, rotation: "X" }],
                }),
              ],
            }),
          ],
        }),
        makeCatalog(),
      ),
    ).toThrow(/rotation '0'\|'R'\|'2'\|'L'/);
  });

  it("rejects a variant combo that is negative", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({
              variants: [makeValidVariant({ combo: -1 })],
            }),
          ],
        }),
        makeCatalog(),
      ),
    ).toThrow(/variants\[0\]\.combo/);
  });

  it("rejects a variant garbageHoleColumn out of 0..9", () => {
    expect(() =>
      loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({
              variants: [makeValidVariant({ garbageHoleColumn: 10 })],
            }),
          ],
        }),
        makeCatalog(),
      ),
    ).toThrow(/garbageHoleColumn/);
  });

  it("rejects variant b2bActive values that are not boolean", () => {
    for (const b2bActive of ["false", 1]) {
      expect(() =>
        loadDrillPackV2(
          makeValidPack({
            drills: [
              makeValidDrill({
                variants: [makeValidVariant({ b2bActive })],
              }),
            ],
          }),
          makeCatalog(),
        ),
      ).toThrow(/variants\[0\]\.b2bActive: expected boolean/);
    }
  });

  it("accepts explicit boolean b2bActive values", () => {
    for (const b2bActive of [false, true]) {
      const pack = loadDrillPackV2(
        makeValidPack({
          drills: [
            makeValidDrill({
              variants: [makeValidVariant({ b2bActive })],
            }),
          ],
        }),
        makeCatalog(),
      );
      expect(pack.drills[0].variants[0].b2bActive).toBe(b2bActive);
    }
  });
});

describe("bundled V2 source catalog", () => {
  it("loads without error and includes the smoke drill id in the playable entry", () => {
    const catalog = loadSourceCatalog(sourceCatalog);
    expect(catalog.version).toBe(1);
    const smoke = catalog.entries.find((e) =>
      e.drillIds.includes("v2-smoke-hold-route-001"),
    );
    expect(smoke).toBeDefined();
    expect(smoke?.status).toBe("playable");
  });
});

describe("bundled V2 smoke pack", () => {
  it("loads through the V2 loader", () => {
    const pack = loadDrillPackV2(v2Smoke, loadSourceCatalog(sourceCatalog));
    expect(pack.version).toBe(2);
    expect(pack.id).toBe("mvp2-smoke");
    expect(pack.drills).toHaveLength(1);
    const drill = pack.drills[0];
    expect(drill.id).toBe("v2-smoke-hold-route-001");
    expect(drill.variants[0].hold).toBe("T");
    expect(drill.acceptedOutcomes[0].mask).toHaveLength(3);
    expect(drill.solutionRoutes[0].placements).toHaveLength(2);
  });
});
