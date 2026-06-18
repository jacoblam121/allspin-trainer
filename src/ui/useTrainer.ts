// useTrainer (plan §11.1). Owns the engine / controller / loop lifecycle
// for the React side. Renders engine snapshots via setState driven by the
// loop's onSnapshot callback. Window event listeners (keydown, keyup,
// blur) are mounted in a useEffect. On drill change, the hook recreates the
// engine and either calls loop.setEngine or stops/clears the loop if the drill
// is invalid. A later valid drill creates and starts a fresh loop.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  createEngineFromDrill,
  snapshot as engineSnapshot,
  type EngineSnapshot,
  type EngineState,
} from "../engine/gameState.ts";
import { InputController } from "../input/inputController.ts";
import type { Settings } from "../input/settings.ts";
import { matchAction } from "../input/keybinds.ts";
import {
  GameLoop,
  type LoopMatchResult,
  type Phase,
} from "../loop/gameLoop.ts";
import type { Drill } from "../drills/drillTypes.ts";

export type UseTrainerCallbacks = {
  onToggleSolution: () => void;
  onResetView: () => void;
  // Mutable ref the SettingsPanel sets to true while in rebind mode.
  rebindActiveRef: React.MutableRefObject<boolean>;
};

export type UseTrainerResult = {
  snapshot: EngineSnapshot | null;
  phase: Phase;
  matchResult: LoopMatchResult | null;
  error: string | null;
  reset: () => void;
  undo: () => void;
};

function initEngine(drill: Drill): {
  state: EngineState | null;
  error: string | null;
} {
  const init = createEngineFromDrill(drill);
  return init.ok
    ? { state: init.state, error: null }
    : { state: null, error: init.reason };
}

export function useTrainer(
  drill: Drill,
  settings: Settings,
  callbacks: UseTrainerCallbacks,
): UseTrainerResult {
  // Engine + initial snapshot. The state lives in useState; on drill change
  // we recompute during render (set-during-render pattern, supported by
  // React) so the first effect cycle of a new drill already has the right
  // engine.
  const initial = initEngine(drill);
  const [engineState, setEngineState] = useState<EngineState | null>(
    initial.state,
  );
  const [error, setError] = useState<string | null>(initial.error);
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(() =>
    initial.state ? engineSnapshot(initial.state) : null,
  );
  const [phase, setPhase] = useState<Phase>("playing");
  const [matchResult, setMatchResult] = useState<LoopMatchResult | null>(() =>
    initial.state ? { status: "pending" } : null,
  );
  const settingsRef = useRef(settings);
  useLayoutEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const [prevDrillId, setPrevDrillId] = useState(drill.id);
  if (prevDrillId !== drill.id) {
    setPrevDrillId(drill.id);
    const next = initEngine(drill);
    setEngineState(next.state);
    setError(next.error);
    setSnapshot(next.state ? engineSnapshot(next.state) : null);
    setPhase("playing");
    setMatchResult(next.state ? { status: "pending" } : null);
  }

  // Snapshot + phase state, driven by the loop's onSnapshot / onPhase after
  // the synchronous drill-change initialization above.

  // Controller: created once. Settings updates applied via setKeybinds /
  // setHandling in the effect below.
  const controllerRef = useRef<InputController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = new InputController(settings);
  }
  useEffect(() => {
    controllerRef.current?.setKeybinds(settings.keybinds);
    controllerRef.current?.setHandling(settings.handling);
  }, [settings]);

  // Loop ref. Created lazily in an effect (refs must not be accessed during
  // render per react-hooks/refs). We also push the engine into the loop
  // whenever the engine state changes.
  const loopRef = useRef<GameLoop | null>(null);
  useEffect(() => {
    if (engineState === null) {
      loopRef.current?.stop();
      loopRef.current = null;
      controllerRef.current?.reset();
      return;
    }
    if (loopRef.current === null) {
      // Defensive reset: ensures a fresh loop starts from clean controller
      // state even if stale held-direction / SDF state appeared by some
      // other path (e.g. key events that fired while no loop existed).
      controllerRef.current?.reset();
      loopRef.current = new GameLoop({
        getEngine: () => engineState,
        acceptedSolutions: drill.acceptedSolutions,
        controller: controllerRef.current!,
        onSnapshot: setSnapshot,
        onPhase: setPhase,
        onMatchResult: setMatchResult,
        onToggleSolution: callbacks.onToggleSolution,
        onResetView: callbacks.onResetView,
        getHandling: () => settingsRef.current.handling,
      });
      loopRef.current.start();
    } else {
      loopRef.current.setEngine(engineState, drill.acceptedSolutions);
      loopRef.current.start();
    }
  }, [
    engineState,
    drill.acceptedSolutions,
    callbacks.onToggleSolution,
    callbacks.onResetView,
  ]);

  // Stop the current loop on unmount. The engine-state effect owns starting
  // and replacing loops because valid drills can appear after invalid ones.
  useEffect(() => {
    return () => {
      loopRef.current?.stop();
      loopRef.current = null;
    };
  }, []);

  // Window event listeners.
  useEffect(() => {
    function isInputElement(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isInputElement(e.target)) return;
      if (callbacks.rebindActiveRef.current) return;
      // No loop => no engine. Ignore the key so controller state cannot
      // diverge from the engine (e.g. stale held direction / SDF state
      // bleeding into the next valid-drill loop).
      if (loopRef.current === null) return;

      const mods = {
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        alt: e.altKey,
        meta: e.metaKey,
      };
      const isGameplayBinding =
        matchAction(settings.keybinds, e.code, mods) !== null;
      const intents = controllerRef.current!.press(e.code, mods);
      if (isGameplayBinding) {
        e.preventDefault();
      }
      if (intents.length > 0) {
        loopRef.current.dispatch(intents);
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      // Mirror handleKeyDown: do not mutate controller state when no loop
      // is running. Keyup must still be safe in that window so stale
      // physical-down entries don't survive into the next loop.
      if (loopRef.current === null) return;

      const mods = {
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        alt: e.altKey,
        meta: e.metaKey,
      };
      const intents = controllerRef.current!.release(e.code, mods);
      if (intents.length > 0) {
        loopRef.current.dispatch(intents);
      }
    }

    function handleBlur() {
      controllerRef.current!.blur();
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [callbacks.rebindActiveRef, settings.keybinds]);

  const reset = useCallback(() => {
    loopRef.current?.reset();
  }, []);
  const undo = useCallback(() => {
    loopRef.current?.undo();
  }, []);

  return { snapshot, phase, matchResult, error, reset, undo };
}
