import { useCallback, useEffect, useRef, useState } from "react";
import mvp1Pack from "./drills/packs/mvp1.json";
import { loadDrillPack } from "./drills/drillLoader.ts";
import type { Drill, DrillPack } from "./drills/drillTypes.ts";
import { Board } from "./ui/Board.tsx";
import { HoldQueue } from "./ui/HoldQueue.tsx";
import { DrillPanel } from "./ui/DrillPanel.tsx";
import { SettingsPanel } from "./ui/SettingsPanel.tsx";
import { useTrainer } from "./ui/useTrainer.ts";
import { DEFAULT_SETTINGS } from "./input/defaultSettings.ts";
import {
  loadSettings,
  saveSettings,
  validateSettings,
  type Settings,
} from "./input/settings.ts";
import type { Handling } from "./input/handling.ts";
import type { Keybinds } from "./input/keybinds.ts";
import { exportVisiblePlayfieldToFumen } from "./fumen/fumenAdapter.ts";

// Bundled pack load. loadDrillPack throws on validation failure; we catch
// here so the rest of the app can render a fatal pack error instead of a
// blank white screen. The catch is intentionally narrow: the loader is
// pure JSON-shape validation, not network I/O.
type PackLoad =
  | { kind: "ok"; drills: DrillPack }
  | { kind: "error"; message: string };

const packLoad: PackLoad = (() => {
  try {
    return { kind: "ok", drills: loadDrillPack(mvp1Pack) };
  } catch (err) {
    return { kind: "error", message: String(err) };
  }
})();

// Settings storage backed by window.localStorage. Created lazily so the
// module can be evaluated in non-browser contexts without throwing.
function browserStorage(): Storage {
  if (typeof window === "undefined") {
    throw new Error("localStorage is not available");
  }
  return window.localStorage;
}

function PackLoadFatal({ message }: { message: string }) {
  return (
    <div className="app">
      <header className="app__header">
        <h1>Allspin Trainer</h1>
        <p className="app__subtitle">MVP 1 — playable drill sandbox</p>
      </header>
      <main className="trainer">
        <div className="board board--error" role="alert">
          <p>
            Bundled drill pack is invalid: <code>{message}</code>
          </p>
        </div>
      </main>
    </div>
  );
}

export function App() {
  if (packLoad.kind === "error") {
    return <PackLoadFatal message={packLoad.message} />;
  }
  // packLoad is "ok" past the guard; narrow for the rest of the component.
  const DRILLS = (packLoad as { kind: "ok"; drills: DrillPack }).drills;

  return <AppInner drills={DRILLS} />;
}

function AppInner({ drills: DRILLS }: { drills: DrillPack }) {
  const [selectedDrillId, setSelectedDrillId] = useState(DRILLS[0].id);
  const [showSolution, setShowSolution] = useState(false);
  const [settings, setSettings] = useState<Settings>(() =>
    typeof window === "undefined"
      ? DEFAULT_SETTINGS
      : loadSettings(browserStorage()),
  );
  const [exportedCode, setExportedCode] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);

  // Ref shared between the hook's keydown handler and the SettingsPanel's
  // rebind mode. The hook reads it; the panel mutates it.
  const rebindActiveRef = useRef<boolean>(false);

  const drill: Drill =
    DRILLS.find((d) => d.id === selectedDrillId) ?? DRILLS[0];

  const onToggleSolution = useCallback(() => {
    setShowSolution((v) => !v);
  }, []);
  const onResetView = useCallback(() => {
    setShowSolution(false);
  }, []);

  const trainer = useTrainer(drill, settings, {
    onToggleSolution,
    onResetView,
    rebindActiveRef,
  });

  // Persist settings to localStorage on change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      saveSettings(browserStorage(), settings);
    } catch {
      // Best-effort: devtools block, quota exceeded, etc.
    }
  }, [settings]);

  function handleSelectDrill(id: string) {
    setSelectedDrillId(id);
    setShowSolution(false);
    // Stale export state must not carry across drill changes: the previous
    // drill's fumen code / error was authored against a different field.
    setExportedCode("");
    setExportError(null);
  }

  function handleReset() {
    trainer.reset();
    // onResetView (called by the loop) hides the solution.
  }

  function handleUndo() {
    trainer.undo();
  }

  function handleToggleSolution() {
    setShowSolution((v) => !v);
  }

  function handleExportFumen() {
    const field = trainer.snapshot?.field ?? null;
    if (field === null) {
      setExportedCode("");
      setExportError("no board to export: drill has no snapshot");
      return;
    }
    const result = exportVisiblePlayfieldToFumen(field);
    if (result.ok) {
      setExportedCode(result.code);
      setExportError(null);
    } else {
      setExportedCode("");
      setExportError(result.reason);
    }
  }

  function updateKeybinds(nextKeybinds: Keybinds) {
    const next: Settings = { ...settings, keybinds: nextKeybinds };
    if (validateSettings(next) === null) {
      // Shouldn't happen — SettingsPanel already prevents cross-action
      // duplicates. Revert silently.
      return;
    }
    setSettings(next);
  }

  function updateHandling(nextHandling: Handling) {
    const next: Settings = { ...settings, handling: nextHandling };
    if (validateSettings(next) === null) return;
    setSettings(next);
  }

  function resetSettings() {
    setSettings(DEFAULT_SETTINGS);
  }

  // Determine banner copy / undo-enabled from phase.
  const phase = trainer.phase;
  const topOut = phase === "topOutUndoable" || phase === "topOutResetOnly";
  const bannerText = topOut
    ? phase === "topOutUndoable"
      ? "Top out — press Undo or Reset to continue"
      : "Top out — press Reset to continue"
    : null;

  return (
    <div className="app">
      <header className="app__header">
        <h1>Allspin Trainer</h1>
        <p className="app__subtitle">MVP 1 — playable drill sandbox</p>
      </header>
      <main className="trainer">
        <div className="trainer__play">
          {trainer.error !== null || trainer.snapshot === null ? (
            <div className="board board--error" role="alert">
              <p>
                Failed to load drill:{" "}
                <code>{trainer.error ?? "no snapshot"}</code>
              </p>
            </div>
          ) : (
            <div className="trainer__board-wrap">
              <Board snapshot={trainer.snapshot} />
              {topOut && bannerText ? (
                <div className="top-out-banner" role="status">
                  {bannerText}
                </div>
              ) : null}
            </div>
          )}
          {trainer.snapshot !== null ? (
            <HoldQueue
              hold={trainer.snapshot.hold}
              queue={trainer.snapshot.queue}
            />
          ) : null}
        </div>
        <DrillPanel
          drills={DRILLS}
          drill={drill}
          selectedDrillId={drill.id}
          onSelectDrill={handleSelectDrill}
          showSolution={showSolution}
          onShowSolution={handleToggleSolution}
          onReset={handleReset}
          onUndo={handleUndo}
          phase={trainer.phase}
          matchResult={trainer.matchResult}
          exportedCode={exportedCode}
          exportError={exportError}
          onExportFumen={handleExportFumen}
        />
        <SettingsPanel
          settings={settings}
          onUpdateKeybinds={updateKeybinds}
          onUpdateHandling={updateHandling}
          onResetSettings={resetSettings}
          rebindActiveRef={rebindActiveRef}
        />
      </main>
    </div>
  );
}
