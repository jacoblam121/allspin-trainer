// Game loop (plan §7). Owns requestAnimationFrame, computes dt, feeds dt to
// InputController.tick, applies returned Intents to the engine, publishes
// snapshots to React via onSnapshot when the snapshot actually changes (or
// the phase changes), and tracks Phase ("playing" | "topOutUndoable" |
// "topOutResetOnly").
//
// Variable-step, rAF-driven. The loop advances input repeat timers, dispatches
// intents, applies fall-only gravity, and publishes resulting snapshots.
// setEngine (drill / variant change) always publishes unconditionally. Phase is tracked per the
// cause-of-top-out analysis in plan §7 and §12 — see updatePhaseAfterLock
// and updatePhaseAfterHold.
//
// Match mode (Sprint 2): the loop consumes a `MatchMode` describing how
// pass/fail feedback is computed. Strict-route mode preserves the MVP 1
// `matchAcceptedSolution` behavior. Outcome mode evaluates `findAcceptedOutcome`
// against the current locked field after each successful lock. V2 outcome
// state is sticky once `solved`, and is cleared by reset / undo / setEngine
// (those paths emit `pending` and never consult the matcher).
//
// Scheduler (rAF + time source) is injectable for tests; the production
// default uses requestAnimationFrame and performance.now() (clamped dt max
// 100ms to avoid huge jumps after tab-switches).

import {
  type EngineSnapshot,
  type EngineState,
  type LockedPlacement,
  hardDropAndLock as engineHardDropAndLock,
  hardDrop as engineHardDrop,
  hold as engineHold,
  moveDown as engineMoveDown,
  moveLeft as engineMoveLeft,
  moveRight as engineMoveRight,
  reset as engineReset,
  rotate180 as engineRotate180,
  rotateCw as engineRotateCw,
  rotateCcw as engineRotateCcw,
  snapshot as engineSnapshot,
  undo as engineUndo,
} from "../engine/gameState.ts";
import { snapshotChanged } from "./snapshotChanged.ts";
import type { InputController, Intent } from "../input/inputController.ts";
import type { Handling } from "../input/handling.ts";
import type { AcceptedSolution } from "../drills/drillTypes.ts";
import type { AcceptedOutcome } from "../drills/drillTypesV2.ts";
import {
  findAcceptedOutcome,
  type OutcomeMatchResult,
} from "../drills/outcomeMatcher.ts";
import {
  matchAcceptedSolution,
  type SolutionMatchResult,
} from "../drills/solutionMatcher.ts";

export type Phase = "playing" | "topOutUndoable" | "topOutResetOnly";

export type MatchMode =
  | { kind: "strict-route"; acceptedSolutions: AcceptedSolution[] }
  | { kind: "outcome"; acceptedOutcomes: AcceptedOutcome[]; variantId: string };

export type LoopMatchResult = SolutionMatchResult | OutcomeMatchResult;

export type GameLoopOptions = {
  getEngine: () => EngineState;
  matchMode: MatchMode;
  controller: InputController;
  onSnapshot: (snapshot: EngineSnapshot) => void;
  onPhase: (phase: Phase) => void;
  onMatchResult: (result: LoopMatchResult) => void;
  onToggleSolution: () => void;
  onResetView: () => void;
  getHandling: () => Handling;
  // Optional: override the rAF + time source. Used by tests to drive the
  // loop synchronously. Defaults to requestAnimationFrame + performance.now.
  scheduler?: GameLoopScheduler;
  // Optional: cap on the dt fed to the controller per frame. Defaults to 100.
  maxDtMs?: number;
};

export type GameLoopScheduler = {
  now(): number;
  raf: (callback: (timeMs: number) => void) => number;
  cancelRaf: (id: number) => void;
};

const DEFAULT_MAX_DT_MS = 100;
const MAX_GRAVITY_STEPS_PER_FRAME = 40;

function defaultScheduler(): GameLoopScheduler {
  return {
    now: () =>
      typeof performance !== "undefined" ? performance.now() : Date.now(),
    raf: (cb) =>
      typeof requestAnimationFrame !== "undefined"
        ? requestAnimationFrame((t) => cb(t))
        : (setTimeout(() => cb(Date.now()), 0) as unknown as number),
    cancelRaf: (id) => {
      if (typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(id);
      } else {
        clearTimeout(id);
      }
    },
  };
}

export class GameLoop {
  private engine: EngineState;
  private matchMode: MatchMode;
  private placementHistory: LockedPlacement[] = [];
  // Sticky V2 outcome state. Non-null means the drill is solved for the
  // current run; reset / undo / setEngine clear it and emit pending. Outcome
  // evaluation only runs on the post-lock path, so solved / incomplete are
  // not produced from reset / undo / setEngine.
  private solvedOutcome: AcceptedOutcome | null = null;
  private readonly controller: InputController;
  private readonly onSnapshot: (snapshot: EngineSnapshot) => void;
  private readonly onPhase: (phase: Phase) => void;
  private readonly onMatchResult: (result: LoopMatchResult) => void;
  private readonly onToggleSolution: () => void;
  private readonly onResetView: () => void;
  private readonly getHandling: () => Handling;
  private readonly scheduler: GameLoopScheduler;
  private readonly maxDtMs: number;

  private rafId: number | null = null;
  private running = false;
  private lastTime = 0;
  private lastPublishedSnapshot: EngineSnapshot | null = null;
  private currentPhase: Phase = "playing";
  private gravityAccumulatorMs = 0;

  constructor(opts: GameLoopOptions) {
    this.engine = opts.getEngine();
    this.matchMode = opts.matchMode;
    this.controller = opts.controller;
    this.onSnapshot = opts.onSnapshot;
    this.onPhase = opts.onPhase;
    this.onMatchResult = opts.onMatchResult;
    this.onToggleSolution = opts.onToggleSolution;
    this.onResetView = opts.onResetView;
    this.getHandling = opts.getHandling;
    this.scheduler = opts.scheduler ?? defaultScheduler();
    this.maxDtMs = opts.maxDtMs ?? DEFAULT_MAX_DT_MS;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = this.scheduler.now();
    this.scheduleFrame();
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      this.scheduler.cancelRaf(this.rafId);
      this.rafId = null;
    }
  }

  // Synchronous test entry: run a single frame with a caller-supplied dt.
  // The rAF scheduler is bypassed. Used by the loop tests and by 3A test
  // code that wants to drive a frame deterministically.
  tickOnce(dtMs: number): void {
    this.lastTime = this.scheduler.now();
    this.frame(dtMs);
  }

  // The single sink for applying intents to the engine. Called by the rAF
  // tick (with controller.tick results) AND by the keydown / keyup edge
  // handlers (with controller.press / release results). Keeps all engine
  // mutation inside the loop so React / the hook never call engine commands
  // directly.
  dispatch(intents: Intent[]): void {
    for (const intent of intents) {
      if (this.shouldIgnore(intent)) continue;
      this.applyIntent(intent);
    }
    this.maybePublish();
  }

  // Engine-side reset. Called by the Reset button and the "reset" intent
  // (both go through dispatch, so the intent path and the button path are
  // indistinguishable). Always: reset the engine, clear controller state,
  // reset the phase, hide the solution. V2 outcome state is cleared and
  // pending is emitted (the matcher is not consulted).
  reset(): void {
    engineReset(this.engine);
    this.placementHistory = [];
    this.solvedOutcome = null;
    this.emitPendingOrStrictRoute();
    this.controller.reset();
    this.resetGravity();
    this.setPhase("playing");
    this.onResetView();
    this.maybePublish();
  }

  // Engine-side undo. Honored during normal play and during
  // "topOutUndoable". In "topOutResetOnly", undo is swallowed and the
  // phase / engine are untouched because the top-out-causing command pushed
  // no recoverable history. V2 outcome state is cleared and pending is
  // emitted.
  undo(): void {
    if (this.currentPhase === "topOutResetOnly") return;
    engineUndo(this.engine);
    this.placementHistory = this.placementHistory.slice(
      0,
      this.engine.history.length,
    );
    this.solvedOutcome = null;
    this.emitPendingOrStrictRoute();
    this.resetGravity();
    this.setPhase("playing");
    this.maybePublish();
  }

  // Swap engine on drill / variant change. Resets phase to "playing" and
  // publishes unconditionally (a change is a discrete event, not a tick).
  // V2 outcome state is cleared and pending is emitted.
  setEngine(state: EngineState, matchMode: MatchMode): void {
    this.engine = state;
    this.matchMode = matchMode;
    this.placementHistory = [];
    this.solvedOutcome = null;
    this.controller.reset();
    this.resetGravity();
    this.setPhase("playing");
    this.emitPendingOrStrictRoute();
    this.publishUnconditional();
  }

  getPhase(): Phase {
    return this.currentPhase;
  }

  // --- private --------------------------------------------------------

  private scheduleFrame(): void {
    this.rafId = this.scheduler.raf((timeMs) => {
      this.rafId = null;
      if (!this.running) return;
      const dt = Math.min(timeMs - this.lastTime, this.maxDtMs);
      this.lastTime = timeMs;
      this.frame(dt);
      if (this.running) this.scheduleFrame();
    });
  }

  private frame(dtMs: number): void {
    const intents = this.controller.tick(dtMs);
    for (const intent of intents) {
      if (this.shouldIgnore(intent)) continue;
      this.applyIntent(intent);
    }
    this.applyGravity(dtMs);
    this.maybePublish();
  }

  private applyIntent(intent: Intent): void {
    switch (intent.kind) {
      case "moveLeft":
        engineMoveLeft(this.engine);
        break;
      case "moveRight":
        engineMoveRight(this.engine);
        break;
      case "softDrop":
        engineMoveDown(this.engine);
        break;
      case "softDropToFloor":
        // Reposition only; no lock.
        engineHardDrop(this.engine);
        break;
      case "hardDrop": {
        const result = engineHardDropAndLock(this.engine);
        if (result.ok) {
          if (result.lockedPlacement) {
            this.placementHistory.push(result.lockedPlacement);
            this.handlePostLock();
          }
          this.resetGravity();
        }
        if (result.ok || result.reason.startsWith("lock out")) {
          this.updatePhaseAfterLock(result.ok, result.snapshot.status);
        }
        break;
      }
      case "rotateCw":
        engineRotateCw(this.engine);
        break;
      case "rotateCcw":
        engineRotateCcw(this.engine);
        break;
      case "rotate180":
        engineRotate180(this.engine);
        break;
      case "hold": {
        const result = engineHold(this.engine);
        if (result.ok) {
          this.resetGravity();
        }
        this.updatePhaseAfterHold(result.ok, result.snapshot.status);
        break;
      }
      case "reset":
        this.reset();
        return;
      case "undo":
        this.undo();
        return;
      case "toggleSolution":
        this.onToggleSolution();
        return;
    }
  }

  // Phase policy (plan §7, §12):
  //   hardDrop intent => engine.hardDropAndLock():
  //     lock ok=false (reason "lock out ...")         -> topOutResetOnly
  //     lock ok=true  && status === "blocked"        -> topOutUndoable
  //     otherwise                                     -> playing
  //   hold intent => engine.hold():
  //     ok=false && status === "blocked"              -> topOutResetOnly
  //     otherwise                                     -> playing
  //   move / rotate / softDrop / softDropToFloor cannot cause top-out.
  private updatePhaseAfterLock(
    lockOk: boolean,
    status: EngineSnapshot["status"],
  ): void {
    if (!lockOk) {
      this.setPhase("topOutResetOnly");
      return;
    }
    if (status === "blocked") {
      this.setPhase("topOutUndoable");
      return;
    }
    this.setPhase("playing");
  }

  private updatePhaseAfterHold(
    holdOk: boolean,
    status: EngineSnapshot["status"],
  ): void {
    if (!holdOk && status === "blocked") {
      this.setPhase("topOutResetOnly");
      return;
    }
    this.setPhase("playing");
  }

  private setPhase(next: Phase): void {
    if (this.currentPhase === next) return;
    this.currentPhase = next;
    this.onPhase(next);
  }

  private resetGravity(): void {
    this.gravityAccumulatorMs = 0;
  }

  private applyGravity(dtMs: number): void {
    if (this.currentPhase !== "playing") return;
    const gravity = this.getHandling().gravity;
    if (gravity === 0) {
      this.resetGravity();
      return;
    }

    const intervalMs = 1000 / gravity;
    this.gravityAccumulatorMs += dtMs;
    const availableSteps = Math.floor(this.gravityAccumulatorMs / intervalMs);
    const steps = Math.min(availableSteps, MAX_GRAVITY_STEPS_PER_FRAME);
    if (availableSteps > MAX_GRAVITY_STEPS_PER_FRAME) {
      this.gravityAccumulatorMs %= intervalMs;
    } else {
      this.gravityAccumulatorMs -= steps * intervalMs;
    }

    for (let i = 0; i < steps; i++) {
      const result = engineMoveDown(this.engine);
      if (!result.ok) {
        this.resetGravity();
        return;
      }
    }
  }

  // Post-lock path: evaluate match mode after a successful lock that pushed
  // a `lockedPlacement`. Strict-route runs the placement matcher; outcome
  // mode evaluates the board mask, with sticky `solved` and queue-exhausted
  // `incomplete`. Both modes preserve the queue-exhausted -> incomplete
  // shortcut.
  private handlePostLock(): void {
    if (this.matchMode.kind === "strict-route") {
      this.emitStrictRouteResult();
      return;
    }
    // Outcome mode.
    if (this.solvedOutcome !== null) {
      this.onMatchResult({
        status: "solved",
        outcome: this.solvedOutcome,
      });
      return;
    }
    const match = findAcceptedOutcome(
      this.engine.field,
      this.matchMode.acceptedOutcomes,
      this.matchMode.variantId,
    );
    if (match !== null) {
      this.solvedOutcome = match;
      this.onMatchResult({ status: "solved", outcome: match });
      return;
    }
    this.emitPendingOrIncomplete();
  }

  // Emit a strict-route match result, with the legacy queue-exhausted ->
  // incomplete shortcut. The `incomplete` status is part of
  // `OutcomeMatchResult` but it is a valid `LoopMatchResult` in either
  // mode here.
  private emitStrictRouteResult(): void {
    const result = matchAcceptedSolution(
      this.placementHistory,
      this.matchMode.kind === "strict-route"
        ? this.matchMode.acceptedSolutions
        : [],
    );
    if (
      result.status === "pending" &&
      this.engine.active === null &&
      this.engine.queue.length === 0 &&
      this.engine.status === "active"
    ) {
      this.onMatchResult({ status: "incomplete" });
      return;
    }
    this.onMatchResult(result);
  }

  // Emit `pending` (outcome mode) or the strict-route result (strict-route
  // mode). Used by reset / undo / setEngine, which never consult the V2
  // outcome matcher directly. Strict-route still runs the placement matcher
  // so the existing reset/undo behavior is preserved.
  private emitPendingOrStrictRoute(): void {
    if (this.matchMode.kind === "strict-route") {
      this.emitStrictRouteResult();
      return;
    }
    this.onMatchResult({ status: "pending" });
  }

  // Emit `pending` or `incomplete` based on whether the queue is exhausted
  // and no piece is active. Used by the post-lock path in outcome mode when
  // the board does not match any accepted outcome.
  private emitPendingOrIncomplete(): void {
    if (
      this.engine.active === null &&
      this.engine.queue.length === 0 &&
      this.engine.status === "active"
    ) {
      this.onMatchResult({ status: "incomplete" });
      return;
    }
    this.onMatchResult({ status: "pending" });
  }

  // In a top-out phase, only reset / toggleSolution are honored. undo is
  // honored only when phase === "topOutUndoable". Play intents (move /
  // rotate / softDrop / softDropToFloor / hardDrop / hold) are always
  // ignored during a top-out phase. (setEngine is not an intent; it's
  // called directly on the loop and is always honored regardless of phase.)
  private shouldIgnore(intent: Intent): boolean {
    if (this.currentPhase === "playing") return false;
    switch (intent.kind) {
      case "reset":
        return false;
      case "toggleSolution":
        return false;
      case "undo":
        return this.currentPhase !== "topOutUndoable";
      default:
        return true;
    }
  }

  // Snapshot cadence (plan §7): publish only when state actually changes
  // (compare to last published via snapshotChanged) or phase changes. The
  // initial publish (first frame / setEngine) is unconditional; we publish
  // a "first" snapshot so the loop is always in sync.
  private maybePublish(): void {
    const snap = engineSnapshot(this.engine);
    if (this.lastPublishedSnapshot === null) {
      this.publish(snap);
      return;
    }
    if (snapshotChanged(this.lastPublishedSnapshot, snap)) {
      this.publish(snap);
    }
  }

  private publishUnconditional(): void {
    const snap = engineSnapshot(this.engine);
    this.publish(snap);
  }

  private publish(snap: EngineSnapshot): void {
    this.lastPublishedSnapshot = snap;
    this.onSnapshot(snap);
  }
}
