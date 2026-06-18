import { SPAWN_GRID } from "../engine/pieces.ts";
import type { PieceId } from "../engine/pieces.ts";

export function PiecePreview({
  piece,
  label,
}: {
  piece: PieceId | null;
  label: string;
}) {
  const grid = piece === null ? null : SPAWN_GRID[piece];
  const cols = grid ? Math.max(...grid.map((r) => r.length)) : 4;
  return (
    <div className="preview">
      <span className="preview__label">{label}</span>
      <div className="preview__box">
        {grid === null ? (
          <div className="preview__empty-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div className="preview__cell" key={i} />
            ))}
          </div>
        ) : (
          <div
            className="preview__grid"
            style={{
              gridTemplateColumns: `repeat(${cols}, var(--preview-cell))`,
            }}
          >
            {grid.flatMap((row, y) =>
              row.map((occupied, x) => (
                <div
                  key={`${x}-${y}`}
                  className={
                    occupied ? `preview__cell piece--${piece}` : "preview__cell"
                  }
                />
              )),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
