export type PieceId = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

export type RotationState = "0" | "R" | "2" | "L";

export const PIECE_IDS: readonly PieceId[] = [
  "I",
  "O",
  "T",
  "S",
  "Z",
  "J",
  "L",
];

export const PIECE_ID_SET: ReadonlySet<PieceId> = new Set(PIECE_IDS);

export function isPieceId(value: unknown): value is PieceId {
  return typeof value === "string" && PIECE_ID_SET.has(value as PieceId);
}

export type PieceGrid = boolean[][];

export const SPAWN_GRID: Record<PieceId, PieceGrid> = {
  I: [[true, true, true, true]],
  O: [
    [true, true],
    [true, true],
  ],
  T: [
    [false, true, false],
    [true, true, true],
  ],
  S: [
    [false, true, true],
    [true, true, false],
  ],
  Z: [
    [true, true, false],
    [false, true, true],
  ],
  J: [
    [true, false, false],
    [true, true, true],
  ],
  L: [
    [false, false, true],
    [true, true, true],
  ],
};
