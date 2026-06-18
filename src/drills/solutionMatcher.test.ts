import { describe, expect, it } from "vitest";
import type { AcceptedSolution, ExpectedPlacement } from "./drillTypes.ts";
import { matchAcceptedSolution } from "./solutionMatcher.ts";

const oFloor: ExpectedPlacement = {
  piece: "O",
  x: 4,
  y: 0,
  rotation: "0",
};

const tSlot: ExpectedPlacement = {
  piece: "T",
  x: 3,
  y: 1,
  rotation: "R",
};

function solution(
  id: string,
  placements: ExpectedPlacement[],
): AcceptedSolution {
  return {
    id,
    label: id,
    placements,
    explanation: id,
  };
}

describe("matchAcceptedSolution", () => {
  it("returns pending for a valid prefix", () => {
    expect(
      matchAcceptedSolution([oFloor], [solution("two-step", [oFloor, tSlot])]),
    ).toEqual({ status: "pending" });
  });

  it("returns success for an exact accepted route", () => {
    const accepted = solution("floor", [oFloor]);
    expect(matchAcceptedSolution([oFloor], [accepted])).toEqual({
      status: "success",
      solution: accepted,
    });
  });

  it("mismatches on piece, x, y, rotation, and order", () => {
    const accepted = [solution("route", [oFloor, tSlot])];
    expect(
      matchAcceptedSolution([{ ...oFloor, piece: "T" }], accepted).status,
    ).toBe("mismatch");
    expect(
      matchAcceptedSolution([{ ...oFloor, x: oFloor.x + 1 }], accepted).status,
    ).toBe("mismatch");
    expect(
      matchAcceptedSolution([{ ...oFloor, y: oFloor.y + 1 }], accepted).status,
    ).toBe("mismatch");
    expect(
      matchAcceptedSolution([{ ...oFloor, rotation: "R" }], accepted).status,
    ).toBe("mismatch");
    expect(matchAcceptedSolution([tSlot], accepted).status).toBe("mismatch");
  });

  it("supports multiple accepted routes", () => {
    const routeA = solution("a", [oFloor]);
    const routeB = solution("b", [tSlot]);
    expect(matchAcceptedSolution([tSlot], [routeA, routeB])).toEqual({
      status: "success",
      solution: routeB,
    });
  });

  it("keeps success sticky after extra placements", () => {
    expect(
      matchAcceptedSolution([oFloor, tSlot], [solution("floor", [oFloor])])
        .status,
    ).toBe("success");
  });

  it("rolls back when history is truncated", () => {
    const accepted = [solution("route", [oFloor, tSlot])];
    expect(
      matchAcceptedSolution([oFloor, { ...tSlot, x: 9 }], accepted).status,
    ).toBe("mismatch");
    expect(matchAcceptedSolution([oFloor], accepted).status).toBe("pending");
  });
});
