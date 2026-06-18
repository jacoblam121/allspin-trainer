import type { Drill } from "../drills/drillTypes.ts";
import type { LoopMatchResult, Phase } from "../loop/gameLoop.ts";

function matchText(matchResult: LoopMatchResult | null): string {
  switch (matchResult?.status) {
    case "success":
      return `Solved: ${matchResult.solution.label}`;
    case "mismatch":
      return "Mismatch";
    case "incomplete":
      return "Incomplete";
    case "pending":
    default:
      return "Pending";
  }
}

export function DrillPanel({
  drills,
  drill,
  selectedDrillId,
  onSelectDrill,
  showSolution,
  onShowSolution,
  onReset,
  onUndo,
  phase,
  matchResult,
}: {
  drills: Drill[];
  drill: Drill;
  selectedDrillId: string;
  onSelectDrill: (id: string) => void;
  showSolution: boolean;
  onShowSolution: () => void;
  onReset: () => void;
  onUndo: () => void;
  phase: Phase;
  matchResult: LoopMatchResult | null;
}) {
  const b2b = drill.b2bActive === true;
  const combo = drill.combo ?? 0;
  const hole = drill.garbageHoleColumn;

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
        <div className="drill-panel__actions">
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
        <div className="meta__row">
          <dt>Ruleset</dt>
          <dd>{drill.ruleset}</dd>
        </div>
      </dl>

      <div className="goal">
        <h3 className="goal__heading">Goal</h3>
        <p className="goal__text">{drill.goal}</p>
      </div>

      <div
        className={`match-feedback match-feedback--${matchResult?.status ?? "pending"}`}
      >
        <h3 className="match-feedback__heading">Route match</h3>
        <p className="match-feedback__text">{matchText(matchResult)}</p>
      </div>

      {drill.source ? (
        <p className="source">
          Source:{" "}
          <a href={drill.source} rel="noreferrer" target="_blank">
            {drill.source}
          </a>
        </p>
      ) : null}

      <div className="solution">
        {showSolution ? (
          <>
            <h3 className="solution__heading">Accepted solution</h3>
            {drill.acceptedSolutions.map((sol) => (
              <div className="solution__entry" key={sol.id}>
                <p className="solution__label">{sol.label}</p>
                <ol className="solution__placements">
                  {sol.placements.map((placement, i) => (
                    <li className="solution__placement" key={i}>
                      {placement.piece} x={placement.x} y={placement.y} r=
                      {placement.rotation}
                    </li>
                  ))}
                </ol>
                <p className="solution__text">{sol.explanation}</p>
              </div>
            ))}
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
            Press “Show solution” to reveal the accepted line and explanation.
          </p>
        )}
      </div>
    </section>
  );
}
