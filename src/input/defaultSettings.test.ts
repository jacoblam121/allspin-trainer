import { describe, it, expect } from "vitest";
import {
  DEFAULT_SETTINGS,
  DEFAULT_KEYBINDS,
  DEFAULT_HANDLING,
} from "./defaultSettings.ts";
import { ACTIONS } from "./keybinds.ts";

describe("DEFAULT_KEYBINDS (plan §9)", () => {
  it("binds every action with at least one binding", () => {
    for (const action of ACTIONS) {
      expect(DEFAULT_KEYBINDS[action].length).toBeGreaterThan(0);
    }
  });

  it("binds the expected default physical codes", () => {
    expect(DEFAULT_KEYBINDS.moveLeft).toEqual([{ code: "KeyL" }]);
    expect(DEFAULT_KEYBINDS.moveRight).toEqual([{ code: "Quote" }]);
    expect(DEFAULT_KEYBINDS.softDrop).toEqual([{ code: "Semicolon" }]);
    expect(DEFAULT_KEYBINDS.hardDrop).toEqual([{ code: "Space" }]);
    expect(DEFAULT_KEYBINDS.rotateCcw).toEqual([{ code: "KeyX" }]);
    expect(DEFAULT_KEYBINDS.rotateCw).toEqual([{ code: "KeyP" }]);
    expect(DEFAULT_KEYBINDS.rotate180).toEqual([{ code: "KeyZ" }]);
    expect(DEFAULT_KEYBINDS.hold).toEqual([{ code: "KeyC" }]);
    expect(DEFAULT_KEYBINDS.reset).toEqual([{ code: "KeyR" }]);
    expect(DEFAULT_KEYBINDS.undo).toEqual([
      { code: "KeyZ", ctrl: true },
      { code: "Backspace" },
    ]);
    expect(DEFAULT_KEYBINDS.toggleSolution).toEqual([{ code: "KeyH" }]);
  });
});

describe("DEFAULT_HANDLING (plan §13)", () => {
  it("uses das 100, arr 0, dcd 0, sdf Infinity, and gravity 1", () => {
    expect(DEFAULT_HANDLING).toEqual({
      das: 100,
      arr: 0,
      dcd: 0,
      sdf: Infinity,
      gravity: 1,
    });
  });
});

describe("DEFAULT_SETTINGS", () => {
  it("is version 1 and wires the defaults together", () => {
    expect(DEFAULT_SETTINGS.version).toBe(1);
    expect(DEFAULT_SETTINGS.keybinds).toBe(DEFAULT_KEYBINDS);
    expect(DEFAULT_SETTINGS.handling).toBe(DEFAULT_HANDLING);
  });
});
