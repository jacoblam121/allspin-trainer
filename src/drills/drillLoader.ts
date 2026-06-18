import { BOARD_WIDTH } from "../engine/constants.ts";
import { isPieceId } from "../engine/pieces.ts";
import type { BoardCell, Drill, DrillPack, RulesetId } from "./drillTypes.ts";

const RULESETS: ReadonlySet<RulesetId> = new Set<RulesetId>(["tetrio-default"]);

function fail(path: string, message: string): never {
  throw new Error(`Invalid drill data at ${path}: ${message}`);
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

function parsePieceId(value: unknown, path: string): Drill["active"] {
  if (!isPieceId(value)) {
    fail(path, `expected piece id, got '${String(value)}'`);
  }
  return value;
}

function parseDrill(value: unknown, index: number): Drill {
  const path = `drills[${index}]`;
  if (typeof value !== "object" || value === null) {
    fail(path, "expected drill object");
  }
  const d = value as Record<string, unknown>;

  const ruleset = d.ruleset;
  if (!RULESETS.has(ruleset as RulesetId)) {
    fail(`${path}.ruleset`, `unsupported ruleset '${String(ruleset)}'`);
  }

  const active = parsePieceId(d.active, `${path}.active`);
  if (d.hold !== null && !isPieceId(d.hold)) {
    fail(`${path}.hold`, `expected piece id or null, got '${String(d.hold)}'`);
  }
  const hold = d.hold as Drill["hold"];

  const queue = requireArray(d.queue, `${path}.queue`).map((p, i) =>
    parsePieceId(p, `${path}.queue[${i}]`),
  );

  const acceptedSolutions = requireArray(
    d.acceptedSolutions,
    `${path}.acceptedSolutions`,
  ).map((sol, i) => {
    const sp = `${path}.acceptedSolutions[${i}]`;
    if (typeof sol !== "object" || sol === null) {
      fail(sp, "expected solution object");
    }
    const s = sol as Record<string, unknown>;
    return {
      id: requireString(s.id, `${sp}.id`),
      label: requireString(s.label, `${sp}.label`),
      placements: requireArray(s.placements, `${sp}.placements`).map(
        (pl, j) => {
          const pp = `${sp}.placements[${j}]`;
          if (typeof pl !== "object" || pl === null) {
            fail(pp, "expected placement object");
          }
          const p = pl as Record<string, unknown>;
          return {
            piece: parsePieceId(p.piece, `${pp}.piece`),
            x: requireNumber(p.x, `${pp}.x`),
            y: requireNumber(p.y, `${pp}.y`),
            rotation: requireRotation(p.rotation, `${pp}.rotation`),
          };
        },
      ),
      explanation: requireString(s.explanation, `${sp}.explanation`),
    };
  });

  const badTemptations =
    d.badTemptations === undefined
      ? undefined
      : requireArray(d.badTemptations, `${path}.badTemptations`).map((t, i) => {
          const tp = `${path}.badTemptations[${i}]`;
          if (typeof t !== "object" || t === null) {
            fail(tp, "expected temptation object");
          }
          const obj = t as Record<string, unknown>;
          return {
            label: requireString(obj.label, `${tp}.label`),
            explanation: requireString(obj.explanation, `${tp}.explanation`),
          };
        });

  return {
    id: requireString(d.id, `${path}.id`),
    title: requireString(d.title, `${path}.title`),
    category: requireString(d.category, `${path}.category`),
    tags: requireArray(d.tags, `${path}.tags`).map((t, i) =>
      requireString(t, `${path}.tags[${i}]`),
    ),
    source:
      d.source === undefined
        ? undefined
        : requireString(d.source, `${path}.source`),
    ruleset: ruleset as RulesetId,
    board: parseBoard(d.board, `${path}.board`),
    active,
    hold,
    queue,
    b2bActive: d.b2bActive === undefined ? undefined : Boolean(d.b2bActive),
    combo: parseCombo(d.combo, `${path}.combo`),
    garbageHoleColumn: parseGarbageHoleColumn(
      d.garbageHoleColumn,
      `${path}.garbageHoleColumn`,
    ),
    goal: requireString(d.goal, `${path}.goal`),
    acceptedSolutions,
    badTemptations,
    fumen:
      d.fumen === undefined
        ? undefined
        : requireString(d.fumen, `${path}.fumen`),
  };
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

function requireRotation(
  value: unknown,
  path: string,
): Drill["acceptedSolutions"][number]["placements"][number]["rotation"] {
  if (value !== "0" && value !== "R" && value !== "2" && value !== "L") {
    fail(path, `expected rotation '0'|'R'|'2'|'L', got '${String(value)}'`);
  }
  return value;
}

function parseGarbageHoleColumn(
  value: unknown,
  path: string,
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const n = requireInteger(value, path);
  if (n < 0 || n > 9) {
    fail(path, `expected integer in 0..9, got ${n}`);
  }
  return n;
}

function parseCombo(value: unknown, path: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const n = requireInteger(value, path);
  if (n < 0) {
    fail(path, `expected non-negative integer, got ${n}`);
  }
  return n;
}

export function loadDrillPack(input: unknown): DrillPack {
  const arr = requireArray(input, "drills");
  return arr.map((d, i) => parseDrill(d, i));
}
