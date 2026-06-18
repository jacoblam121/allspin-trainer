// Input controller (plan §6). Deterministic, simulated-clock-driven — no
// Date.now, no setTimeout, no requestAnimationFrame inside the controller.
// The loop (or a test) calls press / release / blur / tick with explicit
// inputs; the controller returns Intents.
//
// Physical pressed state is tracked to suppress native browser auto-repeat
// keydowns. The dedupe key is the physical KeyboardEvent.code only — it is
// independent of the current modifier flag set, so a native repeat that
// fires with a different modifier combination (e.g. the user pressed or
// released Ctrl between repeats of another key) is still suppressed.
// Chord re-presses of the same physical code are likewise ignored.
//
// Each press also records the action resolved at keydown time, keyed by
// the physical code. The matching keyup can arrive with different
// modifier flags than the keydown (e.g. releasing Ctrl before Z), so
// release cleanup looks up the stored action by code rather than
// re-matching against the keyup modifier set.
//
// Horizontal movement uses DAS / ARR / DCD with most-recent-pressed-wins:
// press L then R -> R is active; release R -> L resumes with its DAS /
// DCD timer continued from where it was paused (not restarted). Releases
// never emit an immediate move.
//
// Soft drop: finite SDF (cells/sec) repeats via moveDown on a timer.
// Infinity SDF emits a softDropToFloor on the soft-drop press edge and on
// every tick while held, so the piece tracks the floor as it falls
// naturally. While softDrop is held with sdf === Infinity, a press() edge
// batch for a move or rotate action ends with a softDropToFloor, so the
// loop re-grounds the piece in the same published snapshot after the
// horizontal / rotation change. reset / undo / hardDrop / hold /
// toggleSolution do NOT append softDropToFloor on their press edge.

import { BOARD_WIDTH } from "../engine/constants.ts";
import type { Action, Keybinds, Modifiers } from "./keybinds.ts";
import { matchAction } from "./keybinds.ts";
import type { Handling } from "./handling.ts";
import type { Settings } from "./settings.ts";

export type Intent =
  | { kind: "moveLeft" }
  | { kind: "moveRight" }
  | { kind: "softDrop" }
  | { kind: "softDropToFloor" }
  | { kind: "hardDrop" }
  | { kind: "rotateCw" }
  | { kind: "rotateCcw" }
  | { kind: "rotate180" }
  | { kind: "hold" }
  | { kind: "reset" }
  | { kind: "undo" }
  | { kind: "toggleSolution" };

type Horizontal = "left" | "right";

type HorizontalState = {
  held: boolean;
  // ms since the most recent press edge of this direction (fresh or
  // direction change). Does NOT advance while this direction is inactive.
  elapsed: number;
  // In DCD mode: ms remaining in the DCD-wait phase.
  // In DAS mode: ms remaining in the DAS phase.
  // Stays at the threshold value until first decrement.
  waitRemaining: number;
  // true after the DAS (fresh press) or DCD (direction change) threshold
  // has elapsed for the current hold. After this, ARR repeats are eligible.
  thresholdMet: boolean;
  // ms accumulator for ARR. Reset to 0 on each new hold.
  arrAccumulator: number;
};

type SoftDropState = {
  held: boolean;
  // ms accumulator for finite SDF. Not used when sdf === Infinity.
  accumulator: number;
};

function emptyHorizontal(): HorizontalState {
  return {
    held: false,
    elapsed: 0,
    waitRemaining: 0,
    thresholdMet: false,
    arrAccumulator: 0,
  };
}

function emptySoftDrop(): SoftDropState {
  return { held: false, accumulator: 0 };
}

export class InputController {
  private keybinds: Keybinds;
  private handling: Handling;
  // Physical KeyboardEvent.code values currently down. Used to suppress native
  // auto-repeat even if modifier flags change while the key remains held.
  private physicalDown: Set<string> = new Set();
  // The action resolved at keydown time for each physical code. Keyup
  // events can arrive with different modifier flags than keydown (for
  // example releasing Ctrl before Z), so release cleanup must not rely on
  // matching the keyup modifier set.
  private physicalActions: Map<string, Action | null> = new Map();
  private left: HorizontalState = emptyHorizontal();
  private right: HorizontalState = emptyHorizontal();
  private activeHorizontal: Horizontal | null = null;
  private softDrop: SoftDropState = emptySoftDrop();

  constructor(settings: Settings) {
    this.keybinds = settings.keybinds;
    this.handling = settings.handling;
  }

  setKeybinds(kb: Keybinds): void {
    this.keybinds = kb;
  }

  setHandling(h: Handling): void {
    this.handling = h;
  }

  // Clear all state. Used on drill change and on focus regain after top-out.
  reset(): void {
    this.physicalDown.clear();
    this.physicalActions.clear();
    this.left = emptyHorizontal();
    this.right = emptyHorizontal();
    this.activeHorizontal = null;
    this.softDrop = emptySoftDrop();
  }

  // Release all physical keys and clear all timers. Window-blur hook.
  blur(): void {
    this.reset();
  }

  press(code: string, mods: Modifiers): Intent[] {
    // Native auto-repeat suppression: ignore a re-press of the same physical
    // code that is already down, regardless of current modifier flags.
    if (this.physicalDown.has(code)) {
      return [];
    }
    this.physicalDown.add(code);

    const action = matchAction(this.keybinds, code, mods);
    this.physicalActions.set(code, action);
    if (action === null) return [];

    const intents: Intent[] = [];
    let shouldFloorTrack = false;
    switch (action) {
      case "moveLeft":
        this.pressHorizontal("left");
        intents.push({ kind: "moveLeft" });
        shouldFloorTrack = true;
        break;
      case "moveRight":
        this.pressHorizontal("right");
        intents.push({ kind: "moveRight" });
        shouldFloorTrack = true;
        break;
      case "softDrop":
        this.softDrop.held = true;
        this.softDrop.accumulator = 0;
        if (this.handling.sdf === Infinity) {
          intents.push({ kind: "softDropToFloor" });
        } else {
          intents.push({ kind: "softDrop" });
        }
        break;
      case "hardDrop":
        intents.push({ kind: "hardDrop" });
        break;
      case "rotateCw":
        intents.push({ kind: "rotateCw" });
        shouldFloorTrack = true;
        break;
      case "rotateCcw":
        intents.push({ kind: "rotateCcw" });
        shouldFloorTrack = true;
        break;
      case "rotate180":
        intents.push({ kind: "rotate180" });
        shouldFloorTrack = true;
        break;
      case "hold":
        intents.push({ kind: "hold" });
        break;
      case "reset":
        intents.push({ kind: "reset" });
        break;
      case "undo":
        intents.push({ kind: "undo" });
        break;
      case "toggleSolution":
        intents.push({ kind: "toggleSolution" });
        break;
    }

    // Floor-tracking: when softDrop is held with sdf === Infinity and the
    // just-pressed action is a move/rotate, append a softDropToFloor to the
    // end of the edge batch so the loop re-grounds the piece in the same
    // published snapshot.
    if (
      shouldFloorTrack &&
      this.softDrop.held &&
      this.handling.sdf === Infinity &&
      intents.length > 0
    ) {
      intents.push({ kind: "softDropToFloor" });
    }

    return intents;
  }

  release(code: string, mods: Modifiers): Intent[] {
    const releasedActions = this.releasePhysicalCode(code);
    if (releasedActions.length > 0) {
      for (const action of releasedActions) {
        this.releaseAction(action);
      }
      return [];
    }

    // Fallback for externally-created or pre-reset keyup events. In normal
    // operation keydown records the action and releasePhysicalCode handles it.
    const action = matchAction(this.keybinds, code, mods);
    if (action === null) return [];

    this.releaseAction(action);
    return [];
  }

  private releasePhysicalCode(code: string): Action[] {
    const actions: Action[] = [];
    if (!this.physicalDown.has(code)) {
      return actions;
    }
    this.physicalDown.delete(code);
    const action = this.physicalActions.get(code);
    this.physicalActions.delete(code);
    if (action !== null && action !== undefined) {
      actions.push(action);
    }
    return actions;
  }

  private releaseAction(action: Action): void {
    switch (action) {
      case "moveLeft":
        this.releaseHorizontal("left");
        break;
      case "moveRight":
        this.releaseHorizontal("right");
        break;
      case "softDrop":
        this.softDrop.held = false;
        this.softDrop.accumulator = 0;
        break;
      default:
        break;
    }
  }

  tick(dtMs: number): Intent[] {
    const intents: Intent[] = [];
    if (this.activeHorizontal !== null) {
      const state = this.activeHorizontal === "left" ? this.left : this.right;
      const dir: Horizontal = this.activeHorizontal;
      const moveIntent: Intent =
        dir === "left" ? { kind: "moveLeft" } : { kind: "moveRight" };
      intents.push(...this.tickHorizontal(state, dtMs, moveIntent));
    }
    if (this.softDrop.held) {
      intents.push(...this.tickSoftDrop(dtMs));
    }
    return intents;
  }

  private pressHorizontal(direction: Horizontal): void {
    const me = direction === "left" ? this.left : this.right;
    const otherState = direction === "left" ? this.right : this.left;

    me.held = true;

    // If we're already active, reset (handles key-bounce re-press).
    if (this.activeHorizontal === direction) {
      this.startHold(me, /* isDcdMode */ otherState.held);
      return;
    }

    // Becoming active. Determine fresh-press vs direction change.
    this.activeHorizontal = direction;
    this.startHold(me, /* isDcdMode */ otherState.held);
  }

  // Reset the direction's per-hold state. isDcdMode is true when the OTHER
  // direction is already held (true direction change), false on a fresh
  // press from no held horizontal key.
  private startHold(state: HorizontalState, isDcdMode: boolean): void {
    state.elapsed = 0;
    state.arrAccumulator = 0;
    if (isDcdMode) {
      state.waitRemaining = this.handling.dcd;
      // DCD === 0: immediately ARR-eligible (DAS is bypassed on direction
      // change per plan §6.4).
      state.thresholdMet = this.handling.dcd === 0;
    } else {
      state.waitRemaining = this.handling.das;
      state.thresholdMet = false;
    }
  }

  private releaseHorizontal(direction: Horizontal): void {
    const state = direction === "left" ? this.left : this.right;
    state.held = false;
    // Timer state is NOT reset on release. If/when this direction becomes
    // active again, the elapsed / waitRemaining / arrAccumulator resume
    // from where they were paused (plan §6.4 "DAS timer resumed (not
    // restarted)").
    if (this.activeHorizontal === direction) {
      const otherState = direction === "left" ? this.right : this.left;
      this.activeHorizontal = otherState.held
        ? direction === "left"
          ? "right"
          : "left"
        : null;
    }
  }

  private tickHorizontal(
    state: HorizontalState,
    dt: number,
    moveIntent: Intent,
  ): Intent[] {
    state.elapsed += dt;
    if (!state.thresholdMet) {
      state.waitRemaining -= dt;
      if (state.waitRemaining > 0) return [];
      const leftover = -state.waitRemaining;
      state.thresholdMet = true;
      state.arrAccumulator = leftover;
    } else {
      state.arrAccumulator += dt;
    }

    const intents: Intent[] = [];
    if (this.handling.arr > 0) {
      while (state.arrAccumulator >= this.handling.arr) {
        intents.push(moveIntent);
        state.arrAccumulator -= this.handling.arr;
      }
    } else {
      // arr === 0: instant-to-wall. Emit a capped batch per tick; the loop
      // applies them in order and stops at the first ok:false (engine
      // rejects the wall move without mutating). The controller is
      // stateless about engine position, so this is re-emitted on every
      // tick post-DAS / DCD.
      for (let i = 0; i < BOARD_WIDTH; i++) {
        intents.push(moveIntent);
      }
    }
    return intents;
  }

  private tickSoftDrop(dt: number): Intent[] {
    if (this.handling.sdf === Infinity) {
      return [{ kind: "softDropToFloor" }];
    }
    this.softDrop.accumulator += dt;
    const interval = 1000 / this.handling.sdf;
    const intents: Intent[] = [];
    while (this.softDrop.accumulator >= interval) {
      intents.push({ kind: "softDrop" });
      this.softDrop.accumulator -= interval;
    }
    return intents;
  }
}
