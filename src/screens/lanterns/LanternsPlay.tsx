import { useState, type CSSProperties } from 'react';
import { Page } from '../../components/Page';
import { SummaryRow } from '../../components/SummaryRow';
import { hint, isSolved, newGame, play, undo, type LanternsGame } from '../../games/lanterns/lanterns';
import { HowTo } from './LanternsHome';
import { loadLanterns, saveLanterns } from './save';

// Lanterns' play screen: the lanterns in the middle, Undo, Hint and Restart under the thumb. A
// tap flips a lantern and the ones beside it, and is saved at once.

export function LanternsPlay() {
  const [{ game, best }, setState] = useState(loadLanterns);
  const [tip, setTip] = useState<number | null>(null);
  const { board } = game;
  const solved = isSolved(game);
  const lit = game.lit.filter(Boolean).length;
  const taps = game.moves.length;

  const update = (next: LanternsGame, nextBest = best) => {
    setState({ game: next, best: nextBest });
    saveLanterns(next, nextBest);
    setTip(null);
  };

  const tap = (cell: number) => {
    if (solved) return;
    const next = play(game, cell);
    // A solved level counts at once, so leaving before Next keeps it.
    update(next, isSolved(next) ? Math.max(best, next.level) : best);
  };

  return (
    <Page title={`Level ${game.level}`} back="/lanterns" game="lanterns">
      <div className="lanterns-play">
        <SummaryRow label={solved ? 'All out!' : `${lit} ${lit === 1 ? 'lantern' : 'lanterns'} lit`} figures={`Fewest ${board.par}${best ? ` · Best level ${best}` : ''}`} title="How to play">
          <HowTo />
        </SummaryRow>

        <div className={solved ? 'lanterns-board solved' : 'lanterns-board'} style={{ '--n': board.size } as CSSProperties} role="grid" aria-label={`Level ${game.level}, ${board.size} by ${board.size}`}>
          {game.lit.map((on, cell) => {
            const classes = ['lanterns-cell'];
            if (on) classes.push('lit');
            if (tip === cell) classes.push('tip');
            return <button key={cell} type="button" className={classes.join(' ')} onClick={() => tap(cell)} disabled={solved} aria-label={on ? 'Lit lantern' : 'Dark lantern'} aria-pressed={on} />;
          })}
        </div>

        <p className="note lanterns-note" aria-live="polite">
          {solved
            ? taps === board.par
              ? `All out in ${taps} taps, the fewest it can be done in.`
              : `All out in ${taps} ${taps === 1 ? 'tap' : 'taps'}. The fewest is ${board.par}.`
            : tip !== null
              ? 'Tap the marked lantern.'
              : taps === 0
                ? 'A tap flips a lantern and the ones beside it. Put them all out.'
                : `${taps} ${taps === 1 ? 'tap' : 'taps'}`}
        </p>

        <div className="spacer" />

        {solved ? (
          <button className="button primary" onClick={() => update(newGame(game.level + 1))}>
            Next level
          </button>
        ) : (
          <div className="lanterns-controls">
            <button className="button" onClick={() => update(undo(game))} disabled={taps === 0}>
              Undo
            </button>
            <button className="button" onClick={() => setTip(hint(game))}>
              Hint
            </button>
            <button className="button" onClick={() => update(newGame(game.level))} disabled={taps === 0}>
              Restart
            </button>
          </div>
        )}
      </div>
    </Page>
  );
}
