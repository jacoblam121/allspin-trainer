import type { AcceptedSolution, ExpectedPlacement } from "./drillTypes.ts";

export type SolutionMatchResult =
  | { status: "pending" }
  | { status: "success"; solution: AcceptedSolution }
  | { status: "mismatch" };

function samePlacement(
  actual: ExpectedPlacement,
  expected: ExpectedPlacement,
): boolean {
  return (
    actual.piece === expected.piece &&
    actual.x === expected.x &&
    actual.y === expected.y &&
    actual.rotation === expected.rotation
  );
}

function matchesPrefix(
  history: readonly ExpectedPlacement[],
  placements: readonly ExpectedPlacement[],
): boolean {
  if (history.length > placements.length) {
    return false;
  }
  return history.every((placement, i) =>
    samePlacement(placement, placements[i]),
  );
}

export function matchAcceptedSolution(
  history: readonly ExpectedPlacement[],
  acceptedSolutions: readonly AcceptedSolution[],
): SolutionMatchResult {
  const success = acceptedSolutions.find((solution) =>
    matchesPrefix(solution.placements, history),
  );
  if (success) {
    return { status: "success", solution: success };
  }

  const pending = acceptedSolutions.some((solution) =>
    matchesPrefix(history, solution.placements),
  );
  return pending ? { status: "pending" } : { status: "mismatch" };
}
