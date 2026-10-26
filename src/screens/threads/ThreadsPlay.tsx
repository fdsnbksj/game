import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Page } from '../../components/Page';
import { SummaryRow } from '../../components/SummaryRow';
import { dragTo, fills, hint, isJoined, isSolved, joinedCount, newGame, play, startStroke, undo, withThread, type Stroke, type ThreadsGame } from '../../games/threads/threads';
import { HowTo } from './ThreadsHome';
import { loadThreads, saveThreads } from './save';

// Threads' play screen: the square in the middle, Undo, Hint and Restart under the thumb. Drag
// from a knot to draw; a stroke is played when the finger lifts, and saved at once.

const colour = (c: number) => `var(--threads-${c + 1})`;

export function ThreadsPlay() {
  const [{ game, best }, setState] = useState(loadThreads);
  const [live, setLive] = useState<Stroke | null>(null);
  const drag = useRef<{ id: number; stroke: Stroke } | null>(null);
  const { board } = game;
  const { size } = board;
  const solved = isSolved(game);
  const joined = joinedCount(game);
  const colours = board.knots.length;

  // What to draw: the threads with the stroke under the finger laid over them (cutting what it crosses).
  const paths = live ? withThread(game.paths, live.c, live.path) : game.paths;
  const filled = fills(board, paths);
  const empty = filled.filter((c) => c < 0).length;

  const update = (next: ThreadsGame, nextBest = best) => {
    setState({ game: next, best: nextBest });
    saveThreads(next, nextBest);
  };

  const commit = (stroke: Stroke) => {
    const next = play(game, stroke);
    if (next === game) return;
    // A solved level counts at once, so leaving before Next keeps it.
    update(next, isSolved(next) ? Math.max(best, next.level) : best);
  };

  const cellAt = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * size);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * size);
    return x < 0 || y < 0 || x >= size || y >= size ? -1 : y * size + x;
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (solved || drag.current) return;
    const cell = cellAt(e);
    const stroke = cell < 0 ? null : startStroke(game, cell);
    if (!stroke) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, stroke };
    setLive(stroke);
  };

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const cell = cellAt(e);
    if (cell < 0) return;
    const next = dragTo(board, d.stroke, cell);
    if (next === d.stroke) return;
    d.stroke = next;
    setLive(next);
  };

  const up = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setLive(null);
    commit(d.stroke);
  };

  const cancel = () => {
    drag.current = null;
    setLive(null);
  };

  const askHint = () => {
    const tip = hint(game);
    if (tip) commit(tip);
  };

  return (
    <Page title={`Level ${game.level}`} back="/threads" game="threads">
      <div className="threads-play">
        <SummaryRow label={solved ? 'Solved!' : `${joined} of ${colours} joined`} figures={`${size}×${size}${best ? ` · Best level ${best}` : ''}`} title="How to play">
          <HowTo />
        </SummaryRow>

        <div
          className={solved ? 'threads-board solved' : 'threads-board'}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={cancel}
          role="application"
          aria-label={`Level ${game.level}, ${size} by ${size}: ${joined} of ${colours} pairs joined, ${empty} squares empty`}
        >
          <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
            {filled.map((c, cell) => (
              <rect key={cell} className="threads-cell" x={(cell % size) + 0.04} y={Math.floor(cell / size) + 0.04} width={0.92} height={0.92} rx={0.14} style={c >= 0 ? ({ '--thread': colour(c) } as CSSProperties) : undefined} data-filled={c >= 0 || undefined} />
            ))}
            {paths.map((p, c) =>
              p.length > 1 ? (
                <polyline
                  key={c}
                  className={isJoined(board, c, p) ? 'threads-line joined' : 'threads-line'}
                  points={p.map((cell) => `${(cell % size) + 0.5},${Math.floor(cell / size) + 0.5}`).join(' ')}
                  style={{ '--thread': colour(c) } as CSSProperties}
                />
              ) : null,
            )}
            {board.knots.flatMap(([a, b], c) =>
              [a, b].map((cell) => <circle key={cell} className="threads-knot" cx={(cell % size) + 0.5} cy={Math.floor(cell / size) + 0.5} r={0.33} style={{ '--thread': colour(c) } as CSSProperties} />),
            )}
          </svg>
        </div>

        <p className="note threads-note" aria-live="polite">
          {solved
            ? `Solved in ${game.moves.length} ${game.moves.length === 1 ? 'stroke' : 'strokes'}.`
            : game.moves.length === 0
              ? 'Drag from a knot to its partner. Fill every square.'
              : joined === colours
                ? `All joined, ${empty} ${empty === 1 ? 'square' : 'squares'} empty.`
                : `${empty} ${empty === 1 ? 'square' : 'squares'} still empty.`}
        </p>

        <div className="spacer" />

        {solved ? (
          <button className="button primary" onClick={() => update(newGame(game.level + 1))}>
            Next level
          </button>
        ) : (
          <div className="threads-controls">
            <button className="button" onClick={() => update(undo(game))} disabled={game.moves.length === 0}>
              Undo
            </button>
            <button className="button" onClick={askHint}>
              Hint
            </button>
            <button className="button" onClick={() => update(newGame(game.level))} disabled={game.moves.length === 0}>
              Restart
            </button>
          </div>
        )}
      </div>
    </Page>
  );
}
