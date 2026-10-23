import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Page } from '../../components/Page';
import { SummaryRow } from '../../components/SummaryRow';
import { hint, isOut, isSolved, movesLeft, newGame, play, slide, undo, type Dir, type GlideGame, type Move } from '../../games/glide/glide';
import { HowTo } from './GlideHome';
import { loadGlide, saveGlide } from './save';

// Glide's play screen: the ice in the middle, Undo, Hint and Restart under the thumb. Swipe a
// block to slide it; a swipe is one move, played when the finger lifts, and saved at once.

/** How far a finger must travel, in px, before it counts as a swipe rather than a tap. */
const SWIPE_PX = 16;
const ARROWS: Record<Dir, string> = { up: '↑', right: '→', down: '↓', left: '←' };

export function GlidePlay() {
  const [{ game, best }, setState] = useState(loadGlide);
  const [shake, setShake] = useState<number | null>(null);
  const [tip, setTip] = useState<Move | 'none' | null>(null);
  const swipe = useRef<{ id: number; x: number; y: number; block: number } | null>(null);
  const { board, blocks } = game;
  const solved = isSolved(board, blocks);
  const out = isOut(game);
  const left = movesLeft(game);

  const update = (next: GlideGame, nextBest = best) => {
    setState({ game: next, best: nextBest });
    saveGlide(next, nextBest);
    setTip(null);
  };

  /** The block under a point on the board, or the only block when there's one. */
  const blockAt = (e: PointerEvent<HTMLDivElement>) => {
    if (blocks.length === 1) return 0;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * board.size);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * board.size);
    return blocks.indexOf(y * board.size + x);
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (solved || out || swipe.current) return;
    const block = blockAt(e);
    if (block < 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY, block };
  };

  const up = (e: PointerEvent<HTMLDivElement>) => {
    const start = swipe.current;
    if (!start || start.id !== e.pointerId) return;
    swipe.current = null;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    if (slide(board, blocks, start.block, dir) === blocks[start.block]) {
      setShake(start.block);
      return;
    }
    const next = play(game, { block: start.block, dir });
    // A solved level counts at once, so leaving before Next keeps it.
    update(next, isSolved(next.board, next.blocks) ? Math.max(best, next.level) : best);
  };

  const cancel = () => {
    swipe.current = null;
  };

  const askHint = () => setTip(hint(game) ?? 'none');

  return (
    <Page title={`Level ${game.level}`} back="/glide" game="glide">
      <div className="glide-play">
        <SummaryRow label={solved ? 'Solved!' : `${left} ${left === 1 ? 'move' : 'moves'} left`} figures={best ? `Best level ${best}` : undefined} title="How to play">
          <HowTo />
        </SummaryRow>

        <div
          className="glide-board"
          style={{ '--n': board.size } as CSSProperties}
          onPointerDown={down}
          onPointerUp={up}
          onPointerCancel={cancel}
          role="application"
          aria-label={`Level ${game.level}: ${blocks.length} ${blocks.length === 1 ? 'block' : 'blocks'}, ${left} moves left`}
        >
          {board.walls.map((wall, cell) => {
            const pad = board.pads.indexOf(cell);
            return (
              <span key={cell} className={wall ? 'glide-cell wall' : 'glide-cell'}>
                {pad >= 0 && <span className="glide-pad" style={{ '--block': `var(--glide-${pad + 1})` } as CSSProperties} />}
              </span>
            );
          })}
          {blocks.map((cell, i) => {
            const classes = ['glide-block'];
            if (cell === board.pads[i]) classes.push('home');
            if (shake === i) classes.push('shake');
            if (tip && tip !== 'none' && tip.block === i) classes.push('tip');
            const style = { '--x': cell % board.size, '--y': Math.floor(cell / board.size), '--block': `var(--glide-${i + 1})` } as CSSProperties;
            // Sitting on another block's ring: show that ring on top, so it's never hidden.
            const covered = board.pads.indexOf(cell);
            return (
              <span key={i} className={classes.join(' ')} style={style} onAnimationEnd={() => setShake(null)}>
                <span className="glide-face">
                  {covered >= 0 && covered !== i && <span className="glide-pad covered" style={{ '--block': `var(--glide-${covered + 1})` } as CSSProperties} />}
                  {tip && tip !== 'none' && tip.block === i ? ARROWS[tip.dir] : cell === board.pads[i] ? '✓' : ''}
                </span>
              </span>
            );
          })}
        </div>

        <p className="note glide-note" aria-live="polite">
          {solved
            ? `Solved in ${game.moves.length} ${game.moves.length === 1 ? 'move' : 'moves'}.`
            : out
              ? 'Out of moves. Undo, or start again.'
              : tip === 'none'
                ? 'No way home in the moves left. Undo a few, or start again.'
                : tip
                  ? 'Swipe that block the way of the arrow.'
                  : game.moves.length === 0
                    ? 'Swipe a block. It slides until something stops it.'
                    : ' '}
        </p>

        <div className="spacer" />

        {solved ? (
          <button className="button primary" onClick={() => update(newGame(game.level + 1))}>
            Next level
          </button>
        ) : (
          <div className="glide-controls">
            <button className="button" onClick={() => update(undo(game))} disabled={game.moves.length === 0}>
              Undo
            </button>
            <button className="button" onClick={askHint} disabled={out}>
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
