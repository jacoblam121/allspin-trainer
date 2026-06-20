import { useState } from "react";
import type {
  DrillV2,
  SolutionRoute,
  SourceRef,
} from "../drills/drillTypesV2.ts";
import type { CatalogEntry, SourceCatalog } from "../drills/drillTypesV2.ts";
import type { LoopMatchResult, Phase } from "../loop/gameLoop.ts";

function matchText(matchResult: LoopMatchResult | null): string {
  switch (matchResult?.status) {
    case "solved":
      return `Solved: ${matchResult.outcome.label}`;
    case "incomplete":
      return "Incomplete";
    case "pending":
    default:
      return "Pending";
  }
}

function matchStatus(matchResult: LoopMatchResult | null): string {
  return matchResult?.status ?? "pending";
}

function lookupCatalog(
  catalog: SourceCatalog,
  ref: SourceRef,
): CatalogEntry | null {
  return catalog.entries.find((e) => e.id === ref.catalogId) ?? null;
}

function routesForVariant(drill: DrillV2, variantId: string): SolutionRoute[] {
  return drill.solutionRoutes.filter((r) => r.variantId === variantId);
}

export function V2DrillPanel({
  drills,
  drill,
  selectedDrillId,
  onSelectDrill,
  variantId,
  onSelectVariant,
  onNewVariant,
  showSolution,
  onShowSolution,
  onReset,
  onUndo,
  phase,
  matchResult,
  exportedCode,
  exportError,
  onExportFumen,
  sourceCatalog,
}: {
  drills: DrillV2[];
  drill: DrillV2;
  selectedDrillId: string;
  onSelectDrill: (id: string) => void;
  variantId: string;
  onSelectVariant: (id: string) => void;
  onNewVariant: () => void;
  showSolution: boolean;
  onShowSolution: () => void;
  onReset: () => void;
  onUndo: () => void;
  phase: Phase;
  matchResult: LoopMatchResult | null;
  exportedCode: string;
  exportError: string | null;
  onExportFumen: () => void;
  sourceCatalog: SourceCatalog;
}) {
  const variant =
    drill.variants.find((v) => v.id === variantId) ?? drill.variants[0];
  const b2b = variant?.b2bActive === true;
  const combo = variant?.combo ?? 0;
  const hole = variant?.garbageHoleColumn;
  const routes = variant ? routesForVariant(drill, variant.id) : [];

  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">(
    "idle",
  );

  // Reset copy status whenever the export output or error changes (new export,
  // variant / drill change, or error). Uses the set-state-during-render
  // pattern (with a prev-state guard) per the same Sprint 3B pattern used by
  // the legacy DrillPanel.
  const [prevExportState, setPrevExportState] = useState({
    code: exportedCode,
    error: exportError,
  });
  if (
    exportedCode !== prevExportState.code ||
    exportError !== prevExportState.error
  ) {
    setPrevExportState({ code: exportedCode, error: exportError });
    setCopyState("idle");
  }

  async function handleCopy() {
    if (exportedCode === "") return;
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard !== undefined &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      try {
        await navigator.clipboard.writeText(exportedCode);
        setCopyState("copied");
        return;
      } catch {
        // Fall through to manual-copy guidance.
      }
    }
    setCopyState("manual");
  }

  return (
    <section className="drill-panel">
      <div className="drill-panel__bar">
        <label className="drill-select">
          <span className="drill-select__label">Drill</span>
          <select
            value={selectedDrillId}
            onChange={(e) => onSelectDrill(e.target.value)}
          >
            {drills.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </label>
        {drill.variants.length > 1 ? (
          <label className="drill-select">
            <span className="drill-select__label">Variant</span>
            <select
              value={variant?.id ?? ""}
              onChange={(e) => onSelectVariant(e.target.value)}
            >
              {drill.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="drill-panel__actions">
          <button type="button" onClick={onNewVariant}>
            New variant
          </button>
          <button type="button" onClick={onShowSolution}>
            {showSolution ? "Hide solution" : "Show solution"}
          </button>
          <button
            type="button"
            onClick={onUndo}
            disabled={phase === "topOutResetOnly"}
            title={
              phase === "topOutResetOnly"
                ? "Undo unavailable: this top-out pushed no history. Press Reset."
                : undefined
            }
          >
            Undo
          </button>
          <button
            type="button"
            className="drill-panel__reset"
            onClick={onReset}
          >
            Reset
          </button>
        </div>
      </div>

      <h2 className="drill-panel__title">{drill.title}</h2>
      <p className="drill-panel__category">{drill.category}</p>

      <ul className="tags">
        {drill.tags.map((tag) => (
          <li className="tags__item" key={tag}>
            {tag}
          </li>
        ))}
      </ul>

      <dl className="meta">
        <div className="meta__row">
          <dt>Family</dt>
          <dd>{drill.family}</dd>
        </div>
        <div className="meta__row">
          <dt>Variant</dt>
          <dd>{variant?.label ?? "—"}</dd>
        </div>
        <div className="meta__row">
          <dt>B2B</dt>
          <dd>{b2b ? "active" : "inactive"}</dd>
        </div>
        <div className="meta__row">
          <dt>Combo</dt>
          <dd>{combo}</dd>
        </div>
        <div className="meta__row">
          <dt>Garbage hole</dt>
          <dd>
            {hole === null || hole === undefined ? "none" : `col ${hole}`}
          </dd>
        </div>
      </dl>

      <div className="goal">
        <h3 className="goal__heading">Goal</h3>
        <p className="goal__text">{drill.goal}</p>
      </div>

      <div
        className={`match-feedback match-feedback--${matchStatus(matchResult)}`}
      >
        <h3 className="match-feedback__heading">Outcome match</h3>
        <p className="match-feedback__text">{matchText(matchResult)}</p>
      </div>

      {drill.sourceRefs.length > 0 ? (
        <div className="source">
          <h4 className="solution__subheading">Sources</h4>
          <ul className="tags">
            {drill.sourceRefs.map((ref) => {
              const entry = lookupCatalog(sourceCatalog, ref);
              if (entry === null) {
                return (
                  <li className="tags__item" key={ref.catalogId}>
                    {ref.catalogId} (missing)
                  </li>
                );
              }
              const label = entry.source.title;
              if (entry.source.url !== undefined) {
                return (
                  <li
                    className="tags__item"
                    key={`${entry.id}-${ref.section ?? ""}`}
                  >
                    <a href={entry.source.url} rel="noreferrer" target="_blank">
                      {label}
                    </a>
                  </li>
                );
              }
              if (entry.source.path !== undefined) {
                return (
                  <li
                    className="tags__item"
                    key={`${entry.id}-${ref.section ?? ""}`}
                  >
                    {label}
                  </li>
                );
              }
              return (
                <li
                  className="tags__item"
                  key={`${entry.id}-${ref.section ?? ""}`}
                >
                  {label}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="solution">
        {showSolution ? (
          <>
            <h3 className="solution__heading">Routes for this variant</h3>
            {routes.length === 0 ? (
              <p className="solution__text">
                No authored routes for the current variant.
              </p>
            ) : (
              routes.map((route) => (
                <div className="solution__entry" key={route.id}>
                  <p className="solution__label">{route.label}</p>
                  <ol className="solution__placements">
                    {route.placements.map((placement, i) => (
                      <li className="solution__placement" key={i}>
                        {placement.piece} x={placement.x} y={placement.y} r=
                        {placement.rotation}
                      </li>
                    ))}
                  </ol>
                  <p className="solution__text">{route.explanation}</p>
                </div>
              ))
            )}
            {drill.badTemptations && drill.badTemptations.length > 0 ? (
              <h4 className="solution__subheading">Avoid</h4>
            ) : null}
            {drill.badTemptations?.map((t, i) => (
              <div className="solution__entry solution__entry--bad" key={i}>
                <p className="solution__label">{t.label}</p>
                <p className="solution__text">{t.explanation}</p>
              </div>
            ))}
          </>
        ) : (
          <p className="solution__hidden">
            Press “Show solution” to reveal authored routes for this variant.
          </p>
        )}
      </div>

      <div className="tools">
        <h3 className="tools__heading">Tools</h3>
        <div className="tools__row">
          <button type="button" onClick={onExportFumen}>
            Export fumen
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={exportedCode === ""}
          >
            Copy code
          </button>
        </div>
        <textarea
          className="tools__output"
          value={exportedCode}
          readOnly
          placeholder="Click 'Export fumen' to generate a code for the current locked board."
          spellCheck={false}
          rows={3}
        />
        {copyState === "copied" ? (
          <p className="tools__copy-status" role="status">
            Copied to clipboard.
          </p>
        ) : null}
        {copyState === "manual" ? (
          <p className="tools__copy-status" role="status">
            Copy unavailable: select and copy the code above manually.
          </p>
        ) : null}
        {exportError !== null ? (
          <p className="tools__error" role="alert">
            Export failed: {exportError}
          </p>
        ) : null}
      </div>
    </section>
  );
}
