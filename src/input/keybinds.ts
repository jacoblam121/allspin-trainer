// Physical keybind model for the trainer (plan §6.2, §9, §10).
//
// A binding is { code } plus optional modifier flags (ctrl / shift / alt / meta).
// The persisted and runtime form strips false / absent modifiers —
// { ctrl: false } and absent ctrl are equivalent, and validation / save / dedup
// operate on the normalized form (code + the set of modifiers set true).
//
// A plain binding has no modifiers set. A chord binding has at least one
// modifier set. Chord matching uses an exact set match: every modifier the
// chord specifies must be present in the event, and no other modifier may be
// present. Plain bindings match only when the event has no modifiers set.

export type Action =
  | "moveLeft"
  | "moveRight"
  | "softDrop"
  | "hardDrop"
  | "rotateCw"
  | "rotateCcw"
  | "rotate180"
  | "hold"
  | "reset"
  | "undo"
  | "toggleSolution";

// Fixed iteration order for the controller's action precedence lookup
// (plan §6.2). When two actions both have a matching binding for the same
// event, the action earlier in this list wins.
export const ACTIONS: readonly Action[] = [
  "moveLeft",
  "moveRight",
  "softDrop",
  "hardDrop",
  "rotateCw",
  "rotateCcw",
  "rotate180",
  "hold",
  "reset",
  "undo",
  "toggleSolution",
];

export type Modifiers = {
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
};

export type Binding = { code: string } & Modifiers;

export type Keybinds = Record<Action, Binding[]>;

// The set of modifier keys the model knows about, in fixed order for
// deterministic normalization / equality.
const MODIFIER_KEYS = ["ctrl", "shift", "alt", "meta"] as const;
export type ModifierKey = (typeof MODIFIER_KEYS)[number];

function modifierIsTrue(mods: Modifiers, key: ModifierKey): boolean {
  return mods[key] === true;
}

function modifierSet(mods: Modifiers): Set<ModifierKey> {
  const s = new Set<ModifierKey>();
  for (const k of MODIFIER_KEYS) {
    if (modifierIsTrue(mods, k)) {
      s.add(k);
    }
  }
  return s;
}

// Returns the canonical, normalized form of a binding: the code plus only the
// modifiers that are explicitly true. False / absent modifiers are stripped.
// { code: "KeyZ", ctrl: false } -> { code: "KeyZ" }.
// { code: "KeyZ", ctrl: true }  -> { code: "KeyZ", ctrl: true }.
export function normalizeBinding(b: Binding): Binding {
  const out: Binding = { code: b.code };
  for (const k of MODIFIER_KEYS) {
    if (modifierIsTrue(b, k)) {
      out[k] = true;
    }
  }
  return out;
}

export function isChord(b: Binding): boolean {
  for (const k of MODIFIER_KEYS) {
    if (modifierIsTrue(b, k)) {
      return true;
    }
  }
  return false;
}

// Structural equality on the normalized form. Two bindings are equal iff they
// share the same code and the same set of true modifiers. { code: "KeyZ" }
// equals { code: "KeyZ", ctrl: false } after normalization.
export function bindingsEqual(a: Binding, b: Binding): boolean {
  const na = normalizeBinding(a);
  const nb = normalizeBinding(b);
  if (na.code !== nb.code) {
    return false;
  }
  for (const k of MODIFIER_KEYS) {
    const aSet = modifierIsTrue(na, k);
    const bSet = modifierIsTrue(nb, k);
    if (aSet !== bSet) {
      return false;
    }
  }
  return true;
}

// Does this binding match the given physical key + modifier event?
// - Plain binding: matches when the event has no modifiers set.
// - Chord binding: matches when the event's true-modifier set EQUALS the
//   binding's true-modifier set (exact match; extra modifiers in the event
//   disqualify the chord).
export function bindingMatches(
  binding: Binding,
  code: string,
  mods: Modifiers,
): boolean {
  if (binding.code !== code) {
    return false;
  }
  const eventKeys = modifierSet(mods);
  const chordKeys: ModifierKey[] = [];
  for (const k of MODIFIER_KEYS) {
    if (modifierIsTrue(binding, k)) {
      chordKeys.push(k);
    }
  }
  if (chordKeys.length === 0) {
    return eventKeys.size === 0;
  }
  if (chordKeys.length !== eventKeys.size) {
    return false;
  }
  for (const k of chordKeys) {
    if (!eventKeys.has(k)) {
      return false;
    }
  }
  return true;
}

// Resolve a single Action for a (code, mods) event across all bindings in the
// keybinds table. Returns null if no binding matches.
//
// Precedence (plan §6.2):
// - The first matching binding in the ACTIONS order wins. Plain bindings
//   match only plain events (no modifiers); chord bindings match only chord
//   events with an exact modifier set. So a plain event never matches a
//   chord binding and a chord event never matches a plain binding — chord
//   vs plain is determined structurally by the event's modifier set.
// - Within one action, the first matching binding (binding array order) wins.
export function matchAction(
  keybinds: Keybinds,
  code: string,
  mods: Modifiers,
): Action | null {
  for (const action of ACTIONS) {
    const bindings = keybinds[action];
    for (const binding of bindings) {
      if (bindingMatches(binding, code, mods)) {
        return action;
      }
    }
  }
  return null;
}
