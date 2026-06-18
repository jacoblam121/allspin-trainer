import type { Keybinds } from "./keybinds.ts";
import type { Handling } from "./handling.ts";
import type { Settings } from "./settings.ts";

// Bundled keybind defaults (plan §9). Physical KeyboardEvent.code values,
// layout-independent. Chord precedence is handled at runtime; this is the
// raw binding table.
export const DEFAULT_KEYBINDS: Keybinds = {
  moveLeft: [{ code: "KeyL" }],
  moveRight: [{ code: "Quote" }],
  softDrop: [{ code: "Semicolon" }],
  hardDrop: [{ code: "Space" }],
  rotateCcw: [{ code: "KeyX" }],
  rotateCw: [{ code: "KeyP" }],
  rotate180: [{ code: "KeyZ" }],
  hold: [{ code: "KeyC" }],
  reset: [{ code: "KeyR" }],
  undo: [{ code: "KeyZ", ctrl: true }, { code: "Backspace" }],
  toggleSolution: [{ code: "KeyH" }],
};

// Bundled handling defaults (plan §13).
//   das: 100    ms held before horizontal auto-repeat begins.
//   arr: 0      instant-to-wall (capped batch every tick after DAS).
//   dcd: 0      direction change repeats resume immediately under DAS/ARR.
//   sdf: Infinity   instant to floor (engine.hardDrop reposition, no lock).
//   gravity: 1  one automatic fall cell per second; 0 disables gravity.
export const DEFAULT_HANDLING: Handling = {
  das: 100,
  arr: 0,
  dcd: 0,
  sdf: Infinity,
  gravity: 1,
};

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  keybinds: DEFAULT_KEYBINDS,
  handling: DEFAULT_HANDLING,
};
