import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { column, row } from '../nonogram/clues';
import type { Nonogram } from '../nonogram/generate';
import { lineDone, strokeTarget, type Mark, type PlayState } from '../nonogram/play';

/** A drag in progress: where it started, where the finger is, and what it paints. */
interface Drag {
  first: number;
  cells: number[];
  target: Mark;
}

/**
 * The grid with its clues. Tap a cell to mark it; drag to mark a straight line of them.
 * Nothing is committed until the finger lifts, so a slip can be dragged back.
 */
export function Board({ puzzle, play, onStroke }: { puzzle: Nonogram; play: PlayState; onStroke: (cells: number[]) => void }) {
  const { size } = puzzle;
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  // What the grid shows: the saved marks, with the drag laid over them.
  const marks = [...play.marks];
  if (drag) for (const cell of drag.cells) marks[cell] = drag.target;

  const cellAt = (event: PointerEvent) => {
    const box = gridRef.current!.getBoundingClientRect();
    const clamp = (n: number) => Math.max(0, Math.min(size - 1, n));
    const c = clamp(Math.floor(((event.clientX - box.left) / box.width) * size));
    const r = clamp(Math.floor(((event.clientY - box.top) / box.height) * size));
    return r * size + c;
  };

  /** The cells from the first one to `to`, along whichever of its row or column is closer. */
  const lineTo = (first: number, to: number) => {
    const [r0, c0] = [Math.floor(first / size), first % size];
    const [r1, c1] = [Math.floor(to / size), to % size];
    const across = Math.abs(c1 - c0) >= Math.abs(r1 - r0);
    const length = across ? Math.abs(c1 - c0) : Math.abs(r1 - r0);
    const step = across ? Math.sign(c1 - c0) : Math.sign(r1 - r0) * size;
    return Array.from({ length: length + 1 }, (_, i) => first + i * step);
  };

  // The drag lives in a ref too: a quick tap can lift before React re-renders, and the
  // handlers must see the stroke it started.
  const dragRef = useRef<Drag | null>(null);
  const update = (next: Drag | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (dragRef.current || !event.isPrimary) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const first = cellAt(event);
    update({ first, cells: [first], target: strokeTarget(play, first) });
  };

  const onPointerMove = (event: PointerEvent) => {
    const current = dragRef.current;
    if (!current || !event.isPrimary) return;
    const cells = lineTo(current.first, cellAt(event));
    if (cells.length !== current.cells.length || cells.at(-1) !== current.cells.at(-1)) update({ ...current, cells });
  };

  const onPointerUp = (event: PointerEvent) => {
    const current = dragRef.current;
    if (!current || !event.isPrimary) return;
    update(null);
    onStroke(current.cells);
  };

  const lines = Array.from({ length: size }, (_, i) => i);
  const indices = Array.from({ length: size * size }, (_, i) => i);
  const rowDone = lines.map((r) => lineDone(marks, puzzle.rows[r], row(indices, size, r)));
  const colDone = lines.map((c) => lineDone(marks, puzzle.cols[c], column(indices, size, c)));
  // The line under the finger, so its clues are easy to find.
  const focus = drag ? drag.cells.at(-1)! : null;
  const focusRow = focus === null ? -1 : Math.floor(focus / size);
  const focusCol = focus === null ? -1 : focus % size;

  return (
    <div className="board" style={{ '--n': size } as CSSProperties}>
      <div className="clues cols" aria-hidden="true">
        {puzzle.cols.map((clue, c) => (
          <span key={c} className={clueClass(colDone[c], c === focusCol)}>
            {(clue.length ? clue : [0]).map((n, i) => (
              <b key={i}>{n}</b>
            ))}
          </span>
        ))}
      </div>
      <div className="clues rows" aria-hidden="true">
        {puzzle.rows.map((clue, r) => (
          <span key={r} className={clueClass(rowDone[r], r === focusRow)}>
            {(clue.length ? clue : [0]).map((n, i) => (
              <b key={i}>{n}</b>
            ))}
          </span>
        ))}
      </div>
      <div
        ref={gridRef}
        className="cells"
        role="grid"
        aria-label={`${size} by ${size} puzzle`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => update(null)}
      >
        {marks.map((mark, i) => (
          <span key={i} className={cellClass(mark, i, size)} />
        ))}
      </div>
    </div>
  );
}

const clueClass = (done: boolean, focused: boolean) => ['clue', done && 'done', focused && 'focus'].filter(Boolean).join(' ');

/** Heavier lines every five cells, so big grids are easy to count. */
function cellClass(mark: Mark, i: number, size: number) {
  const r = Math.floor(i / size);
  const c = i % size;
  return [
    'cell',
    mark === 1 && 'filled',
    mark === 2 && 'crossed',
    c % 5 === 4 && c < size - 1 && 'edge-r',
    r % 5 === 4 && r < size - 1 && 'edge-b',
  ]
    .filter(Boolean)
    .join(' ');
}

/** A small, still picture of a grid: the Home card and the solved card. */
export function MiniGrid({ size, marks, px = 96 }: { size: number; marks: readonly Mark[]; px?: number }) {
  return (
    <span className="mini-grid" style={{ '--n': size, width: px, height: px } as CSSProperties} aria-hidden="true">
      {marks.map((mark, i) => (
        <span key={i} className={mark === 1 ? 'on' : undefined} />
      ))}
    </span>
  );
}
