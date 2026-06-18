import type { PieceId } from "../engine/pieces.ts";
import { PiecePreview } from "./PiecePreview.tsx";

export function HoldQueue({
  hold,
  queue,
}: {
  hold: PieceId | null;
  queue: PieceId[];
}) {
  return (
    <aside className="side-rail">
      <PiecePreview piece={hold} label="Hold" />
      <section className="queue">
        <span className="preview__label">Queue</span>
        <ol className="queue__list">
          {queue.map((piece, i) => (
            <li className="queue__item" key={i}>
              <PiecePreview piece={piece} label="" />
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
