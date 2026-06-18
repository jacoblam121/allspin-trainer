import { describe, it, expect, vi } from "vitest";
import { GameLoop, type Phase } from "./gameLoop.ts";
import { InputController, type Intent } from "../input/inputController.ts";
import {
  DEFAULT_HANDLING,
  DEFAULT_KEYBINDS,
} from "../input/defaultSettings.ts";
import type { Settings } from "../input/settings.ts";
import type { Keybinds } from "../input/keybinds.ts";
import type { Handling } from "../input/handling.ts";
import {
  createEngineFromDrill,
  moveDown,
  rotateCw,
  snapshot as engineSnapshot,
  type EngineState,
} from "../engine/gameState.ts";
import { BOARD_WIDTH, FIELD_HEIGHT } from "../engine/constants.ts";
import type { BoardCell, Drill } from "../drills/drillTypes.ts";

function emptyRow(): BoardCell[] {
  return new Array(BOARD_WIDTH).fill(null);
}

function makeDrill(overrides: Partial<Drill> = {}): Drill {
  return {
    id: "loop-test",
    title: "Loop test",
    category: "Test",
    tags: [],
    ruleset: "tetrio-default",
    board: [],
    active: "I",
    hold: null,
    queue: [],
    goal: "test",
    acceptedSolutions: [],
    ...overrides,
  } as Drill;
}

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

function spawnEngine(
  overrides: Partial<Drill> = {},
  settingsOverrides: Parameters<typeof makeSettings>[0] = {},
): {
  state: EngineState;
  controller: InputController;
  loop: GameLoop;
  publishesList: import("../engine/gameState.ts").EngineSnapshot[];
  phaseList: Phase[];
  counters: { toggle: number; resetView: number };
} {
  const result = createEngineFromDrill(makeDrill(overrides));
  if (!result.ok) throw new Error(`spawn failed: ${result.reason}`);
  const state = result.state;
  const settings = makeSettings(settingsOverrides);
  const controller = new InputController(settings);
  const publishesList: import("../engine/gameState.ts").EngineSnapshot[] = [];
  const phaseList: Phase[] = [];
  const counters = { toggle: 0, resetView: 0 };
  const loop = new GameLoop({
    getEngine: () => state,
    controller,
    onSnapshot: (s) => publishesList.push(s),
    onPhase: (p) => phaseList.push(p),
    onToggleSolution: () => {
      counters.toggle++;
    },
    onResetView: () => {
      counters.resetView++;
    },
    getHandling: () => settings.handling,
  });
  return {
    state,
    controller,
    loop,
    publishesList,
    phaseList,
    counters,
  };
}

type LoopHarness = ReturnType<typeof spawnEngine>;

function apply(
  h: LoopHarness,
  press: { code: string; mods?: Record<string, boolean> } | null,
): void {
  if (press) {
    const intents = h.controller.press(press.code, press.mods ?? {});
    h.loop.dispatch(intents);
  }
}

describe("GameLoop: snapshot cadence", () => {
  it("publishes the initial snapshot on the first dispatch; subsequent idle dispatches do not publish", () => {
    const h = spawnEngine();
    expect(h.publishesList.length).toBe(0);
    // First dispatch publishes the initial snapshot.
    h.loop.dispatch([]);
    expect(h.publishesList.length).toBe(1);
    // Second idle dispatch: no change, no publish.
    h.loop.dispatch([]);
    expect(h.publishesList.length).toBe(1);
  });

  it("publishes when an intent mutates state", () => {
    const h = spawnEngine();
    h.loop.dispatch([]); // initial publish
    const before = h.publishesList.length;
    apply(h, { code: "KeyL" }); // moveLeft
    expect(h.publishesList.length).toBe(before + 1);
  });
});

describe("GameLoop: hard-drop intent (hardDrop + lock)", () => {
  it("engine.hardDrop + engine.lock; queue advances; published snapshot reflects new field + next active piece", () => {
    const h = spawnEngine(
      { active: "O", queue: ["T"] },
      { handling: { das: 100, arr: 0, dcd: 0, sdf: Infinity } },
    );
    apply(h, { code: "Space" }); // hardDrop -> hardDrop + lock
    const last = h.publishesList[h.publishesList.length - 1]!;
    // O has been locked. Queue advanced. Active should be T.
    expect(last.active?.piece).toBe("T");
    expect(last.queue).toEqual([]);
  });
});

describe("GameLoop: softDropToFloor intent (no lock)", () => {
  it("piece repositions to the floor, no lock, queue unchanged, lastClear unchanged", () => {
    const h = spawnEngine(
      { active: "O" },
      { handling: { das: 100, arr: 0, dcd: 0, sdf: Infinity } },
    );
    // Press softDrop with sdf=Infinity -> softDropToFloor intent.
    apply(h, { code: "Semicolon" });
    const last = h.publishesList[h.publishesList.length - 1]!;
    // O is at the floor (lowestValidY=0 for O 0 spawn); no lock; queue
    // empty; lastClear=0.
    expect(last.active?.piece).toBe("O");
    expect(last.active?.y).toBe(0);
    expect(last.queue).toEqual([]);
    expect(last.lastClear).toBe(0);
  });
});

describe("GameLoop: lock-out -> topOutResetOnly", () => {
  it("lock ok:false with reason 'lock out' sets topOutResetOnly; play intents ignored; undo ignored; reset clears it", () => {
    // Build a state where a vertical I sits above the floor with cells
    // blocking downward motion: hardDrop returns ok:true (no move), then
    // lock returns ok:false with reason 'lock out'.
    const result = createEngineFromDrill(makeDrill({ active: "I" }));
    if (!result.ok) throw new Error(result.reason);
    const state = result.state;
    // Move I near the top of the internal field, then rotate I to R (vertical).
    // Cells are y=37,38,39,40 (top y=40 = lock-out).
    state.active!.y = 37;
    rotateCw(state);
    // Block the cells below so hardDrop cannot move the piece down.
    state.field[36][3] = { kind: "filled", piece: "L" };
    state.field[36][4] = { kind: "filled", piece: "L" };
    state.field[36][5] = { kind: "filled", piece: "L" };
    state.field[36][6] = { kind: "filled", piece: "L" };
    const controller = new InputController(makeSettings());
    const publishesList: import("../engine/gameState.ts").EngineSnapshot[] = [];
    const phaseList: Phase[] = [];
    const loop = new GameLoop({
      getEngine: () => state,
      controller,
      onSnapshot: (s) => publishesList.push(s),
      onPhase: (p) => phaseList.push(p),
      onToggleSolution: () => {},
      onResetView: () => {},
      getHandling: () => DEFAULT_HANDLING,
    });

    // Hard-drop intent -> hardDrop + lock. lock should fail with lock-out.
    const hd = controller.press("Space", {});
    loop.dispatch(hd);

    expect(phaseList).toContain("topOutResetOnly");
    expect(loop.getPhase()).toBe("topOutResetOnly");

    // Play intent (moveLeft) is ignored while in topOutResetOnly.
    const publishesBeforePlay = publishesList.length;
    loop.dispatch(controller.press("KeyL", {}));
    expect(publishesList.length).toBe(publishesBeforePlay);
    expect(loop.getPhase()).toBe("topOutResetOnly");

    // Undo is also ignored.
    loop.dispatch(controller.press("Backspace", {}));
    expect(loop.getPhase()).toBe("topOutResetOnly");
    // history is untouched (still 0 — lock never pushed).
    expect(state.history.length).toBe(0);

    // Reset clears the phase.
    loop.dispatch(controller.press("KeyR", {}));
    expect(loop.getPhase()).toBe("playing");
  });
});

describe("GameLoop: post-lock spawn collision -> topOutUndoable", () => {
  it("lock ok:true with status: blocked sets topOutUndoable; undo recovers", () => {
    // Build a state where O is at the floor and the next piece (T) cannot
    // spawn because its spawn cells are occupied. Locking O succeeds; the
    // T spawn collides -> status: 'blocked', but lock pushed history (so
    // undo recovers).
    const result = createEngineFromDrill(
      makeDrill({ active: "O", queue: ["T"] }),
    );
    if (!result.ok) throw new Error(result.reason);
    const state = result.state;
    // Move O down to the floor.
    for (let i = 0; i < 100; i++) {
      if (!moveDown(state).ok) break;
    }
    // Fill T's spawn cells (3,20), (4,20), (5,20), (4,21).
    state.field[20][3] = { kind: "filled", piece: "L" };
    state.field[20][4] = { kind: "filled", piece: "L" };
    state.field[20][5] = { kind: "filled", piece: "L" };
    state.field[21][4] = { kind: "filled", piece: "L" };
    // Sanity: the drill's initial snapshot needs to be reset since we
    // mutated the field. Re-take the initial snapshot.
    state.initial = engineSnapshot(state);
    state.history = [];

    const controller = new InputController(makeSettings());
    const publishesList: import("../engine/gameState.ts").EngineSnapshot[] = [];
    const phaseList: Phase[] = [];
    const loop = new GameLoop({
      getEngine: () => state,
      controller,
      onSnapshot: (s) => publishesList.push(s),
      onPhase: (p) => phaseList.push(p),
      onToggleSolution: () => {},
      onResetView: () => {},
      getHandling: () => DEFAULT_HANDLING,
    });

    loop.dispatch(controller.press("Space", {})); // hardDrop -> lock -> spawn collides
    expect(loop.getPhase()).toBe("topOutUndoable");
    expect(state.status).toBe("blocked");

    // Undo recovers (lock pushed history at gameState.ts:340).
    loop.dispatch(controller.press("Backspace", {}));
    expect(loop.getPhase()).toBe("playing");
    expect(state.status).toBe("active");
  });
});

describe("GameLoop: post-hold spawn collision -> topOutResetOnly", () => {
  it("hold ok:false with status: blocked sets topOutResetOnly; undo ignored (hold pushed no history); reset clears", () => {
    // Build a state where T can spawn but L cannot (L is queue[0]).
    // After hold: T -> hold, L attempts to spawn from the queue. L's spawn
    // collides -> post-hold spawn collision -> status: blocked (no history push).
    const result = createEngineFromDrill(
      makeDrill({ active: "T", hold: null, queue: ["L"] }),
    );
    if (!result.ok) throw new Error(result.reason);
    const state = result.state;
    // Block L's spawn cell (5, 21) - T's spawn uses (4, 21), so T is fine.
    state.field[21][5] = { kind: "filled", piece: "L" };
    state.initial = engineSnapshot(state);
    state.history = [];

    const controller = new InputController(makeSettings());
    const phaseList: Phase[] = [];
    const loop = new GameLoop({
      getEngine: () => state,
      controller,
      onSnapshot: () => {},
      onPhase: (p) => phaseList.push(p),
      onToggleSolution: () => {},
      onResetView: () => {},
      getHandling: () => DEFAULT_HANDLING,
    });

    loop.dispatch(controller.press("KeyC", {})); // hold
    expect(loop.getPhase()).toBe("topOutResetOnly");
    expect(state.status).toBe("blocked");

    // Undo is ignored.
    loop.dispatch(controller.press("Backspace", {}));
    expect(loop.getPhase()).toBe("topOutResetOnly");
    expect(state.history.length).toBe(0);

    // Reset clears it.
    loop.dispatch(controller.press("KeyR", {}));
    expect(loop.getPhase()).toBe("playing");
  });
});

describe("GameLoop: setEngine (drill change)", () => {
  it("resets phase to playing, new snapshot published, controller reset", () => {
    const h = spawnEngine();
    h.loop.dispatch([]); // initial publish
    expect(h.loop.getPhase()).toBe("playing");

    // Unconditional publish: even if the new snapshot equals the last
    // published one, setEngine should publish again.
    const beforeCount = h.publishesList.length;
    h.loop.setEngine(h.state);
    expect(h.publishesList.length).toBe(beforeCount + 1);
    expect(h.loop.getPhase()).toBe("playing");
  });
});

describe("GameLoop: toggleSolution", () => {
  it("onToggleSolution called once; engine untouched; no snapshot published", () => {
    const h = spawnEngine();
    h.loop.dispatch([]); // initial publish
    const beforePub = h.publishesList.length;
    apply(h, { code: "KeyH" });
    expect(h.counters.toggle).toBe(1);
    expect(h.publishesList.length).toBe(beforePub);
    // Engine snapshot unchanged (last published should still be the initial).
    const last = h.publishesList[h.publishesList.length - 1]!;
    expect(last.active?.piece).toBe("I");
  });
});

describe("GameLoop: Reset hides solution (both paths)", () => {
  it("dispatch(reset intent) -> onResetView called once", () => {
    const h = spawnEngine();
    expect(h.counters.resetView).toBe(0);
    apply(h, { code: "KeyR" });
    expect(h.counters.resetView).toBe(1);
  });

  it("loop.reset() -> onResetView called", () => {
    const h = spawnEngine();
    expect(h.counters.resetView).toBe(0);
    h.loop.reset();
    expect(h.counters.resetView).toBe(1);
  });
});

describe("GameLoop: SDF Infinity + move over uneven stack", () => {
  it("press move-left while holding softDrop (sdf=Infinity) grounds the piece in the same published snapshot", () => {
    // Custom settings with sdf=Infinity.
    const h = spawnEngine(
      { active: "T" },
      { handling: { das: 100, arr: 0, dcd: 0, sdf: Infinity } },
    );
    // Hold softDrop first.
    h.controller.press("Semicolon", {});
    // Press move-left. Controller returns [moveLeft, softDropToFloor].
    const intents = h.controller.press("KeyL", {});
    expect(intents).toEqual([
      { kind: "moveLeft" },
      { kind: "softDropToFloor" },
    ]);
    h.loop.dispatch(intents);
    const last = h.publishesList[h.publishesList.length - 1]!;
    // T at the new x, y == lowestValidY for the new x.
    // T 0 at (3, 19) -> cells at y=20, 21. After moveLeft, x=2. lowestValidY=-2.
    // (cells at y=-1, 0 are in bounds; y=-2 puts a cell at y=-1 — out of bounds)
    // Actually lowestValidY loops y-1, so we test y=-2 (collision) -> lowestValidY=-1.
    // Wait, lowestValidY starts at the current y and decrements. For T at y=19:
    //   y=18: cells y=19, 20 - in bounds.
    //   ...
    //   y=-1: cells y=0, 1 — in bounds.
    //   y=-2: cell y=-1 — out of bounds, collision. lowestValidY=-1.
    // After moveLeft, x=2, y stays -1 (the controller's press left y untouched).
    // Then softDropToFloor -> hardDrop -> tries y=-2, collision. lowestValidY=-1 (no change).
    // Hmm wait, after the moveLeft, the piece is at x=2, y=-1. lowestValidY at x=2 for T is -1.
    // So the assertion active.y === -1.
    expect(last.active?.x).toBe(2);
    expect(last.active?.y).toBe(-1);
  });
});

describe("GameLoop: Reset / Undo buttons converge with keybinds", () => {
  it("loop.reset() and dispatch(reset intent) produce the same engine state", () => {
    const h = spawnEngine();
    // Mutate the engine: move left once.
    apply(h, { code: "KeyL" });
    expect(h.state.active?.x).toBe(2); // I spawn at x=3
    // Keybind reset.
    apply(h, { code: "KeyR" });
    expect(h.state.active?.x).toBe(3);

    // Mutate again, then call loop.reset() directly.
    apply(h, { code: "KeyL" });
    expect(h.state.active?.x).toBe(2);
    h.loop.reset();
    expect(h.state.active?.x).toBe(3);
  });

  it("dispatch(undo intent) undoes the previous lock during normal play", () => {
    const h = spawnEngine({ active: "O", queue: ["T"] }, {});
    const beforePlacement = engineSnapshot(h.state);

    apply(h, { code: "Space" });
    expect(h.state.active?.piece).toBe("T");
    expect(h.state.history.length).toBe(1);

    apply(h, { code: "Backspace" });
    expect(h.loop.getPhase()).toBe("playing");
    expect(h.state.active).toEqual(beforePlacement.active);
    expect(h.state.queue).toEqual(beforePlacement.queue);
    expect(h.state.field).toEqual(beforePlacement.field);
    expect(h.state.history.length).toBe(0);
  });

  it("each placement needs only one undo after placing again", () => {
    const h = spawnEngine({ active: "O", queue: ["T", "I"] }, {});
    const initial = engineSnapshot(h.state);

    apply(h, { code: "Space" });
    h.controller.release("Space", {});
    expect(h.state.active?.piece).toBe("T");

    apply(h, { code: "Backspace" });
    h.controller.release("Backspace", {});
    expect(h.state.active).toEqual(initial.active);
    expect(h.state.history.length).toBe(0);

    const beforeSecondPlacement = engineSnapshot(h.state);
    apply(h, { code: "Space" });
    h.controller.release("Space", {});
    expect(h.state.active?.piece).toBe("T");

    apply(h, { code: "Backspace" });
    expect(h.state.active).toEqual(beforeSecondPlacement.active);
    expect(h.state.queue).toEqual(beforeSecondPlacement.queue);
    expect(h.state.history.length).toBe(0);
  });

  it("loop.undo() and dispatch(undo intent) are equivalent; both gated on topOutUndoable", () => {
    // We need to get to a topOutUndoable phase. Use the post-lock spawn
    // collision setup from earlier.
    const result = createEngineFromDrill(
      makeDrill({ active: "O", queue: ["T"] }),
    );
    if (!result.ok) throw new Error(result.reason);
    const state = result.state;
    for (let i = 0; i < 100; i++) {
      if (!moveDown(state).ok) break;
    }
    state.field[20][3] = { kind: "filled", piece: "L" };
    state.field[20][4] = { kind: "filled", piece: "L" };
    state.field[20][5] = { kind: "filled", piece: "L" };
    state.field[21][4] = { kind: "filled", piece: "L" };
    state.initial = engineSnapshot(state);
    state.history = [];

    const controller = new InputController(makeSettings());
    const loop = new GameLoop({
      getEngine: () => state,
      controller,
      onSnapshot: () => {},
      onPhase: () => {},
      onToggleSolution: () => {},
      onResetView: () => {},
      getHandling: () => DEFAULT_HANDLING,
    });

    loop.dispatch(controller.press("Space", {})); // hardDrop -> topOutUndoable
    expect(loop.getPhase()).toBe("topOutUndoable");
    expect(state.status).toBe("blocked");

    // Undo via keybind.
    loop.dispatch(controller.press("Backspace", {}));
    expect(loop.getPhase()).toBe("playing");
    expect(state.status).toBe("active");
  });
});

describe("GameLoop: exhausted queue guard", () => {
  it("dispatch hardDrop when active === null: lock not called, no new history push, no mutation, no publish", () => {
    const h = spawnEngine({ active: "O", queue: [] }, {});
    // First hardDrop: O locks; queue empty; active=null; status='active'.
    // Lock pushed one pre-lock snapshot.
    apply(h, { code: "Space" });
    expect(h.state.active).toBeNull();
    expect(h.state.history.length).toBe(1);
    const pubCountAfterFirst = h.publishesList.length;
    // Second hardDrop: active is null, hardDrop returns ok:false, lock not
    // called, no new history push, no mutation, no new publish.
    apply(h, { code: "Space" });
    expect(h.state.active).toBeNull();
    expect(h.state.history.length).toBe(1);
    expect(h.publishesList.length).toBe(pubCountAfterFirst);
  });
});

describe("GameLoop: softDropToFloor at floor (no-op publish guard)", () => {
  it("with SDF=Infinity and piece at floor, additional softDropToFloor does not republish", () => {
    const h = spawnEngine(
      { active: "O" },
      { handling: { das: 100, arr: 0, dcd: 0, sdf: Infinity } },
    );
    // First softDropToFloor: O moves to the floor; one publish.
    apply(h, { code: "Semicolon" });
    const pubCount = h.publishesList.length;
    // Subsequent softDropToFloor (still held): hardDrop returns ok:true but
    // active.y unchanged -> snapshotChanged false -> no new publish.
    h.loop.dispatch(h.controller.tick(16));
    expect(h.publishesList.length).toBe(pubCount);
  });
});

describe("GameLoop: tickOnce (rAF bypass for tests)", () => {
  it("drives the controller with a caller-supplied dt", () => {
    const h = spawnEngine(
      { active: "I" },
      { handling: { das: 50, arr: 0, dcd: 0, sdf: Infinity } },
    );
    // Press L, then tickOnce 60ms -> DAS elapses -> batch of BOARD_WIDTH moves.
    h.controller.press("KeyL", {});
    h.loop.tickOnce(60);
    const last = h.publishesList[h.publishesList.length - 1]!;
    // I moved left repeatedly until it hit the wall (x=0).
    expect(last.active?.x).toBe(0);
  });
});

describe("GameLoop: gravity", () => {
  it("with gravity 1, one tickOnce(1000) moves active down one cell without soft-drop input", () => {
    const h = spawnEngine(
      { active: "I" },
      { handling: { gravity: 1, sdf: 20 } },
    );
    const startY = h.state.active!.y;

    h.loop.tickOnce(1000);

    expect(h.state.active?.y).toBe(startY - 1);
    expect(h.state.history.length).toBe(0);
    expect(h.loop.getPhase()).toBe("playing");
  });

  it("accumulates partial gravity time", () => {
    const h = spawnEngine(
      { active: "I" },
      { handling: { gravity: 1, sdf: 20 } },
    );
    const startY = h.state.active!.y;

    h.loop.tickOnce(500);
    expect(h.state.active?.y).toBe(startY);

    h.loop.tickOnce(500);
    expect(h.state.active?.y).toBe(startY - 1);
  });

  it("gravity 0 disables automatic falling", () => {
    const h = spawnEngine(
      { active: "I" },
      { handling: { gravity: 0, sdf: 20 } },
    );
    const startY = h.state.active!.y;

    h.loop.tickOnce(10_000);

    expect(h.state.active?.y).toBe(startY);
  });

  it("stops at the floor and does not lock or change phase", () => {
    const h = spawnEngine(
      { active: "O", queue: ["T"] },
      { handling: { gravity: 40, sdf: 20 } },
    );

    h.loop.tickOnce(40_000);

    expect(h.state.active?.piece).toBe("O");
    expect(h.state.active?.y).toBe(0);
    expect(h.state.queue).toEqual(["T"]);
    expect(h.state.history.length).toBe(0);
    expect(h.state.status).toBe("active");
    expect(h.loop.getPhase()).toBe("playing");
  });

  it("caps gravity catch-up to 40 moves in one frame", () => {
    const h = spawnEngine(
      { active: "I" },
      { handling: { gravity: 40, sdf: 20 } },
    );
    h.state.active!.y = 100;
    const startY = h.state.active!.y;

    h.loop.tickOnce(10_000);

    expect(h.state.active?.y).toBe(startY - 40);
  });

  it("hard drop still locks immediately and clears gravity accumulation", () => {
    const h = spawnEngine(
      { active: "O", queue: ["T"] },
      { handling: { gravity: 1, sdf: 20 } },
    );

    h.loop.tickOnce(500);
    apply(h, { code: "Space" });
    const afterPlacementY = h.state.active!.y;
    h.loop.tickOnce(500);

    expect(h.state.active?.piece).toBe("T");
    expect(h.state.active?.y).toBe(afterPlacementY);
    expect(h.state.history.length).toBe(1);
  });

  it("reset, undo, and setEngine clear gravity accumulation", () => {
    const resetHarness = spawnEngine(
      { active: "I" },
      { handling: { gravity: 1, sdf: 20 } },
    );
    const resetY = resetHarness.state.active!.y;
    resetHarness.loop.tickOnce(500);
    resetHarness.loop.reset();
    resetHarness.loop.tickOnce(500);
    expect(resetHarness.state.active?.y).toBe(resetY);

    const undoHarness = spawnEngine(
      { active: "O", queue: ["T"] },
      { handling: { gravity: 1, sdf: 20 } },
    );
    apply(undoHarness, { code: "Space" });
    apply(undoHarness, { code: "Backspace" });
    const undoY = undoHarness.state.active!.y;
    undoHarness.loop.tickOnce(500);
    expect(undoHarness.state.active?.y).toBe(undoY);

    const setEngineHarness = spawnEngine(
      { active: "I" },
      { handling: { gravity: 1, sdf: 20 } },
    );
    const setEngineY = setEngineHarness.state.active!.y;
    setEngineHarness.loop.tickOnce(500);
    setEngineHarness.loop.setEngine(setEngineHarness.state);
    setEngineHarness.loop.tickOnce(500);
    expect(setEngineHarness.state.active?.y).toBe(setEngineY);
  });

  it("successful hold clears gravity accumulation", () => {
    const h = spawnEngine(
      { active: "I", queue: ["T"] },
      { handling: { gravity: 1, sdf: 20 } },
    );

    h.loop.tickOnce(500);
    apply(h, { code: "KeyC" });
    const afterHoldY = h.state.active!.y;
    h.loop.tickOnce(500);

    expect(h.state.active?.piece).toBe("T");
    expect(h.state.active?.y).toBe(afterHoldY);
  });

  it("uses current handling immediately after settings change", () => {
    const result = createEngineFromDrill(makeDrill({ active: "I" }));
    if (!result.ok) throw new Error(result.reason);
    const state = result.state;
    const handling: Handling = { ...DEFAULT_HANDLING, gravity: 0, sdf: 20 };
    const controller = new InputController({
      version: 1,
      keybinds: DEFAULT_KEYBINDS,
      handling,
    });
    const loop = new GameLoop({
      getEngine: () => state,
      controller,
      onSnapshot: () => {},
      onPhase: () => {},
      onToggleSolution: () => {},
      onResetView: () => {},
      getHandling: () => handling,
    });
    const startY = state.active!.y;

    loop.tickOnce(1000);
    expect(state.active?.y).toBe(startY);

    handling.gravity = 10;
    loop.tickOnce(100);
    expect(state.active?.y).toBe(startY - 1);
  });
});

describe("GameLoop: play intents ignored during top-out", () => {
  it("during topOutUndoable: move / rotate / hold / hardDrop are ignored", () => {
    // Construct a topOutUndoable state.
    const result = createEngineFromDrill(
      makeDrill({ active: "O", queue: ["T"] }),
    );
    if (!result.ok) throw new Error(result.reason);
    const state = result.state;
    for (let i = 0; i < 100; i++) {
      if (!moveDown(state).ok) break;
    }
    state.field[20][3] = { kind: "filled", piece: "L" };
    state.field[20][4] = { kind: "filled", piece: "L" };
    state.field[20][5] = { kind: "filled", piece: "L" };
    state.field[21][4] = { kind: "filled", piece: "L" };
    state.initial = engineSnapshot(state);
    state.history = [];

    const controller = new InputController(makeSettings());
    const loop = new GameLoop({
      getEngine: () => state,
      controller,
      onSnapshot: () => {},
      onPhase: () => {},
      onToggleSolution: () => {},
      onResetView: () => {},
      getHandling: () => DEFAULT_HANDLING,
    });
    loop.dispatch(controller.press("Space", {}));
    expect(loop.getPhase()).toBe("topOutUndoable");

    const activeBefore = state.active;
    const queueBefore = [...state.queue];
    // Try a bunch of play intents — all should be ignored.
    loop.dispatch(controller.press("KeyL", {}));
    loop.dispatch(controller.press("Quote", {}));
    loop.dispatch(controller.press("KeyP", {}));
    loop.dispatch(controller.press("KeyC", {}));
    loop.dispatch(controller.press("Semicolon", {}));
    expect(state.active).toBe(activeBefore);
    expect(state.queue).toEqual(queueBefore);
    expect(loop.getPhase()).toBe("topOutUndoable");
  });
});

// Suppress an unused warning on the dummy type assertion in the harness.
void vi;
// FIELD_HEIGHT is used implicitly through the engine's internal layout; keep
// the import for future use in the file (e.g. constructing bespoke cells).
void FIELD_HEIGHT;
void (null as unknown as Intent);
void emptyRow;
