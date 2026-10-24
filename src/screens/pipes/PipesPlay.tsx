import { useState, type CSSProperties } from 'react';
import { Page } from '../../components/Page';
import { SummaryRow } from '../../components/SummaryRow';
import { DOWN, LEFT, RIGHT, UP, hint, isSolved, leaks, masks, newGame, play, undo, watered, type PipesGame } from '../../games/pipes/pipes';
import { HowTo } from './PipesHome';
import { loadPipes, savePipes } from './save';

// Waterworks' play screen: the pipes in the middle, Undo, Hint and Restart under the thumb. A
// tap turns a tile a quarter clockwise, and is saved at once.

/** Where each open side's pipe ends, on a 10×10 tile. */
const ARMS: [number, string][] = [
  [UP, 'M5 5V0'],
  [RIGHT, 'M5 5H10'],
  [DOWN, 'M5 5V10'],
  [LEFT, 'M5 5H0'],
];

export function PipesPlay() {
  const [{ game, best }, setState] = useState(loadPipes);
  const [tip, setTip] = useState<{ cell: number; taps: number } | null>(null);
  const { board } = game;
  const now = masks(game);
  const wet = watered(board, now);
  const open = leaks(board, now);
  const solved = isSolved(game);
  const dry = wet.filter((w) => !w).length;

  const update = (next: PipesGame, nextBest = best) => {
    setState({ game: next, best: nextBest });
    savePipes(next, nextBest);
    setTip(null);
  };

  const tap = (cell: number) => {
    if (solved) return;
    const next = play(game, cell);
    // A solved level counts at once, so leaving before Next keeps it.
    update(next, isSolved(next) ? Math.max(best, next.level) : best);
  };

  return (
    <Page title={`Level ${game.level}`} back="/pipes" game="pipes">
      <div className="pipes-play">
        <SummaryRow label={solved ? 'Solved!' : dry === 0 ? 'Every tile wet, but a pipe is open' : `${dry} ${dry === 1 ? 'tile' : 'tiles'} still dry`} figures={best ? `Best level ${best}` : undefined} title="How to play">
          <HowTo />
        </SummaryRow>

        <div className={solved ? 'pipes-board solved' : 'pipes-board'} style={{ '--n': board.size } as CSSProperties} role="grid" aria-label={`Level ${game.level}, ${board.size} by ${board.size}`}>
          {board.start.map((mask, cell) => {
            const classes = ['pipes-tile'];
            if (wet[cell]) classes.push('wet');
            if (tip?.cell === cell) classes.push('tip');
            const arms = ARMS.filter(([side]) => mask & side);
            return (
              <button key={cell} type="button" className={classes.join(' ')} onClick={() => tap(cell)} disabled={solved} aria-label={`${wet[cell] ? 'Wet' : 'Dry'} pipe${open[cell] ? ', open' : ''}`}>
                <svg viewBox="0 0 10 10" style={{ transform: `rotate(${game.turns[cell] * 90}deg)` }} aria-hidden="true">
                  {arms.map(([side, d]) => (
                    <path key={side} d={d} className="pipes-pipe" />
                  ))}
                  {cell === board.source ? <circle cx="5" cy="5" r="3.2" className="pipes-spring" /> : arms.length === 1 ? <circle cx="5" cy="5" r="2.3" className="pipes-end" /> : <circle cx="5" cy="5" r="1.4" className="pipes-joint" />}
                </svg>
                {tip?.cell === cell && <span className="pipes-tip">{tip.taps}×</span>}
              </button>
            );
          })}
        </div>

        <p className="note pipes-note" aria-live="polite">
          {solved
            ? `Solved in ${game.moves.length} ${game.moves.length === 1 ? 'tap' : 'taps'}.`
            : tip
              ? `Tap the marked tile ${tip.taps === 1 ? 'once' : `${tip.taps} times`}.`
              : game.moves.length === 0
                ? 'Tap a tile to turn it. Bring water to every tile.'
                : ' '}
        </p>

        <div className="spacer" />

        {solved ? (
          <button className="button primary" onClick={() => update(newGame(game.level + 1))}>
            Next level
          </button>
        ) : (
          <div className="pipes-controls">
            <button className="button" onClick={() => update(undo(game))} disabled={game.moves.length === 0}>
              Undo
            </button>
            <button className="button" onClick={() => setTip(hint(game))}>
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
