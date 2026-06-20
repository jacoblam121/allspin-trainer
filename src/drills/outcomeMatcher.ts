import { BOARD_WIDTH } from "../engine/constants.ts";
import type { Field } from "../engine/board.ts";
import type { PieceId } from "../engine/pieces.ts";
import type { BoardCell } from "./drillTypes.ts";
import type {
  AcceptedOutcome,
  BoardMaskRow,
  MaskCell,
} from "./drillTypesV2.ts";

export type OutcomeMatchResult =
  | { status: "pending" }
  | { status: "solved"; outcome: AcceptedOutcome }
  | { status: "incomplete" };

function cellMatches(
  cell: BoardCell,
  mask: MaskCell,
  pieceMatches: (cellPiece: PieceId, maskPiece: PieceId) => boolean,
): boolean {
  if (mask === null) {
    return cell === null;
  }
  switch (mask.kind) {
    case "any":
      return true;
    case "occupied":
      return cell !== null;
    case "garbage":
      return cell !== null && cell.kind === "garbage";
    case "filled": {
      if (cell === null || cell.kind !== "filled") return false;
      if (mask.piece === undefined) return true;
      return pieceMatches(cell.piece, mask.piece);
    }
  }
}

function pieceMatchesExact(cellPiece: PieceId, maskPiece: PieceId): boolean {
  return cellPiece === maskPiece;
}

// Match a board mask against a concrete engine field. Mask rows are
// bottom-origin: mask[y] is compared to field[y]. Mask rows above the
// authored mask are don't-care (i.e. the masked rows are a prefix of the
// field). The field is never mutated.
export function matchesBoardMask(field: Field, mask: BoardMaskRow[]): boolean {
  if (mask.length > field.length) return false;
  for (let y = 0; y < mask.length; y++) {
    const row = mask[y];
    const fieldRow = field[y];
    if (row.length !== BOARD_WIDTH) {
      // Defensive: the loader enforces this; runtime should never see
      // otherwise. Treat as no match.
      return false;
    }
    if (fieldRow.length !== BOARD_WIDTH) {
      return false;
    }
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (!cellMatches(fieldRow[x], row[x], pieceMatchesExact)) {
        return false;
      }
    }
  }
  return true;
}

function variantApplies(outcome: AcceptedOutcome, variantId: string): boolean {
  if (outcome.variantIds === undefined) return true;
  return outcome.variantIds.includes(variantId);
}

// Find the first accepted outcome that applies to the current variant and
// whose mask matches the current locked field. Returns null if no outcome
// matches. The field is not mutated.
export function findAcceptedOutcome(
  field: Field,
  outcomes: readonly AcceptedOutcome[],
  variantId: string,
): AcceptedOutcome | null {
  for (const outcome of outcomes) {
    if (!variantApplies(outcome, variantId)) continue;
    if (matchesBoardMask(field, outcome.mask)) {
      return outcome;
    }
  }
  return null;
}
