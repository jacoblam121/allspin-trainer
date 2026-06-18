import type { PieceId, RotationState } from "../engine/pieces.ts";

export type RulesetId = "tetrio-default";

export type BoardCell =
  | null
  | { kind: "garbage" }
  | { kind: "filled"; piece: PieceId };

export type ExpectedPlacement = {
  piece: PieceId;
  x: number;
  y: number;
  rotation: RotationState;
};

export type AcceptedSolution = {
  id: string;
  label: string;
  placements: ExpectedPlacement[];
  explanation: string;
};

export type DrillTemptation = {
  label: string;
  placements?: ExpectedPlacement[];
  explanation: string;
};

export type Drill = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  source?: string;
  ruleset: RulesetId;
  board: BoardCell[][];
  active: PieceId;
  hold: null;
  queue: PieceId[];
  b2bActive?: boolean;
  combo?: number;
  garbageHoleColumn?: number | null;
  goal: string;
  acceptedSolutions: AcceptedSolution[];
  badTemptations?: DrillTemptation[];
  fumen?: string;
};

export type DrillPack = Drill[];
