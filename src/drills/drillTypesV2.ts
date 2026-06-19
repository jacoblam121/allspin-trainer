import type { DrillTemptation, ExpectedPlacement } from "./drillTypes.ts";
import type { PieceId } from "../engine/pieces.ts";
import type { PlayableStart } from "./playableStart.ts";

export type DrillFamily = "all-spin" | "core-tspin" | "stacking" | "decision";

export type DrillVariant = PlayableStart & {
  label: string;
};

export type SourceRef = {
  catalogId: string;
  section?: string;
  page?: number;
};

export type MaskCell =
  | null
  | { kind: "any" }
  | { kind: "occupied" }
  | { kind: "garbage" }
  | { kind: "filled"; piece?: PieceId };

export type BoardMaskRow = MaskCell[];

export type AcceptedOutcome = {
  id: string;
  label: string;
  variantIds?: string[];
  mask: BoardMaskRow[];
  explanation: string;
};

export type SolutionRoute = {
  id: string;
  label: string;
  variantId: string;
  outcomeId: string;
  placements: ExpectedPlacement[];
  explanation: string;
};

export type DrillV2 = {
  id: string;
  title: string;
  category: string;
  family: DrillFamily;
  tags: string[];
  sourceRefs: SourceRef[];
  difficulty?: 1 | 2 | 3 | 4 | 5;
  goal: string;
  variants: DrillVariant[];
  acceptedOutcomes: AcceptedOutcome[];
  solutionRoutes: SolutionRoute[];
  badTemptations?: DrillTemptation[];
};

export type DrillPackV2 = {
  version: 2;
  id: string;
  title: string;
  drills: DrillV2[];
};

export type CatalogPriority = "seed" | "high" | "normal" | "later";

export type CatalogStatus = "playable" | "backlog" | "deferred";

export type CatalogSource = {
  title: string;
  path?: string;
  url?: string;
  section?: string;
  page?: number;
};

export type CatalogEntry = {
  id: string;
  title: string;
  family: DrillFamily;
  source: CatalogSource;
  tags: string[];
  priority: CatalogPriority;
  status: CatalogStatus;
  drillIds: string[];
  notes?: string;
};

export type SourceCatalog = {
  version: 1;
  entries: CatalogEntry[];
};
