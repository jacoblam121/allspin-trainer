import type { BoardCell } from "./drillTypes.ts";
import type { PieceId } from "../engine/pieces.ts";

export type PlayableStart = {
  id: string;
  board: BoardCell[][];
  active: PieceId;
  hold: PieceId | null;
  queue: PieceId[];
  b2bActive?: boolean;
  combo?: number;
  garbageHoleColumn?: number | null;
};

export function playableStartFromVariant(variant: {
  id: string;
  board: BoardCell[][];
  active: PieceId;
  hold: PieceId | null;
  queue: PieceId[];
  b2bActive?: boolean;
  combo?: number;
  garbageHoleColumn?: number | null;
  label: string;
}): PlayableStart {
  const start: PlayableStart = {
    id: variant.id,
    board: variant.board,
    active: variant.active,
    hold: variant.hold,
    queue: variant.queue,
  };
  if (variant.b2bActive !== undefined) start.b2bActive = variant.b2bActive;
  if (variant.combo !== undefined) start.combo = variant.combo;
  if (variant.garbageHoleColumn !== undefined) {
    start.garbageHoleColumn = variant.garbageHoleColumn;
  }
  return start;
}
