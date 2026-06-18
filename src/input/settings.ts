// Settings persistence (plan §10).
//
// In-memory shape: Settings = { version: 1, keybinds, handling } where
// handling.sdf is a number (Infinity allowed).
//
// Persisted shape: JSON with handling.sdf as the string "infinity" when the
// in-memory value is Infinity (because JSON.stringify(Infinity) === "null").
// saveSettings maps Infinity -> "infinity" before stringifying; loadSettings
// maps "infinity" -> Infinity after parsing. This is the only field whose
// serialized form differs from its in-memory form.
//
// localStorage key: "allspin.settings.v1".
//
// Load strategy:
//   1. Absent / parse error / version mismatch -> DEFAULT_SETTINGS.
//   2. Light field-merge: start from DEFAULT_SETTINGS, override per-key
//      (keybinds[action]) and per-field (handling.*) when the stored value
//      is structurally valid. Missing / invalid fields fall back to defaults.
//   3. Post-merge cross-action duplicate check: if the merged keybinds have
//      a duplicate normalized binding across two different actions, discard
//      all stored keybinds and keep DEFAULT_SETTINGS.keybinds. Handling merge
//      is unaffected.

import {
  ACTIONS,
  type Action,
  type Binding,
  type Keybinds,
  normalizeBinding,
} from "./keybinds.ts";
import type { Handling } from "./handling.ts";
import { isGravity, isNonNegInt, isSdf } from "./handling.ts";
import {
  DEFAULT_KEYBINDS,
  DEFAULT_HANDLING,
  DEFAULT_SETTINGS,
} from "./defaultSettings.ts";

export const SETTINGS_STORAGE_KEY = "allspin.settings.v1";

export type Settings = {
  version: 1;
  keybinds: Keybinds;
  handling: Handling;
};

// Storage-like interface for testability (no hard dependency on localStorage).
export type SettingsStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const MODIFIER_KEYS = ["ctrl", "shift", "alt", "meta"] as const;
type ModifierKey = (typeof MODIFIER_KEYS)[number];

function bindingKey(b: Binding): string {
  let k = b.code;
  if (b.ctrl === true) k += "|ctrl";
  if (b.shift === true) k += "|shift";
  if (b.alt === true) k += "|alt";
  if (b.meta === true) k += "|meta";
  return k;
}

function hasCrossActionDuplicate(keybinds: Keybinds): boolean {
  const seen: Map<string, Action> = new Map();
  for (const action of ACTIONS) {
    for (const binding of keybinds[action]) {
      const norm = normalizeBinding(binding);
      const key = bindingKey(norm);
      const existing = seen.get(key);
      if (existing !== undefined && existing !== action) {
        return true;
      }
      seen.set(key, action);
    }
  }
  return false;
}

function dedupeBindings(bindings: Binding[]): Binding[] {
  const seen = new Set<string>();
  const out: Binding[] = [];
  for (const b of bindings) {
    const norm = normalizeBinding(b);
    const key = bindingKey(norm);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(norm);
  }
  return out;
}

function parseBindingArray(arr: unknown): Binding[] | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const out: Binding[] = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) return null;
    const b = item as Record<string, unknown>;
    if (typeof b.code !== "string" || b.code === "") return null;
    const outB: Binding = { code: b.code };
    let validMods = true;
    for (const mk of MODIFIER_KEYS) {
      if (mk in b) {
        if (typeof b[mk] !== "boolean") {
          validMods = false;
          break;
        }
        if (b[mk] === true) {
          (outB as Record<ModifierKey, boolean>)[mk] = true;
        }
      }
    }
    if (!validMods) return null;
    out.push(outB);
  }
  return out;
}

// Validate an in-memory Settings value. Returns the normalized Settings
// (false / absent modifiers stripped; within-action duplicates deduped) or
// null on any structural problem. This is the in-memory validator; the
// "infinity" string is NOT accepted here (loadSettings normalizes it to
// Infinity before validation).
export function validateSettings(input: unknown): Settings | null {
  if (typeof input !== "object" || input === null) return null;
  const s = input as Record<string, unknown>;
  if (s.version !== 1) return null;
  if (typeof s.keybinds !== "object" || s.keybinds === null) return null;
  if (typeof s.handling !== "object" || s.handling === null) return null;

  const storedKeybinds = s.keybinds as Record<string, unknown>;
  const keybinds: Record<string, Binding[]> = {};
  for (const action of ACTIONS) {
    const parsed = parseBindingArray(storedKeybinds[action]);
    if (parsed === null) return null;
    keybinds[action] = dedupeBindings(parsed);
  }
  const keybindsTyped = keybinds as unknown as Keybinds;
  if (hasCrossActionDuplicate(keybindsTyped)) return null;

  const h = s.handling as Record<string, unknown>;
  if (!isNonNegInt(h.das)) return null;
  if (!isNonNegInt(h.arr)) return null;
  if (!isNonNegInt(h.dcd)) return null;
  if (!isSdf(h.sdf)) return null;
  if (!isGravity(h.gravity)) return null;

  return {
    version: 1,
    keybinds: keybindsTyped,
    handling: {
      das: h.das,
      arr: h.arr,
      dcd: h.dcd,
      sdf: h.sdf,
      gravity: h.gravity,
    },
  };
}

// Map the serialized SDF representation back to the in-memory number.
//   "infinity" -> Infinity
//   finite positive number -> as-is
//   null / anything else -> null (caller falls back to the default).
type NormalizedSdf = number | null;

function normalizeSdf(value: unknown): NormalizedSdf {
  if (typeof value === "string" && value === "infinity") {
    return Infinity;
  }
  if (typeof value === "number" && isSdf(value)) {
    return value;
  }
  return null;
}

function loadMerged(stored: unknown): Settings {
  // Light field-merge from defaults.
  const merged: Settings = {
    version: 1,
    keybinds: {
      moveLeft: [...DEFAULT_KEYBINDS.moveLeft],
      moveRight: [...DEFAULT_KEYBINDS.moveRight],
      softDrop: [...DEFAULT_KEYBINDS.softDrop],
      hardDrop: [...DEFAULT_KEYBINDS.hardDrop],
      rotateCw: [...DEFAULT_KEYBINDS.rotateCw],
      rotateCcw: [...DEFAULT_KEYBINDS.rotateCcw],
      rotate180: [...DEFAULT_KEYBINDS.rotate180],
      hold: [...DEFAULT_KEYBINDS.hold],
      reset: [...DEFAULT_KEYBINDS.reset],
      undo: [...DEFAULT_KEYBINDS.undo],
      toggleSolution: [...DEFAULT_KEYBINDS.toggleSolution],
    },
    handling: { ...DEFAULT_HANDLING },
  };

  if (typeof stored !== "object" || stored === null) {
    return merged;
  }
  const s = stored as Record<string, unknown>;

  // Keybinds: per-action override when structurally valid.
  if (typeof s.keybinds === "object" && s.keybinds !== null) {
    const storedKeybinds = s.keybinds as Record<string, unknown>;
    for (const action of ACTIONS) {
      const parsed = parseBindingArray(storedKeybinds[action]);
      if (parsed !== null) {
        merged.keybinds[action] = dedupeBindings(parsed);
      }
    }
  }

  // Handling: per-field override when structurally valid; SDF normalized.
  if (typeof s.handling === "object" && s.handling !== null) {
    const h = s.handling as Record<string, unknown>;
    if (isNonNegInt(h.das)) merged.handling.das = h.das;
    if (isNonNegInt(h.arr)) merged.handling.arr = h.arr;
    if (isNonNegInt(h.dcd)) merged.handling.dcd = h.dcd;
    const sdf = normalizeSdf(h.sdf);
    if (sdf !== null) merged.handling.sdf = sdf;
    if (isGravity(h.gravity)) merged.handling.gravity = h.gravity;
  }

  // Post-merge cross-action duplicate: discard all stored keybinds if any
  // duplicate exists in the merged result. Handling is unaffected.
  if (hasCrossActionDuplicate(merged.keybinds)) {
    merged.keybinds = {
      moveLeft: [...DEFAULT_KEYBINDS.moveLeft],
      moveRight: [...DEFAULT_KEYBINDS.moveRight],
      softDrop: [...DEFAULT_KEYBINDS.softDrop],
      hardDrop: [...DEFAULT_KEYBINDS.hardDrop],
      rotateCw: [...DEFAULT_KEYBINDS.rotateCw],
      rotateCcw: [...DEFAULT_KEYBINDS.rotateCcw],
      rotate180: [...DEFAULT_KEYBINDS.rotate180],
      hold: [...DEFAULT_KEYBINDS.hold],
      reset: [...DEFAULT_KEYBINDS.reset],
      undo: [...DEFAULT_KEYBINDS.undo],
      toggleSolution: [...DEFAULT_KEYBINDS.toggleSolution],
    };
  }

  return merged;
}

export function loadSettings(storage: SettingsStorage): Settings {
  const raw = storage.getItem(SETTINGS_STORAGE_KEY);
  if (raw === null) return DEFAULT_SETTINGS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_SETTINGS;
  }
  if (typeof parsed !== "object" || parsed === null) return DEFAULT_SETTINGS;
  const obj = parsed as Record<string, unknown>;
  if (obj.version !== 1) return DEFAULT_SETTINGS;
  return loadMerged(parsed);
}

// Serialized form: handling.sdf is the string "infinity" when in-memory is
// Infinity; finite positive numbers stay as numbers.
function serializeSdf(sdf: number): number | "infinity" {
  if (sdf === Infinity) return "infinity";
  return sdf;
}

export function saveSettings(
  storage: SettingsStorage,
  settings: Settings,
): void {
  const serialized = {
    version: 1 as const,
    keybinds: settings.keybinds,
    handling: {
      das: settings.handling.das,
      arr: settings.handling.arr,
      dcd: settings.handling.dcd,
      sdf: serializeSdf(settings.handling.sdf),
      gravity: settings.handling.gravity,
    },
  };
  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(serialized));
}
