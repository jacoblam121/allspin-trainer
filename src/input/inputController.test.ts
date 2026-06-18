import { describe, it, expect } from "vitest";
import { InputController, type Intent } from "./inputController.ts";
import { DEFAULT_HANDLING, DEFAULT_KEYBINDS } from "./defaultSettings.ts";
import type { Settings } from "./settings.ts";
import type { Keybinds } from "./keybinds.ts";
import type { Handling } from "./handling.ts";
import { BOARD_WIDTH } from "../engine/constants.ts";

function makeSettings(
  overrides: {
    keybinds?: Partial<Keybinds>;
    handling?: Partial<Handling>;
  } = {},
): Settings {
  return {
    version: 1,
    keybinds: { ...DEFAULT_KEYBINDS, ...overrides.keybinds },
    handling: { ...DEFAULT_HANDLING, ...overrides.handling },
  };
}

function kinds(intents: Intent[]): Intent["kind"][] {
  return intents.map((i) => i.kind);
}

describe("InputController: one-shot edge actions", () => {
  it("rotateCw / rotateCcw / rotate180 / hardDrop / hold / reset / undo / toggleSolution fire once on press edge", () => {
    const c = new InputController(makeSettings());

    expect(c.press("KeyX", {})).toEqual([{ kind: "rotateCcw" }]);
    expect(c.press("KeyP", {})).toEqual([{ kind: "rotateCw" }]);
    expect(c.press("KeyZ", {})).toEqual([{ kind: "rotate180" }]);
    expect(c.press("Space", {})).toEqual([{ kind: "hardDrop" }]);
    expect(c.press("KeyC", {})).toEqual([{ kind: "hold" }]);
    expect(c.press("KeyR", {})).toEqual([{ kind: "reset" }]);
    expect(c.press("Backspace", {})).toEqual([{ kind: "undo" }]);
    expect(c.press("KeyH", {})).toEqual([{ kind: "toggleSolution" }]);
  });

  it("chord Ctrl+KeyZ fires undo and does NOT fire rotate180 (chord precedence)", () => {
    const c = new InputController(makeSettings());
    expect(c.press("KeyZ", { ctrl: true })).toEqual([{ kind: "undo" }]);
  });

  it("native auto-repeat: a second press for an already-down plain code is suppressed", () => {
    const c = new InputController(makeSettings());
    expect(c.press("KeyC", {})).toEqual([{ kind: "hold" }]);
    // Same code, no release in between: auto-repeat suppressed.
    expect(c.press("KeyC", {})).toEqual([]);
    // After release, a fresh press fires again.
    c.release("KeyC", {});
    expect(c.press("KeyC", {})).toEqual([{ kind: "hold" }]);
  });

  it("native auto-repeat for chord: same chord re-press is suppressed", () => {
    const c = new InputController(makeSettings());
    expect(c.press("KeyZ", { ctrl: true })).toEqual([{ kind: "undo" }]);
    expect(c.press("KeyZ", { ctrl: true })).toEqual([]);
  });

  it("native auto-repeat is suppressed even if modifier flags change while the key is held", () => {
    const c = new InputController(makeSettings());
    expect(c.press("KeyZ", { ctrl: true })).toEqual([{ kind: "undo" }]);
    expect(c.press("KeyZ", {})).toEqual([]);

    c.release("KeyZ", {});
    expect(c.press("KeyZ", {})).toEqual([{ kind: "rotate180" }]);
  });

  it("releases a chord even if modifiers were released before the key", () => {
    const c = new InputController(makeSettings());
    expect(c.press("KeyZ", { ctrl: true })).toEqual([{ kind: "undo" }]);

    // Browser keyup modifier flags reflect the current keyboard state. If
    // Ctrl is released before Z, the KeyZ keyup arrives as plain KeyZ; the
    // controller must still clear the original Ctrl+KeyZ physical press.
    expect(c.release("KeyZ", {})).toEqual([]);
    expect(c.press("KeyZ", { ctrl: true })).toEqual([{ kind: "undo" }]);
  });

  it("a press that doesn't match any keybind returns []", () => {
    const c = new InputController(makeSettings());
    expect(c.press("KeyQ", {})).toEqual([]);
  });

  it("a release of a key that isn't pressed is a no-op", () => {
    const c = new InputController(makeSettings());
    expect(c.release("KeyQ", {})).toEqual([]);
  });
});

describe("InputController: horizontal movement (moveLeft)", () => {
  it("emits one immediate move on press; no repeat before DAS; first repeat when DAS elapses; subsequent ARR", () => {
    const c = new InputController(
      makeSettings({ handling: { das: 100, arr: 30, dcd: 0, sdf: 20 } }),
    );
    // Press -> immediate move.
    expect(c.press("KeyL", {})).toEqual([{ kind: "moveLeft" }]);
    // Tick 50ms (within DAS, no repeat).
    expect(c.tick(50)).toEqual([]);
    // Tick 60ms (DAS just elapsed, leftover 10ms). arr=30 > 10, no repeat yet.
    expect(c.tick(60)).toEqual([]);
    // Tick 30ms (arr 30 reached). Emit one.
    expect(c.tick(30)).toEqual([{ kind: "moveLeft" }]);
    // Tick 30ms -> another.
    expect(c.tick(30)).toEqual([{ kind: "moveLeft" }]);
  });

  it("moveRight behaves the same as moveLeft", () => {
    const c = new InputController(
      makeSettings({ handling: { das: 100, arr: 30, dcd: 0, sdf: 20 } }),
    );
    expect(c.press("Quote", {})).toEqual([{ kind: "moveRight" }]);
    expect(c.tick(130)).toEqual([{ kind: "moveRight" }]);
  });
});

describe("InputController: ARR = 0 instant-to-wall (capped batch per tick)", () => {
  it("emits a capped batch of BOARD_WIDTH moves on every tick post-DAS", () => {
    const c = new InputController(
      makeSettings({ handling: { das: 50, arr: 0, dcd: 0, sdf: 20 } }),
    );
    expect(c.press("KeyL", {})).toEqual([{ kind: "moveLeft" }]);
    // Tick 30ms (DAS not yet met).
    expect(c.tick(30)).toEqual([]);
    // Tick 30ms (DAS elapses, thresholdMet). arr=0: emit BOARD_WIDTH batch.
    const batch1 = c.tick(30);
    expect(batch1).toEqual(
      Array.from({ length: BOARD_WIDTH }, () => ({
        kind: "moveLeft" as const,
      })),
    );
    // Second tick post-DAS: another batch (controller is stateless about wall).
    const batch2 = c.tick(16);
    expect(batch2).toEqual(
      Array.from({ length: BOARD_WIDTH }, () => ({
        kind: "moveLeft" as const,
      })),
    );
  });
});

describe("InputController: L/R conflict (most-recent-pressed-wins)", () => {
  it("press L then R: R wins; release R: L resumes with DAS resumed (not restarted)", () => {
    const c = new InputController(
      makeSettings({ handling: { das: 100, arr: 30, dcd: 0, sdf: 20 } }),
    );
    expect(c.press("KeyL", {})).toEqual([{ kind: "moveLeft" }]);
    // Tick 50ms: L's elapsed=50, DAS not yet met, no repeat.
    expect(c.tick(50)).toEqual([]);
    // Press R (direction change; L still held). dcd=0 → R immediately ARR-eligible.
    expect(c.press("Quote", {})).toEqual([{ kind: "moveRight" }]);
    // Tick 30ms: R's elapsed=30, thresholdMet=true, arrAccumulator=30. arr=30
    // → emit one.
    expect(c.tick(30)).toEqual([{ kind: "moveRight" }]);
    // Release R. No immediate move. L becomes active; L's timer resumes from
    // where it was paused (elapsed=50, thresholdMet=false, waitRemaining=50).
    expect(c.release("Quote", {})).toEqual([]);
    // Tick 50ms: L's elapsed=100, DAS just elapsed, leftover=0. arr=30 > 0 →
    // no repeat yet.
    expect(c.tick(50)).toEqual([]);
    // Tick 30ms: arr=30 reached. Emit one moveLeft.
    expect(c.tick(30)).toEqual([{ kind: "moveLeft" }]);
  });
});

describe("InputController: DCD", () => {
  it("with dcd > 0, direction change emits one immediate move and waits dcd before repeats; DCD bypasses fresh DAS", () => {
    const c = new InputController(
      makeSettings({ handling: { das: 100, arr: 30, dcd: 20, sdf: 20 } }),
    );
    // Press L. DAS starts.
    expect(c.press("KeyL", {})).toEqual([{ kind: "moveLeft" }]);
    // Tick 10ms.
    expect(c.tick(10)).toEqual([]);
    // Press R (direction change; L still held). DCD=20, thresholdMet=false.
    expect(c.press("Quote", {})).toEqual([{ kind: "moveRight" }]);
    // Tick 25ms. R's elapsed=25, waitRemaining=20-25=-5, thresholdMet=true,
    // arrAccumulator=5. arr=30 > 5 → no repeat yet.
    expect(c.tick(25)).toEqual([]);
    // Tick 30ms. arrAccumulator=35, emit one repeat.
    expect(c.tick(30)).toEqual([{ kind: "moveRight" }]);
  });

  it("with dcd === 0, direction change repeats resume immediately under ARR (no DAS wait)", () => {
    const c = new InputController(
      makeSettings({ handling: { das: 100, arr: 30, dcd: 0, sdf: 20 } }),
    );
    expect(c.press("KeyL", {})).toEqual([{ kind: "moveLeft" }]);
    expect(c.press("Quote", {})).toEqual([{ kind: "moveRight" }]);
    // Tick 30ms. R thresholdMet=true (dcd=0). arrAccumulator=30. Emit one.
    expect(c.tick(30)).toEqual([{ kind: "moveRight" }]);
  });
});

describe("InputController: soft drop (finite SDF)", () => {
  it("one immediate on edge, one per 1000/sdf ms via tick", () => {
    // sdf=20 -> interval=50ms
    const c = new InputController(
      makeSettings({ handling: { das: 100, arr: 0, dcd: 0, sdf: 20 } }),
    );
    expect(c.press("Semicolon", {})).toEqual([{ kind: "softDrop" }]);
    expect(c.tick(25)).toEqual([]); // 25 < 50
    expect(c.tick(25)).toEqual([{ kind: "softDrop" }]); // accumulator hits 50
    expect(c.tick(50)).toEqual([{ kind: "softDrop" }]);
  });
});

describe("InputController: soft drop (Infinity SDF)", () => {
  it("emits softDropToFloor on edge and on every tick while held", () => {
    const c = new InputController(makeSettings());
    expect(c.press("Semicolon", {})).toEqual([{ kind: "softDropToFloor" }]);
    expect(c.tick(16)).toEqual([{ kind: "softDropToFloor" }]);
    expect(c.tick(16)).toEqual([{ kind: "softDropToFloor" }]);
  });

  it("floor-tracking on edge: pressing a move key while holding softDrop (Infinity) appends softDropToFloor to the returned intents", () => {
    const c = new InputController(makeSettings());
    // Hold softDrop.
    c.press("Semicolon", {});
    // Press move-left. Should return [moveLeft, softDropToFloor].
    expect(c.press("KeyL", {})).toEqual([
      { kind: "moveLeft" },
      { kind: "softDropToFloor" },
    ]);
  });

  it("floor-tracking on edge: pressing a rotate key while holding softDrop (Infinity) appends softDropToFloor last", () => {
    const c = new InputController(makeSettings());
    c.press("Semicolon", {});
    expect(c.press("KeyP", {})).toEqual([
      { kind: "rotateCw" },
      { kind: "softDropToFloor" },
    ]);
  });

  it("floor-tracking on edge does not append after hardDrop, hold, reset, undo, or toggleSolution", () => {
    const c = new InputController(makeSettings());
    c.press("Semicolon", {});

    expect(c.press("Space", {})).toEqual([{ kind: "hardDrop" }]);
    expect(c.press("KeyC", {})).toEqual([{ kind: "hold" }]);
    expect(c.press("KeyR", {})).toEqual([{ kind: "reset" }]);
    expect(c.press("Backspace", {})).toEqual([{ kind: "undo" }]);
    expect(c.press("KeyH", {})).toEqual([{ kind: "toggleSolution" }]);
  });
});

describe("InputController: blur", () => {
  it("clears all pressed state and timers; subsequent tick emits nothing until a fresh press", () => {
    const c = new InputController(
      makeSettings({ handling: { das: 100, arr: 0, dcd: 0, sdf: Infinity } }),
    );
    c.press("KeyL", {});
    c.press("Semicolon", {});
    // Pre-blur tick: in progress but DAS not met.
    expect(c.tick(50)).toEqual([{ kind: "softDropToFloor" }]);
    c.blur();
    // Post-blur tick: nothing (no active direction, no soft drop).
    expect(c.tick(200)).toEqual([]);
    // Press after blur: immediate move + sdf repeat.
    expect(c.press("KeyL", {})).toEqual([{ kind: "moveLeft" }]);
  });
});

describe("InputController: setKeybinds / setHandling", () => {
  it("setHandling: in-progress timer keeps elapsed time but uses new threshold on next tick", () => {
    const c = new InputController(
      makeSettings({ handling: { das: 100, arr: 30, dcd: 0, sdf: 20 } }),
    );
    c.press("KeyL", {});
    c.tick(50); // L's elapsed=50, waitRemaining=50
    // Change DAS to 40 mid-hold. The in-progress waitRemaining stays at 50;
    // the next tick uses the new threshold (40) so waitRemaining will go
    // negative in a single tick.
    c.setHandling({ das: 40, arr: 30, dcd: 0, sdf: 20, gravity: 1 });
    // Tick 50: L's elapsed=100, waitRemaining=50-50=0, thresholdMet=true,
    // arrAccumulator=0. arr=30, no repeat yet.
    expect(c.tick(50)).toEqual([]);
    // Tick 30: arr=30 reached. Emit one.
    expect(c.tick(30)).toEqual([{ kind: "moveLeft" }]);
  });

  it("setKeybinds: new bindings take effect on next press", () => {
    const c = new InputController(makeSettings());
    // Default: KeyL = moveLeft. Press Q → no-op (no binding), but KeyQ is
    // added to physicalDown.
    expect(c.press("KeyQ", {})).toEqual([]);
    c.setKeybinds({ ...DEFAULT_KEYBINDS, moveLeft: [{ code: "KeyQ" }] });
    // Release KeyQ so the next press is treated as a fresh edge.
    c.release("KeyQ", {});
    // Now KeyQ is moveLeft.
    expect(c.press("KeyQ", {})).toEqual([{ kind: "moveLeft" }]);
  });
});

describe("InputController: reset", () => {
  it("clears all state; subsequent tick emits nothing", () => {
    const c = new InputController(
      makeSettings({ handling: { das: 100, arr: 0, dcd: 0, sdf: Infinity } }),
    );
    c.press("KeyL", {});
    c.press("Semicolon", {});
    c.reset();
    expect(c.tick(200)).toEqual([]);
    // Re-pressing after reset fires fresh edges.
    expect(c.press("KeyL", {})).toEqual([{ kind: "moveLeft" }]);
    expect(kinds(c.press("Semicolon", {}))).toEqual(["softDropToFloor"]);
  });
});
