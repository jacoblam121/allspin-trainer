// Handling settings (plan §13):
//   das  - ms held before horizontal auto-repeat begins.
//   arr  - ms per horizontal repeat; 0 = instant-to-wall (capped batch every
//          tick after DAS; the engine rejects the wall move without mutating).
//   dcd  - ms delay before horizontal repeats resume after a direction change;
//          0 = resume immediately under normal DAS/ARR. First press from no
//          held key still uses DAS (DCD applies only on a true direction
//          change while a horizontal key is already held).
//   sdf  - cells/sec soft drop; Infinity = drop to floor (engine.hardDrop
//          reposition, no lock) on edge and on every tick while held.
//   gravity - cells/sec automatic fall-only movement; 0 = off.

export type Handling = {
  das: number; // ms, non-negative integer
  arr: number; // ms per repeat, non-negative integer; 0 = instant-to-wall
  dcd: number; // ms, non-negative integer
  sdf: number; // cells/sec, positive number; Infinity = instant to floor
  gravity: number; // cells/sec, finite number in [0, 40]; 0 = off
};

export function isNonNegInt(n: unknown): n is number {
  return (
    typeof n === "number" && Number.isFinite(n) && Number.isInteger(n) && n >= 0
  );
}

export function isFinitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export function isSdf(n: unknown): n is number {
  // Positive finite OR Infinity. JSON.stringify(Infinity) -> "null", so
  // settings.ts normalizes the persisted "infinity" string back to Infinity
  // before validation; by the time we get here, n is the in-memory number.
  if (typeof n !== "number") return false;
  if (!Number.isFinite(n) && n !== Infinity) return false;
  return n > 0;
}

export function isGravity(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 40;
}
