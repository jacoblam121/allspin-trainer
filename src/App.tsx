import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import sourceCatalogJson from "./drills/sourceCatalog.json";
import v2SmokePackJson from "./drills/packs/v2-smoke.json";
import { loadDrillPackV2, loadSourceCatalog } from "./drills/drillLoaderV2.ts";
import {
  playableStartFromVariant,
  type PlayableStart,
} from "./drills/playableStart.ts";
import type {
  DrillPackV2,
  DrillV2,
  SourceCatalog,
} from "./drills/drillTypesV2.ts";
import { Board } from "./ui/Board.tsx";
import { HoldQueue } from "./ui/HoldQueue.tsx";
import { V2DrillPanel } from "./ui/V2DrillPanel.tsx";
import { SettingsPanel } from "./ui/SettingsPanel.tsx";
import { useTrainer } from "./ui/useTrainer.ts";
import type { MatchMode } from "./loop/gameLoop.ts";
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

// Bundled pack load. loadSourceCatalog / loadDrillPackV2 throw on
// validation failure; we catch here so the rest of the app can render a
// fatal pack error instead of a blank white screen. The catch is
// intentionally narrow: the loaders are pure JSON-shape validation, not
// network I/O.
type PackLoad =
  | { kind: "ok"; pack: DrillPackV2; catalog: SourceCatalog }
  | { kind: "error"; message: string };

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
        <p className="app__subtitle">MVP 2 — outcome-based curriculum</p>
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

const packLoad: PackLoad = (() => {
  try {
    const catalog = loadSourceCatalog(sourceCatalogJson);
    const pack = loadDrillPackV2(v2SmokePackJson, catalog);
    return { kind: "ok", pack, catalog };
  } catch (err) {
    return { kind: "error", message: String(err) };
  }
})();

function pickRandomVariantIndex(drill: DrillV2, currentIndex: number): number {
  if (drill.variants.length <= 1) return currentIndex;
  if (drill.variants.length === 2) {
    return currentIndex === 0 ? 1 : 0;
  }
  // 3+ variants: pick uniformly, avoiding the current selection when
  // possible.
  const others: number[] = [];
  for (let i = 0; i < drill.variants.length; i++) {
    if (i !== currentIndex) others.push(i);
  }
  const idx = Math.floor(Math.random() * others.length);
  return others[idx] ?? currentIndex;
}

export function App() {
  if (packLoad.kind === "error") {
    return <PackLoadFatal message={packLoad.message} />;
  }
  // packLoad is "ok" past the guard; narrow for the rest of the component.
  const PACK = (
    packLoad as { kind: "ok"; pack: DrillPackV2; catalog: SourceCatalog }
  ).pack;
  const CATALOG = (
    packLoad as {
      kind: "ok";
      pack: DrillPackV2;
      catalog: SourceCatalog;
    }
  ).catalog;

  return <AppInner pack={PACK} catalog={CATALOG} />;
}

function AppInner({
  pack,
  catalog,
}: {
  pack: DrillPackV2;
  catalog: SourceCatalog;
}) {
  const drills = pack.drills;
  const [selectedDrillId, setSelectedDrillId] = useState(drills[0].id);
  const drill: DrillV2 =
    drills.find((d) => d.id === selectedDrillId) ?? drills[0];
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [runNonce, setRunNonce] = useState(0);
  const variant = drill.variants[selectedVariantIndex] ?? drill.variants[0];
  const variantId = variant?.id ?? drill.variants[0].id;

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

  const onToggleSolution = useCallback(() => {
    setShowSolution((v) => !v);
  }, []);
  const onResetView = useCallback(() => {
    setShowSolution(false);
  }, []);

  // The runtime input shape the trainer consumes.
  const trainerInput = useMemo(() => {
    const start: PlayableStart = variant
      ? playableStartFromVariant(variant)
      : playableStartFromVariant(drill.variants[0]);
    const matchMode: MatchMode = {
      kind: "outcome",
      acceptedOutcomes: drill.acceptedOutcomes,
      variantId: start.id,
    };
    // Key includes drill id + variant id + run nonce so "New variant" /
    // variant switch / drill switch all force a clean reinitialize.
    const key = `${drill.id}|${start.id}|${runNonce}`;
    return { key, start, matchMode };
  }, [drill, variant, runNonce]);

  const trainer = useTrainer(trainerInput, settings, {
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
    setSelectedVariantIndex(0);
    setRunNonce((n) => n + 1);
    setShowSolution(false);
    // Stale export state must not carry across drill changes: the previous
    // drill's fumen code / error was authored against a different field.
    setExportedCode("");
    setExportError(null);
  }

  function handleSelectVariant(id: string) {
    const idx = drill.variants.findIndex((v) => v.id === id);
    if (idx >= 0) {
      setSelectedVariantIndex(idx);
      setRunNonce((n) => n + 1);
      setShowSolution(false);
      setExportedCode("");
      setExportError(null);
    }
  }

  function handleNewVariant() {
    if (drill.variants.length > 1) {
      const next = pickRandomVariantIndex(drill, selectedVariantIndex);
      setSelectedVariantIndex(next);
    }
    // Bumping the run nonce always reinitializes the engine. With one
    // variant, the same variant is replayed under a new run.
    setRunNonce((n) => n + 1);
    setShowSolution(false);
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
        <p className="app__subtitle">MVP 2 — outcome-based curriculum</p>
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
        <V2DrillPanel
          drills={drills}
          drill={drill}
          selectedDrillId={drill.id}
          onSelectDrill={handleSelectDrill}
          variantId={variantId}
          onSelectVariant={handleSelectVariant}
          onNewVariant={handleNewVariant}
          showSolution={showSolution}
          onShowSolution={handleToggleSolution}
          onReset={handleReset}
          onUndo={handleUndo}
          phase={trainer.phase}
          matchResult={trainer.matchResult}
          exportedCode={exportedCode}
          exportError={exportError}
          onExportFumen={handleExportFumen}
          sourceCatalog={catalog}
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
