import { describe, it, expect } from "vitest";
import {
  loadSettings,
  saveSettings,
  validateSettings,
  SETTINGS_STORAGE_KEY,
  type Settings,
  type SettingsStorage,
} from "./settings.ts";
import {
  DEFAULT_KEYBINDS,
  DEFAULT_HANDLING,
  DEFAULT_SETTINGS,
} from "./defaultSettings.ts";
import { isChord } from "./keybinds.ts";

function inMemoryStorage(): SettingsStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem(key) {
      return data.has(key) ? (data.get(key) as string) : null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
  };
}

describe("loadSettings (plan §10)", () => {
  it("returns defaults when storage is empty", () => {
    const s = inMemoryStorage();
    const loaded = loadSettings(s);
    expect(loaded).toEqual(DEFAULT_SETTINGS);
  });

  it("valid v1 parses and overrides defaults via light field-merge", () => {
    const s = inMemoryStorage();
    s.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        keybinds: { ...DEFAULT_KEYBINDS, moveLeft: [{ code: "ArrowLeft" }] },
        handling: { das: 200, arr: 33, dcd: 50, sdf: 20, gravity: 0.5 },
      }),
    );
    const loaded = loadSettings(s);
    expect(loaded.keybinds.moveLeft).toEqual([{ code: "ArrowLeft" }]);
    expect(loaded.keybinds.moveRight).toEqual(DEFAULT_KEYBINDS.moveRight);
    expect(loaded.handling).toEqual({
      das: 200,
      arr: 33,
      dcd: 50,
      sdf: 20,
      gravity: 0.5,
    });
  });

  it("returns defaults on corrupt JSON", () => {
    const s = inMemoryStorage();
    s.setItem(SETTINGS_STORAGE_KEY, "{ not valid json");
    const loaded = loadSettings(s);
    expect(loaded).toEqual(DEFAULT_SETTINGS);
  });

  it("returns defaults on version mismatch", () => {
    const s = inMemoryStorage();
    s.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ version: 2, keybinds: {}, handling: {} }),
    );
    const loaded = loadSettings(s);
    expect(loaded).toEqual(DEFAULT_SETTINGS);
  });

  it("missing / invalid keybinds field uses default keybinds (merge fills per-field)", () => {
    const s = inMemoryStorage();
    s.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        // No keybinds at all.
        handling: { das: 150, arr: 0, dcd: 0, sdf: 40, gravity: 10 },
      }),
    );
    const loaded = loadSettings(s);
    expect(loaded.keybinds).toEqual(DEFAULT_KEYBINDS);
    expect(loaded.handling.das).toBe(150);
    expect(loaded.handling.sdf).toBe(40);
    expect(loaded.handling.gravity).toBe(10);
  });

  it("missing / invalid handling field uses default handling", () => {
    const s = inMemoryStorage();
    s.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        keybinds: { ...DEFAULT_KEYBINDS, moveLeft: [{ code: "KeyA" }] },
        // No handling.
      }),
    );
    const loaded = loadSettings(s);
    expect(loaded.keybinds.moveLeft).toEqual([{ code: "KeyA" }]);
    expect(loaded.handling).toEqual(DEFAULT_HANDLING);
  });

  it("stored settings with only handling.das set merges per-field", () => {
    const s = inMemoryStorage();
    s.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        keybinds: DEFAULT_KEYBINDS,
        handling: { das: 250 }, // arr/dcd/sdf/gravity missing -> defaults
      }),
    );
    const loaded = loadSettings(s);
    expect(loaded.handling.das).toBe(250);
    expect(loaded.handling.arr).toBe(DEFAULT_HANDLING.arr);
    expect(loaded.handling.dcd).toBe(DEFAULT_HANDLING.dcd);
    expect(loaded.handling.sdf).toBe(DEFAULT_HANDLING.sdf);
    expect(loaded.handling.gravity).toBe(DEFAULT_HANDLING.gravity);
    expect(loaded.keybinds).toEqual(DEFAULT_KEYBINDS);
  });

  it("post-merge cross-action duplicate discards stored keybinds wholesale; handling merge is unaffected", () => {
    const s = inMemoryStorage();
    s.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        keybinds: {
          ...DEFAULT_KEYBINDS,
          // Stored rotateCw:KeyL conflicts with default moveLeft:KeyL.
          rotateCw: [{ code: "KeyL" }],
        },
        handling: { das: 200, arr: 33, dcd: 50, sdf: 20, gravity: 40 },
      }),
    );
    const loaded = loadSettings(s);
    // All stored keybinds discarded.
    expect(loaded.keybinds).toEqual(DEFAULT_KEYBINDS);
    expect(loaded.keybinds.rotateCw).toEqual(DEFAULT_KEYBINDS.rotateCw);
    // Handling merge is unaffected.
    expect(loaded.handling).toEqual({
      das: 200,
      arr: 33,
      dcd: 50,
      sdf: 20,
      gravity: 40,
    });
  });

  it("no false positive on non-conflicting merge", () => {
    const s = inMemoryStorage();
    s.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        keybinds: {
          ...DEFAULT_KEYBINDS,
          rotateCw: [{ code: "KeyQ" }], // KeyQ is unbound by default
        },
        handling: { das: 100, arr: 0, dcd: 0, sdf: Infinity, gravity: 1 },
      }),
    );
    const loaded = loadSettings(s);
    expect(loaded.keybinds.rotateCw).toEqual([{ code: "KeyQ" }]);
    expect(loaded.keybinds.moveLeft).toEqual(DEFAULT_KEYBINDS.moveLeft);
  });
});

describe("saveSettings + loadSettings SDF round-trip (plan §10)", () => {
  it("serializes Infinity SDF as the string 'infinity' and reads it back", () => {
    const s = inMemoryStorage();
    const settings: Settings = {
      version: 1,
      keybinds: DEFAULT_KEYBINDS,
      handling: { das: 100, arr: 0, dcd: 0, sdf: Infinity, gravity: 1 },
    };
    saveSettings(s, settings);
    const raw = s.getItem(SETTINGS_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.handling.sdf).toBe("infinity");
    const loaded = loadSettings(s);
    expect(loaded.handling.sdf).toBe(Infinity);
  });

  it("a finite positive SDF round-trips as the number", () => {
    const s = inMemoryStorage();
    const settings: Settings = {
      version: 1,
      keybinds: DEFAULT_KEYBINDS,
      handling: { das: 100, arr: 0, dcd: 0, sdf: 40, gravity: 12.5 },
    };
    saveSettings(s, settings);
    const raw = s.getItem(SETTINGS_STORAGE_KEY);
    const parsed = JSON.parse(raw as string);
    expect(parsed.handling.sdf).toBe(40);
    expect(parsed.handling.gravity).toBe(12.5);
    const loaded = loadSettings(s);
    expect(loaded.handling.sdf).toBe(40);
    expect(loaded.handling.gravity).toBe(12.5);
  });

  it("a stored sdf of null (e.g. from a prior build) falls back to the default via field-merge", () => {
    const s = inMemoryStorage();
    s.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        keybinds: DEFAULT_KEYBINDS,
        handling: { das: 100, arr: 0, dcd: 0, sdf: null, gravity: "fast" },
      }),
    );
    const loaded = loadSettings(s);
    expect(loaded.handling.sdf).toBe(DEFAULT_HANDLING.sdf);
    expect(loaded.handling.gravity).toBe(DEFAULT_HANDLING.gravity);
  });
});

describe("validateSettings (plan §10)", () => {
  it("rejects wrong version", () => {
    expect(validateSettings({ version: 2, keybinds: {}, handling: {} })).toBe(
      null,
    );
  });

  it("rejects missing action", () => {
    const stored = {
      version: 1 as const,
      // missing moveRight
      keybinds: { ...DEFAULT_KEYBINDS, moveRight: [] },
      handling: DEFAULT_HANDLING,
    };
    expect(validateSettings(stored)).toBe(null);
  });

  it("rejects empty binding array", () => {
    const stored = {
      version: 1 as const,
      keybinds: { ...DEFAULT_KEYBINDS, moveLeft: [] },
      handling: DEFAULT_HANDLING,
    };
    expect(validateSettings(stored)).toBe(null);
  });

  it("rejects empty code", () => {
    const stored = {
      version: 1 as const,
      keybinds: { ...DEFAULT_KEYBINDS, moveLeft: [{ code: "" }] },
      handling: DEFAULT_HANDLING,
    };
    expect(validateSettings(stored)).toBe(null);
  });

  it("rejects negative / non-integer das / arr / dcd", () => {
    const neg = {
      version: 1 as const,
      keybinds: DEFAULT_KEYBINDS,
      handling: { das: -10, arr: 0, dcd: 0, sdf: Infinity, gravity: 1 },
    };
    expect(validateSettings(neg)).toBe(null);
    const fp = {
      version: 1 as const,
      keybinds: DEFAULT_KEYBINDS,
      handling: { das: 100.5, arr: 0, dcd: 0, sdf: Infinity, gravity: 1 },
    };
    expect(validateSettings(fp)).toBe(null);
  });

  it("rejects non-positive sdf (Infinity accepted; finite non-positive rejected)", () => {
    const zero = {
      version: 1 as const,
      keybinds: DEFAULT_KEYBINDS,
      handling: { das: 100, arr: 0, dcd: 0, sdf: 0, gravity: 1 },
    };
    expect(validateSettings(zero)).toBe(null);
    const neg = {
      version: 1 as const,
      keybinds: DEFAULT_KEYBINDS,
      handling: { das: 100, arr: 0, dcd: 0, sdf: -5, gravity: 1 },
    };
    expect(validateSettings(neg)).toBe(null);
  });

  it("accepts sdf:Infinity, arr:0, dcd:0, gravity bounds/decimals, and chord binding { code, ctrl:true }", () => {
    // Use a fresh, unconflicted code (BracketLeft + Ctrl). Defaults don't bind
    // BracketLeft, so this is a new binding and won't cross-conflict with
    // any other action.
    const stored = {
      version: 1 as const,
      keybinds: {
        ...DEFAULT_KEYBINDS,
        moveLeft: [{ code: "BracketLeft", ctrl: true }],
      },
      handling: { das: 100, arr: 0, dcd: 0, sdf: Infinity, gravity: 0.5 },
    };
    const v = validateSettings(stored);
    expect(v).not.toBe(null);
    expect(v?.handling.sdf).toBe(Infinity);
    expect(v?.handling.arr).toBe(0);
    expect(v?.handling.dcd).toBe(0);
    expect(v?.handling.gravity).toBe(0.5);
    expect(v?.keybinds.moveLeft).toEqual([{ code: "BracketLeft", ctrl: true }]);
    expect(isChord(v!.keybinds.moveLeft[0])).toBe(true);
  });

  it("rejects non-boolean modifier", () => {
    const stored = {
      version: 1 as const,
      keybinds: {
        ...DEFAULT_KEYBINDS,
        moveLeft: [{ code: "KeyZ", ctrl: "true" }],
      },
      handling: DEFAULT_HANDLING,
    };
    expect(validateSettings(stored)).toBe(null);
  });

  it("accepts gravity at 0, 1, and 40", () => {
    for (const gravity of [0, 1, 40]) {
      expect(
        validateSettings({
          version: 1 as const,
          keybinds: DEFAULT_KEYBINDS,
          handling: { ...DEFAULT_HANDLING, gravity },
        })?.handling.gravity,
      ).toBe(gravity);
    }
  });

  it("rejects invalid gravity values", () => {
    for (const gravity of [-0.1, 40.1, Infinity, NaN, "1", null]) {
      expect(
        validateSettings({
          version: 1 as const,
          keybinds: DEFAULT_KEYBINDS,
          handling: { ...DEFAULT_HANDLING, gravity },
        }),
      ).toBe(null);
    }
  });
});
