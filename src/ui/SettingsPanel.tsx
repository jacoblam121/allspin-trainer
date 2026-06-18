import { useCallback, useEffect, useState } from "react";
import {
  ACTIONS,
  bindingsEqual,
  type Action,
  type Binding,
  type Keybinds,
  type Modifiers,
} from "../input/keybinds.ts";
import type { Settings } from "../input/settings.ts";
import type { Handling } from "../input/handling.ts";
import {
  DEFAULT_KEYBINDS,
  DEFAULT_HANDLING,
} from "../input/defaultSettings.ts";

export type SettingsPanelProps = {
  settings: Settings;
  onUpdateKeybinds: (next: Keybinds) => void;
  onUpdateHandling: (next: Handling) => void;
  onResetSettings: () => void;
  // The panel sets this ref to true while in rebind mode. The hook's
  // keydown handler reads it to skip forwarding to the controller.
  rebindActiveRef: React.MutableRefObject<boolean>;
};

const MODIFIER_CODE_PREFIXES = ["Control", "Shift", "Alt", "Meta"] as const;
function isModifierCode(code: string): boolean {
  return MODIFIER_CODE_PREFIXES.some((p) => code.startsWith(p));
}

function bindingKey(b: Binding): string {
  // Stable normalized form for conflict detection.
  const parts: string[] = [b.code];
  if (b.ctrl === true) parts.push("ctrl");
  if (b.shift === true) parts.push("shift");
  if (b.alt === true) parts.push("alt");
  if (b.meta === true) parts.push("meta");
  return parts.join("|");
}

function findCrossActionConflict(
  keybinds: Keybinds,
  ignore: { action: Action; index: number } | null,
  binding: Binding,
): { action: Action } | null {
  const target = bindingKey(binding);
  for (const action of ACTIONS) {
    const arr = keybinds[action];
    for (let i = 0; i < arr.length; i++) {
      if (ignore && ignore.action === action && ignore.index === i) continue;
      if (bindingKey(arr[i]) === target) {
        return { action };
      }
    }
  }
  return null;
}

function codeToLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const map: Record<string, string> = {
    Space: "Space",
    Quote: "'",
    Semicolon: ";",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Backslash: "\\",
    Backspace: "Backspace",
    Enter: "Enter",
    Escape: "Esc",
    Tab: "Tab",
    ArrowLeft: "←",
    ArrowRight: "→",
    ArrowUp: "↑",
    ArrowDown: "↓",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Backquote: "`",
  };
  return map[code] ?? code;
}

function friendlyLabel(b: Binding): string {
  const prefix = [
    b.ctrl === true ? "Ctrl" : null,
    b.shift === true ? "Shift" : null,
    b.alt === true ? "Alt" : null,
    b.meta === true ? "Meta" : null,
  ]
    .filter(Boolean)
    .join("+");
  const codeLabel = codeToLabel(b.code);
  return prefix ? `${prefix}+${codeLabel}` : codeLabel;
}

function actionLabel(action: Action): string {
  const map: Record<Action, string> = {
    moveLeft: "Move Left",
    moveRight: "Move Right",
    softDrop: "Soft Drop",
    hardDrop: "Hard Drop",
    rotateCw: "Rotate CW",
    rotateCcw: "Rotate CCW",
    rotate180: "Rotate 180",
    hold: "Hold",
    reset: "Reset",
    undo: "Undo",
    toggleSolution: "Toggle Solution",
  };
  return map[action];
}

export function SettingsPanel({
  settings,
  onUpdateKeybinds,
  onUpdateHandling,
  onResetSettings,
  rebindActiveRef,
}: SettingsPanelProps) {
  const [rebindAction, setRebindAction] = useState<Action | null>(null);
  const [rebindChipIndex, setRebindChipIndex] = useState<number | null>(null);
  // -1 means "add a new chip"; otherwise index of the existing chip.
  const [heldModifiers, setHeldModifiers] = useState<Modifiers>({});
  const [conflict, setConflict] = useState<{
    binding: Binding;
    action: Action;
  } | null>(null);

  // Handling form local state (synced from props, edited, committed on blur).
  const [dasText, setDasText] = useState(String(settings.handling.das));
  const [arrText, setArrText] = useState(String(settings.handling.arr));
  const [dcdText, setDcdText] = useState(String(settings.handling.dcd));
  const [sdfInf, setSdfInf] = useState(settings.handling.sdf === Infinity);
  const [sdfText, setSdfText] = useState(
    settings.handling.sdf === Infinity ? "60" : String(settings.handling.sdf),
  );
  const [gravityOff, setGravityOff] = useState(settings.handling.gravity === 0);
  const [gravityText, setGravityText] = useState(
    settings.handling.gravity === 0 ? "1" : String(settings.handling.gravity),
  );
  const [handlingError, setHandlingError] = useState<string | null>(null);

  // Re-sync form state if settings change externally (e.g. Reset to
  // defaults). Set-during-render pattern: when the handling prop changes,
  // we re-derive the local form state.
  const [prevHandling, setPrevHandling] = useState(settings.handling);
  if (prevHandling !== settings.handling) {
    setPrevHandling(settings.handling);
    setDasText(String(settings.handling.das));
    setArrText(String(settings.handling.arr));
    setDcdText(String(settings.handling.dcd));
    setSdfInf(settings.handling.sdf === Infinity);
    setSdfText(
      settings.handling.sdf === Infinity ? "60" : String(settings.handling.sdf),
    );
    setGravityOff(settings.handling.gravity === 0);
    setGravityText(
      settings.handling.gravity === 0 ? "1" : String(settings.handling.gravity),
    );
    setHandlingError(null);
  }

  const cancelRebind = useCallback(() => {
    setRebindAction(null);
    setRebindChipIndex(null);
    setHeldModifiers({});
    setConflict(null);
    rebindActiveRef.current = false;
  }, [rebindActiveRef]);

  const attemptCommit = useCallback(
    (binding: Binding) => {
      if (rebindAction === null) return;
      const ignore =
        rebindChipIndex !== null && rebindChipIndex >= 0
          ? { action: rebindAction, index: rebindChipIndex }
          : null;
      const dup = findCrossActionConflict(settings.keybinds, ignore, binding);
      if (dup !== null) {
        setConflict({ binding, action: dup.action });
        return;
      }
      const nextArr =
        rebindChipIndex !== null && rebindChipIndex >= 0
          ? settings.keybinds[rebindAction].map((b, i) =>
              i === rebindChipIndex ? binding : b,
            )
          : [...settings.keybinds[rebindAction], binding];
      const nextKeybinds: Keybinds = {
        ...settings.keybinds,
        [rebindAction]: nextArr,
      };
      onUpdateKeybinds(nextKeybinds);
      cancelRebind();
    },
    [
      rebindAction,
      rebindChipIndex,
      settings.keybinds,
      onUpdateKeybinds,
      cancelRebind,
    ],
  );

  function startRebind(action: Action, chipIndex: number) {
    setRebindAction(action);
    setRebindChipIndex(chipIndex);
    setHeldModifiers({});
    setConflict(null);
    rebindActiveRef.current = true;
  }

  function removeBinding(action: Action, chipIndex: number) {
    const arr = settings.keybinds[action];
    if (arr.length <= 1) return; // can't remove the last binding
    const next = arr.filter((_, i) => i !== chipIndex);
    onUpdateKeybinds({ ...settings.keybinds, [action]: next });
  }

  // Rebind-mode window keydown listener.
  useEffect(() => {
    if (rebindAction === null) return;
    function onKey(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape") {
        cancelRebind();
        return;
      }
      const mods: Modifiers = {
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        alt: e.altKey,
        meta: e.metaKey,
      };
      if (isModifierCode(e.code)) {
        setHeldModifiers(mods);
        return;
      }
      const binding: Binding = { code: e.code, ...mods };
      attemptCommit(binding);
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKey, {
        capture: true,
      } as EventListenerOptions);
    };
  }, [
    rebindAction,
    rebindChipIndex,
    settings.keybinds,
    onUpdateKeybinds,
    attemptCommit,
    cancelRebind,
  ]);

  // Click-outside cancels rebind mode.
  useEffect(() => {
    if (rebindAction === null) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (target && target.closest(".rebind-active")) return;
      cancelRebind();
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [rebindAction, cancelRebind]);

  function resetHandlingForm() {
    setDasText(String(settings.handling.das));
    setArrText(String(settings.handling.arr));
    setDcdText(String(settings.handling.dcd));
    setSdfInf(settings.handling.sdf === Infinity);
    setSdfText(
      settings.handling.sdf === Infinity ? "60" : String(settings.handling.sdf),
    );
    setGravityOff(settings.handling.gravity === 0);
    setGravityText(
      settings.handling.gravity === 0 ? "1" : String(settings.handling.gravity),
    );
  }

  // Commit handling fields on blur / toggle. Invalid input reverts to the
  // persisted settings value and shows a short hint.
  function commitHandling(nextSdfInf = sdfInf, nextGravityOff = gravityOff) {
    const parseNonNegInt = (s: string): number | null => {
      const n = Number(s);
      if (!Number.isInteger(n) || n < 0) return null;
      return n;
    };
    const das = parseNonNegInt(dasText);
    const arr = parseNonNegInt(arrText);
    const dcd = parseNonNegInt(dcdText);
    const gravity = Number(gravityText);
    if (das === null || arr === null || dcd === null) {
      resetHandlingForm();
      setHandlingError("Handling values must be non-negative whole numbers.");
      return;
    }
    if (
      !nextGravityOff &&
      (!Number.isFinite(gravity) || gravity <= 0 || gravity > 40)
    ) {
      resetHandlingForm();
      setHandlingError(
        "Gravity must be greater than 0 and at most 40, or off.",
      );
      return;
    }
    let sdf: number;
    if (nextSdfInf) {
      sdf = Infinity;
    } else {
      const n = Number(sdfText);
      if (!Number.isFinite(n) || n <= 0) {
        resetHandlingForm();
        setHandlingError("SDF must be a positive number or infinity.");
        return;
      }
      sdf = n;
    }
    setHandlingError(null);
    if (
      das === settings.handling.das &&
      arr === settings.handling.arr &&
      dcd === settings.handling.dcd &&
      sdf === settings.handling.sdf &&
      (nextGravityOff ? 0 : gravity) === settings.handling.gravity
    ) {
      return; // no change
    }
    onUpdateHandling({
      das,
      arr,
      dcd,
      sdf,
      gravity: nextGravityOff ? 0 : gravity,
    });
  }

  return (
    <section className="settings-panel">
      <h3 className="settings-panel__heading">Settings</h3>

      <div className="settings-panel__group">
        <h4 className="settings-panel__subheading">Keybinds</h4>
        <ul className="keybind-list">
          {ACTIONS.map((action) => {
            const bindings = settings.keybinds[action];
            const isRebindingThis =
              rebindAction === action && rebindChipIndex !== null;
            return (
              <li className="keybind-row" key={action}>
                <span className="keybind-row__label">
                  {actionLabel(action)}
                </span>
                <div className="keybind-row__chips">
                  {bindings.map((b, i) => {
                    const isThisRebinding =
                      isRebindingThis && rebindChipIndex === i;
                    return (
                      <span
                        key={i}
                        className={
                          isThisRebinding
                            ? "binding-chip binding-chip--rebind rebind-active"
                            : "binding-chip"
                        }
                      >
                        {isThisRebinding ? (
                          <span className="binding-chip__capturing">
                            {heldModifiersLabel(heldModifiers) ||
                              "Press a key..."}
                          </span>
                        ) : (
                          <span className="binding-chip__label">
                            {friendlyLabel(b)}
                          </span>
                        )}
                        <button
                          type="button"
                          className="binding-chip__action rebind-active"
                          onClick={() => startRebind(action, i)}
                          aria-label={`Rebind ${actionLabel(action)}`}
                        >
                          Rebind
                        </button>
                        <button
                          type="button"
                          className="binding-chip__action rebind-active"
                          onClick={() => removeBinding(action, i)}
                          disabled={bindings.length <= 1}
                          aria-label={`Remove binding for ${actionLabel(action)}`}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                  <button
                    type="button"
                    className={
                      isRebindingThis && rebindChipIndex === -1
                        ? "keybind-row__add binding-chip--rebind rebind-active"
                        : "keybind-row__add"
                    }
                    onClick={() => startRebind(action, -1)}
                  >
                    + Add binding
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {conflict ? (
          <p className="keybind-conflict" role="alert">
            Conflict: {friendlyLabel(conflict.binding)} is already bound to{" "}
            {actionLabel(conflict.action)}. Pick a different key or press Esc to
            cancel.
          </p>
        ) : null}
      </div>

      <div className="settings-panel__group">
        <h4 className="settings-panel__subheading">Handling</h4>
        <div className="handling-grid">
          <label className="handling-field">
            <span>DAS (ms)</span>
            <input
              type="number"
              min={0}
              step={1}
              value={dasText}
              onChange={(e) => setDasText(e.target.value)}
              onBlur={() => commitHandling()}
            />
          </label>
          <label className="handling-field">
            <span>ARR (ms)</span>
            <input
              type="number"
              min={0}
              step={1}
              value={arrText}
              onChange={(e) => setArrText(e.target.value)}
              onBlur={() => commitHandling()}
            />
          </label>
          <label className="handling-field">
            <span>DCD (ms)</span>
            <input
              type="number"
              min={0}
              step={1}
              value={dcdText}
              onChange={(e) => setDcdText(e.target.value)}
              onBlur={() => commitHandling()}
            />
          </label>
          <label className="handling-field">
            <span>SDF (cells/sec)</span>
            <span className="handling-field__sdf">
              <input
                type="number"
                min={0.1}
                step={1}
                value={sdfText}
                onChange={(e) => setSdfText(e.target.value)}
                onBlur={() => commitHandling()}
                disabled={sdfInf}
              />
              <label className="handling-field__inf">
                <input
                  type="checkbox"
                  checked={sdfInf}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSdfInf(checked);
                    commitHandling(checked);
                  }}
                />
                <span>∞</span>
              </label>
            </span>
          </label>
          <label className="handling-field">
            <span>Gravity (cells/sec)</span>
            <span className="handling-field__sdf">
              <input
                type="number"
                min={0.1}
                max={40}
                step={0.1}
                value={gravityText}
                onChange={(e) => setGravityText(e.target.value)}
                onBlur={() => commitHandling()}
                disabled={gravityOff}
              />
              <label className="handling-field__inf">
                <input
                  type="checkbox"
                  checked={gravityOff}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setGravityOff(checked);
                    commitHandling(sdfInf, checked);
                  }}
                />
                <span>Off</span>
              </label>
            </span>
          </label>
        </div>
        {handlingError ? (
          <p className="handling-error" role="alert">
            {handlingError}
          </p>
        ) : null}
      </div>

      <div className="settings-panel__group">
        <button
          type="button"
          className="settings-panel__reset"
          onClick={onResetSettings}
        >
          Reset to defaults
        </button>
      </div>
    </section>
  );
}

function heldModifiersLabel(mods: Modifiers): string {
  return [
    mods.ctrl === true ? "Ctrl" : null,
    mods.shift === true ? "Shift" : null,
    mods.alt === true ? "Alt" : null,
    mods.meta === true ? "Meta" : null,
  ]
    .filter(Boolean)
    .join("+");
}

// Silence unused imports.
void DEFAULT_KEYBINDS;
void DEFAULT_HANDLING;
void bindingsEqual;
