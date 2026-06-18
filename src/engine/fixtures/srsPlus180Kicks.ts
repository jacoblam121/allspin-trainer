// TETR.IO SRS+ 180 kick fixture.
//
// Primary source (owner-verified manual transcription from the primary image):
//   - Section:  https://tetris.wiki/TETR.IO#180_Kicks
//   - Image:    https://tetris.wiki/images/5/52/TETR.IO_180kicks.png
//   - Filename: File:TETR.IO_180kicks.png
//   - Retrieval date: 2026-06-17
//   - Note: "manual transcription from the primary image; owner-verified."
//
// No OSS source was consulted for this fixture. If one is consulted later for
// verification, note its URL and license here alongside the primary citation.
//
// Coordinate convention: +x right, +y up. Rotation states: 0=North, R=East,
// 2=South, L=West (matches the engine origin frame in plan §6).
//
// The primary image shows a single 4-row table for the four 180 transitions,
// ordered left-to-right Kick 0 through Kick 5. There is NO separate I-piece 180
// table in the primary source; these four transitions apply to all pieces
// (I included). O-piece 180 is a trivial no-op on occupied cells (only the
// rotation state label changes).
//
// Tests in ruleset.test.ts assert specific (dx,dy) values per transition so
// transcription/keying errors are caught.

import type { RotationState } from "../pieces.ts";

export type Kick = { dx: number; dy: number };

export type KickList = ReadonlyArray<Kick>;

export type Transition180 = "0->2" | "2->0" | "R->L" | "L->R";

export const KICKS_180: Record<Transition180, KickList> = {
  // North -> South
  "0->2": [
    { dx: 0, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 1 },
    { dx: -1, dy: 1 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
  ],
  // South -> North
  "2->0": [
    { dx: 0, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: -1, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ],
  // East -> West
  "R->L": [
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 1, dy: 2 },
    { dx: 1, dy: 1 },
    { dx: 0, dy: 2 },
    { dx: 0, dy: 1 },
  ],
  // West -> East
  "L->R": [
    { dx: 0, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: -1, dy: 2 },
    { dx: -1, dy: 1 },
    { dx: 0, dy: 2 },
    { dx: 0, dy: 1 },
  ],
};

// Resolve the 180 transition key from a pair of rotation states. The caller
// passes the from/to states (which differ by 180 degrees); this maps them to
// the fixture key. Returns null if the pair is not a 180 transition.
export function transition180Key(
  from: RotationState,
  to: RotationState,
): Transition180 | null {
  switch (from) {
    case "0":
      return to === "2" ? "0->2" : null;
    case "2":
      return to === "0" ? "2->0" : null;
    case "R":
      return to === "L" ? "R->L" : null;
    case "L":
      return to === "R" ? "L->R" : null;
    default:
      return null;
  }
}
