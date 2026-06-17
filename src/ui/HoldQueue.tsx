import type { Drill } from "../drills/drillTypes.ts";
import { PiecePreview } from "./PiecePreview.tsx";

export function HoldQueue({ drill }: { drill: Drill }) {
  return (
    <aside className="side-rail">
      <PiecePreview piece={drill.active} label="Active" />
      <PiecePreview piece={drill.hold} label="Hold" />
      <section className="queue">
        <span className="preview__label">Queue</span>
        <ol className="queue__list">
          {drill.queue.map((piece, i) => (
            <li className="queue__item" key={i}>
              <PiecePreview piece={piece} label="" />
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
