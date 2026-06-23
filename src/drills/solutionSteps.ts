import { BOARD_WIDTH, FIELD_HEIGHT } from "../engine/constants.ts";
import {
  type Field,
  cloneField,
  clearLines,
  lockCells,
  normalizeField,
} from "../engine/board.ts";
import { type Coord, cellsOf } from "../engine/tetrominoes.ts";
import { lowestValidY } from "../engine/gameState.ts";
import type { PieceId } from "../engine/pieces.ts";
import type { ExpectedPlacement } from "./drillTypes.ts";
import { matchesBoardMask } from "./outcomeMatcher.ts";
import type {
  AcceptedOutcome,
  DrillVariant,
  SolutionRoute,
} from "./drillTypesV2.ts";

export type SolutionStep = {
  field: Field;
  placement: ExpectedPlacement;
  label: string;
};

export type RoutePieceOrderError = {
  kind: "piece-order-unreachable";
  routeId: string;
  placementIndex: number;
  expected: PieceId;
  active: PieceId | null;
  hold: PieceId | null;
  queueHead: PieceId | null;
  remainingQueue: PieceId[];
};

export type SolutionReplayError =
  | RoutePieceOrderError
  | { kind: "board-too-tall"; variantId: string; rows: number; maxRows: number }
  | { kind: "missing-outcome"; routeId: string; outcomeId: string }
  | {
      kind: "outcome-variant-mismatch";
      routeId: string;
      outcomeId: string;
      variantId: string;
    }
  | {
      kind: "out-of-bounds";
      routeId: string;
      placementIndex: number;
      placement: ExpectedPlacement;
      cell: Coord;
    }
  | {
      kind: "collision";
      routeId: string;
      placementIndex: number;
      placement: ExpectedPlacement;
      cell: Coord;
    }
  | {
      kind: "ungrounded";
      routeId: string;
      placementIndex: number;
      placement: ExpectedPlacement;
      expectedY: number;
    }
  | {
      kind: "outcome-mismatch";
      routeId: string;
      outcomeId: string;
      variantId: string;
    };

export type RoutePieceOrderResult =
  | { ok: true }
  | { ok: false; error: RoutePieceOrderError };

export type SolutionReplayResult =
  | { ok: true; steps: SolutionStep[] }
  | { ok: false; error: SolutionReplayError };

// Validate that a route's placement piece sequence is reachable from the
// variant's authored active / hold / queue using hold rules only. This does
// NOT simulate movement, rotation, or input; it only checks that each route
// piece can be brought to the active slot via at most one hold swap per lock.
//
// Rules (plan §Sprint 3):
// - If active is null before a requested placement, the route is unreachable:
//   the engine's hold() requires a non-null active, so a held piece cannot be
//   brought out after the queue exhausts.
// - If active matches the next route piece, lock it and advance to
//   queue.shift() ?? null.
// - Otherwise, if hold matches, use one hold swap: lock the held piece, put
//   the old active into hold, then advance from the queue.
// - Otherwise, if hold is empty and queue[0] matches, hold the active, play
//   the queue head, then advance from the remaining queue.
// - Otherwise the route is unreachable at this placement.
// - A route may leave unused queue pieces; it only needs to produce the
//   authored placement sequence.
export function validateRoutePieceOrder(
  variant: DrillVariant,
  route: SolutionRoute,
): RoutePieceOrderResult {
  let active: PieceId | null = variant.active;
  let hold: PieceId | null = variant.hold;
  const queue: PieceId[] = [...variant.queue];

  for (let i = 0; i < route.placements.length; i++) {
    const expected = route.placements[i].piece;
    if (active === null) {
      return {
        ok: false,
        error: {
          kind: "piece-order-unreachable",
          routeId: route.id,
          placementIndex: i,
          expected,
          active,
          hold,
          queueHead: queue[0] ?? null,
          remainingQueue: [...queue],
        },
      };
    }
    if (active === expected) {
      active = queue.shift() ?? null;
      continue;
    }
    if (hold === expected) {
      hold = active;
      active = queue.shift() ?? null;
      continue;
    }
    if (hold === null && queue[0] === expected) {
      hold = active;
      queue.shift();
      active = queue.shift() ?? null;
      continue;
    }
    return {
      ok: false,
      error: {
        kind: "piece-order-unreachable",
        routeId: route.id,
        placementIndex: i,
        expected,
        active,
        hold,
        queueHead: queue[0] ?? null,
        remainingQueue: [...queue],
      },
    };
  }
  return { ok: true };
}

function findOutcome(
  outcomes: readonly AcceptedOutcome[],
  outcomeId: string,
): AcceptedOutcome | null {
  for (const o of outcomes) {
    if (o.id === outcomeId) return o;
  }
  return null;
}

function outcomeAppliesToVariant(
  outcome: AcceptedOutcome,
  variantId: string,
): boolean {
  if (outcome.variantIds === undefined) return true;
  return outcome.variantIds.includes(variantId);
}

// Build post-lock, post-clear solution steps for a route by replaying its
// placements from the variant's normalized board. Pure: does not mutate the
// variant, route, or any prior step field. Validates spatial legality
// (bounds, collision, grounded hard-drop position) and piece-order
// reachability before producing steps, then validates the final post-clear
// field against the linked accepted outcome mask.
export function buildSolutionSteps(
  variant: DrillVariant,
  route: SolutionRoute,
  acceptedOutcomes: readonly AcceptedOutcome[],
): SolutionReplayResult {
  if (variant.board.length > FIELD_HEIGHT) {
    return {
      ok: false,
      error: {
        kind: "board-too-tall",
        variantId: variant.id,
        rows: variant.board.length,
        maxRows: FIELD_HEIGHT,
      },
    };
  }

  const outcome = findOutcome(acceptedOutcomes, route.outcomeId);
  if (outcome === null) {
    return {
      ok: false,
      error: {
        kind: "missing-outcome",
        routeId: route.id,
        outcomeId: route.outcomeId,
      },
    };
  }
  if (!outcomeAppliesToVariant(outcome, route.variantId)) {
    return {
      ok: false,
      error: {
        kind: "outcome-variant-mismatch",
        routeId: route.id,
        outcomeId: outcome.id,
        variantId: route.variantId,
      },
    };
  }

  const orderResult = validateRoutePieceOrder(variant, route);
  if (!orderResult.ok) {
    return { ok: false, error: orderResult.error };
  }

  let field = normalizeField(variant.board);
  const steps: SolutionStep[] = [];

  for (let i = 0; i < route.placements.length; i++) {
    const placement = route.placements[i];
    const cells = cellsOf(
      placement.piece,
      placement.rotation,
      placement.x,
      placement.y,
    );

    for (const cell of cells) {
      if (
        cell.x < 0 ||
        cell.x >= BOARD_WIDTH ||
        cell.y < 0 ||
        cell.y >= FIELD_HEIGHT
      ) {
        return {
          ok: false,
          error: {
            kind: "out-of-bounds",
            routeId: route.id,
            placementIndex: i,
            placement,
            cell,
          },
        };
      }
    }

    for (const cell of cells) {
      if (field[cell.y][cell.x] !== null) {
        return {
          ok: false,
          error: {
            kind: "collision",
            routeId: route.id,
            placementIndex: i,
            placement,
            cell,
          },
        };
      }
    }

    const restY = lowestValidY(
      field,
      placement.piece,
      placement.rotation,
      placement.x,
      placement.y,
    );
    if (placement.y !== restY) {
      return {
        ok: false,
        error: {
          kind: "ungrounded",
          routeId: route.id,
          placementIndex: i,
          placement,
          expectedY: restY,
        },
      };
    }

    const workField = cloneField(field);
    lockCells(workField, cells, placement.piece);
    const { field: clearedField } = clearLines(workField);
    steps.push({
      field: cloneField(clearedField),
      placement,
      label: `Step ${i + 1}: ${placement.piece} at (${placement.x}, ${placement.y}) ${placement.rotation}`,
    });
    field = clearedField;
  }

  if (!matchesBoardMask(field, outcome.mask)) {
    return {
      ok: false,
      error: {
        kind: "outcome-mismatch",
        routeId: route.id,
        outcomeId: outcome.id,
        variantId: route.variantId,
      },
    };
  }

  return { ok: true, steps };
}

export function formatSolutionReplayError(error: SolutionReplayError): string {
  switch (error.kind) {
    case "piece-order-unreachable":
      return `Route ${error.routeId}: piece order unreachable at placement ${error.placementIndex}: expected ${error.expected}, active ${error.active ?? "null"}, hold ${error.hold ?? "null"}, queue head ${error.queueHead ?? "null"}, remaining queue [${error.remainingQueue.join(", ")}]`;
    case "board-too-tall":
      return `Variant ${error.variantId}: board has ${error.rows} rows; engine field height is ${error.maxRows}`;
    case "missing-outcome":
      return `Route ${error.routeId}: linked outcome ${error.outcomeId} was not found in accepted outcomes`;
    case "outcome-variant-mismatch":
      return `Route ${error.routeId}: outcome ${error.outcomeId} does not apply to variant ${error.variantId}`;
    case "out-of-bounds":
      return `Route ${error.routeId}: placement ${error.placementIndex} (${error.placement.piece} at (${error.placement.x}, ${error.placement.y}) ${error.placement.rotation}) has a cell out of bounds at (${error.cell.x}, ${error.cell.y})`;
    case "collision":
      return `Route ${error.routeId}: placement ${error.placementIndex} (${error.placement.piece} at (${error.placement.x}, ${error.placement.y}) ${error.placement.rotation}) collides at (${error.cell.x}, ${error.cell.y})`;
    case "ungrounded":
      return `Route ${error.routeId}: placement ${error.placementIndex} (${error.placement.piece} at (${error.placement.x}, ${error.placement.y}) ${error.placement.rotation}) is ungrounded; expected y=${error.expectedY}`;
    case "outcome-mismatch":
      return `Route ${error.routeId}: final field does not match linked outcome ${error.outcomeId} for variant ${error.variantId}`;
  }
}
