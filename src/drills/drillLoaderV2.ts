import { BOARD_WIDTH, FIELD_HEIGHT } from "../engine/constants.ts";
import { isPieceId } from "../engine/pieces.ts";
import type { BoardCell } from "./drillTypes.ts";
import type {
  AcceptedOutcome,
  BoardMaskRow,
  CatalogEntry,
  CatalogPriority,
  CatalogSource,
  CatalogStatus,
  DrillFamily,
  DrillPackV2,
  DrillV2,
  MaskCell,
  SolutionRoute,
  SourceCatalog,
  SourceRef,
} from "./drillTypesV2.ts";
import type { PieceId, RotationState } from "../engine/pieces.ts";

const FAMILIES: ReadonlySet<DrillFamily> = new Set<DrillFamily>([
  "all-spin",
  "core-tspin",
  "stacking",
  "decision",
]);

const PRIORITIES: ReadonlySet<CatalogPriority> = new Set<CatalogPriority>([
  "seed",
  "high",
  "normal",
  "later",
]);

const STATUSES: ReadonlySet<CatalogStatus> = new Set<CatalogStatus>([
  "playable",
  "backlog",
  "deferred",
]);

function fail(path: string, message: string): never {
  throw new Error(`Invalid V2 drill data at ${path}: ${message}`);
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    fail(path, `expected string, got ${typeof value}`);
  }
  return value;
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(path, `expected array, got ${typeof value}`);
  }
  return value;
}

function requireObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(path, "expected object");
  }
  return value as Record<string, unknown>;
}

function requireNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(path, `expected number, got ${typeof value}`);
  }
  return value;
}

function requireInteger(value: unknown, path: string): number {
  const n = requireNumber(value, path);
  if (!Number.isInteger(n)) {
    fail(path, `expected integer, got ${n}`);
  }
  return n;
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    fail(path, `expected boolean, got ${typeof value}`);
  }
  return value;
}

function requireRotation(value: unknown, path: string): RotationState {
  if (value !== "0" && value !== "R" && value !== "2" && value !== "L") {
    fail(path, `expected rotation '0'|'R'|'2'|'L', got '${String(value)}'`);
  }
  return value;
}

function requirePieceId(value: unknown, path: string): PieceId {
  if (!isPieceId(value)) {
    fail(path, `expected piece id, got '${String(value)}'`);
  }
  return value;
}

function requireFamily(value: unknown, path: string): DrillFamily {
  if (typeof value !== "string" || !FAMILIES.has(value as DrillFamily)) {
    fail(
      path,
      `expected family 'all-spin'|'core-tspin'|'stacking'|'decision', got '${String(value)}'`,
    );
  }
  return value as DrillFamily;
}

function requirePriority(value: unknown, path: string): CatalogPriority {
  if (typeof value !== "string" || !PRIORITIES.has(value as CatalogPriority)) {
    fail(
      path,
      `expected priority 'seed'|'high'|'normal'|'later', got '${String(value)}'`,
    );
  }
  return value as CatalogPriority;
}

function requireStatus(value: unknown, path: string): CatalogStatus {
  if (typeof value !== "string" || !STATUSES.has(value as CatalogStatus)) {
    fail(
      path,
      `expected status 'playable'|'backlog'|'deferred', got '${String(value)}'`,
    );
  }
  return value as CatalogStatus;
}

function parseBoardCell(value: unknown, path: string): BoardCell {
  if (value === null) {
    return null;
  }
  if (typeof value !== "object" || value === null) {
    fail(path, `expected null or cell object, got ${typeof value}`);
  }
  const cell = value as { kind?: unknown; piece?: unknown };
  if (cell.kind === "garbage") {
    return { kind: "garbage" };
  }
  if (cell.kind === "filled") {
    if (!isPieceId(cell.piece)) {
      fail(path, `filled cell has invalid piece '${String(cell.piece)}'`);
    }
    return { kind: "filled", piece: cell.piece };
  }
  fail(path, `unknown cell kind '${String(cell.kind)}'`);
}

function parseBoard(value: unknown, path: string): BoardCell[][] {
  const rows = requireArray(value, path);
  return rows.map((row, y) => {
    const cells = requireArray(row, `${path}[${y}]`);
    if (cells.length !== BOARD_WIDTH) {
      fail(
        `${path}[${y}]`,
        `expected ${BOARD_WIDTH} cells, got ${cells.length}`,
      );
    }
    return cells.map((cell, x) => parseBoardCell(cell, `${path}[${y}][${x}]`));
  });
}

function parseCombo(value: unknown, path: string): number | undefined {
  if (value === undefined) return undefined;
  const n = requireInteger(value, path);
  if (n < 0) {
    fail(path, `expected non-negative integer, got ${n}`);
  }
  return n;
}

function parseGarbageHoleColumn(
  value: unknown,
  path: string,
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const n = requireInteger(value, path);
  if (n < 0 || n > 9) {
    fail(path, `expected integer in 0..9, got ${n}`);
  }
  return n;
}

function parseStringArray(value: unknown, path: string): string[] {
  const arr = requireArray(value, path);
  return arr.map((v, i) => requireString(v, `${path}[${i}]`));
}

function parseDifficulty(
  value: unknown,
  path: string,
): 1 | 2 | 3 | 4 | 5 | undefined {
  if (value === undefined) return undefined;
  const n = requireInteger(value, path);
  if (n < 1 || n > 5) {
    fail(path, `expected integer in 1..5, got ${n}`);
  }
  return n as 1 | 2 | 3 | 4 | 5;
}

function parseCatalogSource(value: unknown, path: string): CatalogSource {
  const obj = requireObject(value, path);
  if (obj.path === undefined && obj.url === undefined) {
    fail(path, "expected at least one of 'path' or 'url'");
  }
  const out: CatalogSource = {
    title: requireString(obj.title, `${path}.title`),
  };
  if (obj.path !== undefined) {
    out.path = requireString(obj.path, `${path}.path`);
  }
  if (obj.url !== undefined) {
    out.url = requireString(obj.url, `${path}.url`);
  }
  if (obj.section !== undefined) {
    out.section = requireString(obj.section, `${path}.section`);
  }
  if (obj.page !== undefined) {
    out.page = requireInteger(obj.page, `${path}.page`);
  }
  return out;
}

function parseCatalogEntry(value: unknown, index: number): CatalogEntry {
  const path = `entries[${index}]`;
  const obj = requireObject(value, path);
  return {
    id: requireString(obj.id, `${path}.id`),
    title: requireString(obj.title, `${path}.title`),
    family: requireFamily(obj.family, `${path}.family`),
    source: parseCatalogSource(obj.source, `${path}.source`),
    tags: parseStringArray(obj.tags, `${path}.tags`),
    priority: requirePriority(obj.priority, `${path}.priority`),
    status: requireStatus(obj.status, `${path}.status`),
    drillIds: parseStringArray(obj.drillIds, `${path}.drillIds`),
    notes:
      obj.notes === undefined
        ? undefined
        : requireString(obj.notes, `${path}.notes`),
  };
}

export function loadSourceCatalog(input: unknown): SourceCatalog {
  const obj = requireObject(input, "root");
  if (obj.version !== 1) {
    fail("root.version", `expected version 1, got ${String(obj.version)}`);
  }
  const entries = requireArray(obj.entries, "root.entries");
  if (entries.length === 0) {
    fail("root.entries", "expected at least one catalog entry");
  }
  const parsed = entries.map((e, i) => parseCatalogEntry(e, i));
  const seen = new Map<string, number>();
  for (let i = 0; i < parsed.length; i++) {
    const id = parsed[i].id;
    const prior = seen.get(id);
    if (prior !== undefined) {
      fail(
        `entries[${i}].id`,
        `duplicate catalog id '${id}' (also at entries[${prior}])`,
      );
    }
    seen.set(id, i);
  }
  return { version: 1, entries: parsed };
}

function parseSourceRef(value: unknown, path: string): SourceRef {
  const obj = requireObject(value, path);
  const ref: SourceRef = {
    catalogId: requireString(obj.catalogId, `${path}.catalogId`),
  };
  if (obj.section !== undefined) {
    ref.section = requireString(obj.section, `${path}.section`);
  }
  if (obj.page !== undefined) {
    ref.page = requireInteger(obj.page, `${path}.page`);
  }
  return ref;
}

function requireExactKeys(
  obj: Record<string, unknown>,
  path: string,
  allowed: readonly string[],
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(obj)) {
    if (!allowedSet.has(key)) {
      fail(path, `unexpected key '${key}'`);
    }
  }
}

function parseMaskCell(value: unknown, path: string): MaskCell {
  if (value === null) return null;
  const cell = requireObject(value, path);
  if (cell.kind === "any") {
    requireExactKeys(cell, path, ["kind"]);
    return { kind: "any" };
  }
  if (cell.kind === "occupied") {
    requireExactKeys(cell, path, ["kind"]);
    return { kind: "occupied" };
  }
  if (cell.kind === "garbage") {
    requireExactKeys(cell, path, ["kind"]);
    return { kind: "garbage" };
  }
  if (cell.kind === "filled") {
    requireExactKeys(cell, path, ["kind", "piece"]);
    if (cell.piece === undefined) {
      return { kind: "filled" };
    }
    if (!isPieceId(cell.piece)) {
      fail(
        path,
        `'filled' mask cell has invalid piece '${String(cell.piece)}'`,
      );
    }
    return { kind: "filled", piece: cell.piece };
  }
  fail(path, `unknown mask cell kind '${String(cell.kind)}'`);
}

function parseMaskRow(value: unknown, y: number, path: string): BoardMaskRow {
  const arr = requireArray(value, `${path}[${y}]`);
  if (arr.length !== BOARD_WIDTH) {
    fail(`${path}[${y}]`, `expected ${BOARD_WIDTH} cells, got ${arr.length}`);
  }
  return arr.map((cell, x) => parseMaskCell(cell, `${path}[${y}][${x}]`));
}

function maskHasConstrainedCell(mask: BoardMaskRow[]): boolean {
  for (const row of mask) {
    for (const cell of row) {
      if (cell === null) return true;
      if (cell.kind !== "any") return true;
    }
  }
  return false;
}

function parseVariant(
  value: unknown,
  index: number,
  parentPath: string,
): DrillV2["variants"][number] {
  const path = `${parentPath}.variants[${index}]`;
  const obj = requireObject(value, path);
  const active = requirePieceId(obj.active, `${path}.active`);
  let hold: PieceId | null = null;
  if (obj.hold === null) {
    hold = null;
  } else if (obj.hold === undefined) {
    fail(`${path}.hold`, "missing hold (use null for empty hold)");
  } else {
    hold = requirePieceId(obj.hold, `${path}.hold`);
  }
  const queue = requireArray(obj.queue, `${path}.queue`).map((p, i) =>
    requirePieceId(p, `${path}.queue[${i}]`),
  );
  return {
    id: requireString(obj.id, `${path}.id`),
    label: requireString(obj.label, `${path}.label`),
    board: parseBoard(obj.board, `${path}.board`),
    active,
    hold,
    queue,
    b2bActive:
      obj.b2bActive === undefined
        ? undefined
        : requireBoolean(obj.b2bActive, `${path}.b2bActive`),
    combo: parseCombo(obj.combo, `${path}.combo`),
    garbageHoleColumn: parseGarbageHoleColumn(
      obj.garbageHoleColumn,
      `${path}.garbageHoleColumn`,
    ),
  };
}

function parseAcceptedOutcome(
  value: unknown,
  index: number,
  parentPath: string,
): AcceptedOutcome {
  const path = `${parentPath}.acceptedOutcomes[${index}]`;
  const obj = requireObject(value, path);
  let variantIds: string[] | undefined;
  if (obj.variantIds === undefined) {
    variantIds = undefined;
  } else {
    const arr = requireArray(obj.variantIds, `${path}.variantIds`);
    if (arr.length === 0) {
      fail(`${path}.variantIds`, "empty variantIds array is invalid");
    }
    variantIds = arr.map((v, i) =>
      requireString(v, `${path}.variantIds[${i}]`),
    );
  }
  const maskRaw = requireArray(obj.mask, `${path}.mask`);
  if (maskRaw.length === 0) {
    fail(`${path}.mask`, "expected at least one mask row");
  }
  if (maskRaw.length > FIELD_HEIGHT) {
    fail(
      `${path}.mask`,
      `mask has ${maskRaw.length} rows; engine field is ${FIELD_HEIGHT}`,
    );
  }
  const mask = maskRaw.map((row, y) => parseMaskRow(row, y, `${path}.mask`));
  if (!maskHasConstrainedCell(mask)) {
    fail(`${path}.mask`, "mask has no constrained cells");
  }
  return {
    id: requireString(obj.id, `${path}.id`),
    label: requireString(obj.label, `${path}.label`),
    variantIds,
    mask,
    explanation: requireString(obj.explanation, `${path}.explanation`),
  };
}

function parseSolutionRoute(
  value: unknown,
  index: number,
  parentPath: string,
): SolutionRoute {
  const path = `${parentPath}.solutionRoutes[${index}]`;
  const obj = requireObject(value, path);
  const placementsRaw = requireArray(obj.placements, `${path}.placements`);
  if (placementsRaw.length === 0) {
    fail(`${path}.placements`, "expected at least one placement");
  }
  return {
    id: requireString(obj.id, `${path}.id`),
    label: requireString(obj.label, `${path}.label`),
    variantId: requireString(obj.variantId, `${path}.variantId`),
    outcomeId: requireString(obj.outcomeId, `${path}.outcomeId`),
    placements: placementsRaw.map((p, i) => {
      const pp = `${path}.placements[${i}]`;
      const placementObj = requireObject(p, pp);
      return {
        piece: requirePieceId(placementObj.piece, `${pp}.piece`),
        x: requireNumber(placementObj.x, `${pp}.x`),
        y: requireNumber(placementObj.y, `${pp}.y`),
        rotation: requireRotation(placementObj.rotation, `${pp}.rotation`),
      };
    }),
    explanation: requireString(obj.explanation, `${path}.explanation`),
  };
}

function parseTemptation(
  value: unknown,
  index: number,
  parentPath: string,
): { label: string; explanation: string } {
  const path = `${parentPath}.badTemptations[${index}]`;
  const obj = requireObject(value, path);
  return {
    label: requireString(obj.label, `${path}.label`),
    explanation: requireString(obj.explanation, `${path}.explanation`),
  };
}

function parseDrill(
  value: unknown,
  index: number,
  catalogIds: ReadonlySet<string>,
): DrillV2 {
  const path = `drills[${index}]`;
  const obj = requireObject(value, path);

  const variantsRaw = requireArray(obj.variants, `${path}.variants`);
  if (variantsRaw.length === 0) {
    fail(`${path}.variants`, "expected at least one variant");
  }
  const variants = variantsRaw.map((v, i) => parseVariant(v, i, path));
  const variantIdSet = new Set<string>();
  for (let i = 0; i < variants.length; i++) {
    const id = variants[i].id;
    if (variantIdSet.has(id)) {
      fail(
        `${path}.variants[${i}].id`,
        `duplicate variant id '${id}' within drill`,
      );
    }
    variantIdSet.add(id);
  }

  const outcomesRaw = requireArray(
    obj.acceptedOutcomes,
    `${path}.acceptedOutcomes`,
  );
  if (outcomesRaw.length === 0) {
    fail(`${path}.acceptedOutcomes`, "expected at least one accepted outcome");
  }
  const acceptedOutcomes = outcomesRaw.map((o, i) =>
    parseAcceptedOutcome(o, i, path),
  );
  const outcomeIdSet = new Set<string>();
  for (let i = 0; i < acceptedOutcomes.length; i++) {
    const id = acceptedOutcomes[i].id;
    if (outcomeIdSet.has(id)) {
      fail(
        `${path}.acceptedOutcomes[${i}].id`,
        `duplicate accepted outcome id '${id}' within drill`,
      );
    }
    outcomeIdSet.add(id);
  }
  for (let i = 0; i < acceptedOutcomes.length; i++) {
    const outcome = acceptedOutcomes[i];
    if (outcome.variantIds === undefined) continue;
    for (let j = 0; j < outcome.variantIds.length; j++) {
      const ref = outcome.variantIds[j];
      if (!variantIdSet.has(ref)) {
        fail(
          `${path}.acceptedOutcomes[${i}].variantIds[${j}]`,
          `references unknown variant id '${ref}'`,
        );
      }
    }
  }

  const routesRaw = requireArray(obj.solutionRoutes, `${path}.solutionRoutes`);
  if (routesRaw.length === 0) {
    fail(`${path}.solutionRoutes`, "expected at least one solution route");
  }
  const solutionRoutes = routesRaw.map((r, i) =>
    parseSolutionRoute(r, i, path),
  );
  const routeIdSet = new Set<string>();
  for (let i = 0; i < solutionRoutes.length; i++) {
    const id = solutionRoutes[i].id;
    if (routeIdSet.has(id)) {
      fail(
        `${path}.solutionRoutes[${i}].id`,
        `duplicate solution route id '${id}' within drill`,
      );
    }
    routeIdSet.add(id);
  }
  for (let i = 0; i < solutionRoutes.length; i++) {
    const route = solutionRoutes[i];
    if (!variantIdSet.has(route.variantId)) {
      fail(
        `${path}.solutionRoutes[${i}].variantId`,
        `references unknown variant id '${route.variantId}'`,
      );
    }
    const outcome = acceptedOutcomes.find((o) => o.id === route.outcomeId);
    if (outcome === undefined) {
      fail(
        `${path}.solutionRoutes[${i}].outcomeId`,
        `references unknown accepted outcome id '${route.outcomeId}'`,
      );
    } else if (
      outcome.variantIds !== undefined &&
      !outcome.variantIds.includes(route.variantId)
    ) {
      fail(
        `${path}.solutionRoutes[${i}].variantId`,
        `outcome '${route.outcomeId}' is limited to variants [${outcome.variantIds.join(", ")}], not '${route.variantId}'`,
      );
    }
  }

  const sourceRefsRaw = requireArray(obj.sourceRefs, `${path}.sourceRefs`);
  if (sourceRefsRaw.length === 0) {
    fail(`${path}.sourceRefs`, "expected at least one source ref");
  }
  const sourceRefs = sourceRefsRaw.map((r, i) =>
    parseSourceRef(r, `${path}.sourceRefs[${i}]`),
  );
  for (let i = 0; i < sourceRefs.length; i++) {
    const ref = sourceRefs[i];
    if (!catalogIds.has(ref.catalogId)) {
      fail(
        `${path}.sourceRefs[${i}].catalogId`,
        `references unknown catalog id '${ref.catalogId}'`,
      );
    }
  }

  const badTemptations =
    obj.badTemptations === undefined
      ? undefined
      : requireArray(obj.badTemptations, `${path}.badTemptations`).map((t, i) =>
          parseTemptation(t, i, path),
        );

  return {
    id: requireString(obj.id, `${path}.id`),
    title: requireString(obj.title, `${path}.title`),
    category: requireString(obj.category, `${path}.category`),
    family: requireFamily(obj.family, `${path}.family`),
    tags: parseStringArray(obj.tags, `${path}.tags`),
    sourceRefs,
    difficulty: parseDifficulty(obj.difficulty, `${path}.difficulty`),
    goal: requireString(obj.goal, `${path}.goal`),
    variants,
    acceptedOutcomes,
    solutionRoutes,
    badTemptations,
  };
}

export function loadDrillPackV2(
  input: unknown,
  catalog: SourceCatalog,
): DrillPackV2 {
  const obj = requireObject(input, "root");
  if (obj.version !== 2) {
    fail("root.version", `expected version 2, got ${String(obj.version)}`);
  }
  const drillsRaw = requireArray(obj.drills, "root.drills");
  if (drillsRaw.length === 0) {
    fail("root.drills", "pack must contain at least one drill");
  }
  const catalogIds = new Set(catalog.entries.map((e) => e.id));
  const drills = drillsRaw.map((d, i) => parseDrill(d, i, catalogIds));
  const seenIds = new Map<string, number>();
  for (let i = 0; i < drills.length; i++) {
    const id = drills[i].id;
    const prior = seenIds.get(id);
    if (prior !== undefined) {
      fail(
        `drills[${i}].id`,
        `duplicate drill id '${id}' (also at drills[${prior}])`,
      );
    }
    seenIds.set(id, i);
  }
  return {
    version: 2,
    id: requireString(obj.id, "root.id"),
    title: requireString(obj.title, "root.title"),
    drills,
  };
}
