import { describe, it, expect } from "vitest";
import {
  bindingMatches,
  bindingsEqual,
  isChord,
  matchAction,
  normalizeBinding,
  type Keybinds,
} from "./keybinds.ts";
import { DEFAULT_KEYBINDS } from "./defaultSettings.ts";
import { validateSettings } from "./settings.ts";

describe("normalizeBinding", () => {
  it("strips false modifiers and leaves true ones", () => {
    expect(normalizeBinding({ code: "KeyZ", ctrl: false })).toEqual({
      code: "KeyZ",
    });
    expect(normalizeBinding({ code: "KeyZ", ctrl: true })).toEqual({
      code: "KeyZ",
      ctrl: true,
    });
    expect(
      normalizeBinding({
        code: "KeyZ",
        ctrl: true,
        shift: false,
        alt: false,
        meta: false,
      }),
    ).toEqual({ code: "KeyZ", ctrl: true });
  });
});

describe("isChord", () => {
  it("is false for plain bindings and true for chord bindings", () => {
    expect(isChord({ code: "KeyZ" })).toBe(false);
    expect(isChord({ code: "KeyZ", ctrl: false })).toBe(false);
    expect(isChord({ code: "KeyZ", ctrl: true })).toBe(true);
    expect(isChord({ code: "KeyZ", shift: true })).toBe(true);
  });
});

describe("bindingsEqual", () => {
  it("treats false and absent modifiers as equivalent", () => {
    expect(bindingsEqual({ code: "KeyZ" }, { code: "KeyZ", ctrl: false })).toBe(
      true,
    );
    expect(
      bindingsEqual({ code: "KeyZ", ctrl: true }, { code: "KeyZ", ctrl: true }),
    ).toBe(true);
    expect(
      bindingsEqual(
        { code: "KeyZ", ctrl: true },
        { code: "KeyZ", ctrl: false },
      ),
    ).toBe(false);
  });
  it("distinguishes codes", () => {
    expect(bindingsEqual({ code: "KeyA" }, { code: "KeyB" })).toBe(false);
  });
  it("distinguishes modifier sets on the same code", () => {
    expect(
      bindingsEqual(
        { code: "KeyZ", ctrl: true },
        { code: "KeyZ", ctrl: true, shift: true },
      ),
    ).toBe(false);
  });
});

describe("bindingMatches (exact modifier set)", () => {
  it("plain binding matches when no modifiers are set in the event", () => {
    expect(bindingMatches({ code: "KeyZ" }, "KeyZ", {})).toBe(true);
    expect(bindingMatches({ code: "KeyZ" }, "KeyZ", { ctrl: false })).toBe(
      true,
    );
  });

  it("plain binding does NOT match when any modifier is set", () => {
    expect(bindingMatches({ code: "KeyZ" }, "KeyZ", { ctrl: true })).toBe(
      false,
    );
  });

  it("chord binding matches when event's modifier set exactly equals the chord", () => {
    expect(
      bindingMatches({ code: "KeyZ", ctrl: true }, "KeyZ", { ctrl: true }),
    ).toBe(true);
  });

  it("chord binding does NOT match when the event has an extra modifier (extra disqualifies)", () => {
    expect(
      bindingMatches({ code: "KeyZ", ctrl: true }, "KeyZ", {
        ctrl: true,
        shift: true,
      }),
    ).toBe(false);
  });

  it("chord binding does NOT match when the event is missing a modifier", () => {
    expect(
      bindingMatches({ code: "KeyZ", ctrl: true, shift: true }, "KeyZ", {
        ctrl: true,
      }),
    ).toBe(false);
  });

  it("code must match", () => {
    expect(bindingMatches({ code: "KeyA" }, "KeyB", {})).toBe(false);
  });
});

describe("matchAction (chord precedence)", () => {
  it("plain binding fires when no chord matches (no modifiers in event)", () => {
    const kb: Keybinds = {
      ...DEFAULT_KEYBINDS,
      rotate180: [{ code: "KeyZ" }],
    };
    expect(matchAction(kb, "KeyZ", {})).toBe("rotate180");
  });

  it("chord binding (Ctrl+KeyZ) fires undo and suppresses plain KeyZ (rotate180)", () => {
    // DEFAULT_KEYBINDS already has this: rotate180:[KeyZ], undo:[Ctrl+KeyZ,...]
    expect(matchAction(DEFAULT_KEYBINDS, "KeyZ", { ctrl: true })).toBe("undo");
    expect(matchAction(DEFAULT_KEYBINDS, "KeyZ", {})).toBe("rotate180");
  });

  it("Ctrl+Shift+KeyZ (extra modifier) does NOT match Ctrl+KeyZ chord", () => {
    // No plain binding for KeyZ+Ctrl+Shift either; result is null.
    expect(
      matchAction(DEFAULT_KEYBINDS, "KeyZ", { ctrl: true, shift: true }),
    ).toBe(null);
  });

  it("multiple bindings per action: each fires independently", () => {
    const kb: Keybinds = {
      ...DEFAULT_KEYBINDS,
      moveLeft: [{ code: "KeyL" }, { code: "ArrowLeft" }],
    };
    expect(matchAction(kb, "KeyL", {})).toBe("moveLeft");
    expect(matchAction(kb, "ArrowLeft", {})).toBe("moveLeft");
  });

  it("returns null when no binding matches the event", () => {
    expect(matchAction(DEFAULT_KEYBINDS, "KeyQ", {})).toBe(null);
  });
});

describe("validateSettings cross-action duplicate policy", () => {
  it("rejects settings where two different actions share a normalized binding", () => {
    const stored = {
      version: 1 as const,
      keybinds: {
        ...DEFAULT_KEYBINDS,
        // Re-bind moveLeft's KeyL to rotateCw — conflicts with default moveLeft.
        rotateCw: [{ code: "KeyL" }],
      },
      handling: { das: 100, arr: 0, dcd: 0, sdf: Infinity, gravity: 1 },
    };
    expect(validateSettings(stored)).toBe(null);
  });

  it("dedupes exact duplicates within a single action", () => {
    const stored = {
      version: 1 as const,
      keybinds: {
        ...DEFAULT_KEYBINDS,
        moveLeft: [{ code: "KeyL" }, { code: "KeyL" }],
      },
      handling: { das: 100, arr: 0, dcd: 0, sdf: Infinity, gravity: 1 },
    };
    const validated = validateSettings(stored);
    expect(validated).not.toBe(null);
    expect(validated?.keybinds.moveLeft).toEqual([{ code: "KeyL" }]);
  });

  it("plain and chord on the same code on different actions are NOT duplicates (chord precedence handles them)", () => {
    // Defaults already do this: rotate180:[KeyZ], undo:[Ctrl+KeyZ, Backspace].
    const full = {
      version: 1 as const,
      keybinds: DEFAULT_KEYBINDS,
      handling: { das: 100, arr: 0, dcd: 0, sdf: Infinity, gravity: 1 },
    };
    const v = validateSettings(full);
    expect(v).not.toBe(null);
    expect(v?.keybinds.rotate180).toEqual([{ code: "KeyZ" }]);
    expect(v?.keybinds.undo).toEqual([
      { code: "KeyZ", ctrl: true },
      { code: "Backspace" },
    ]);
  });
});
