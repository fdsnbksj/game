import { useState, type CSSProperties } from 'react';
import { Page } from '../../components/Page';
import { SummaryRow } from '../../components/SummaryRow';
import { CAPACITY, hint, isSolved, isStuck, newGame, play, pourCount, topRun, undo, type BeadsGame, type Move } from '../../games/beads/beads';
import { HowTo } from './BeadsHome';
import { loadBeads, saveBeads } from './save';

// Bead Sort's play screen: the tubes in the middle, and Undo, Hint and Restart under the
// thumb. Tap a tube to lift its top beads, tap another to drop them; every move is saved.

export function BeadsPlay() {
  const [{ game, best }, setState] = useState(loadBeads);
  const [picked, setPicked] = useState<number | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const [tip, setTip] = useState<Move | 'none' | null>(null);
  const solved = isSolved(game.tubes);
  const stuck = isStuck(game.tubes);

  const update = (next: BeadsGame, nextBest = best) => {
    setState({ game: next, best: nextBest });
    saveBeads(next, nextBest);
    setPicked(null);
    setTip(null);
  };

  const tap = (i: number) => {
    if (solved) return;
    if (picked === null) {
      if (game.tubes[i].length > 0) setPicked(i);
      return;
    }
    if (picked === i) {
      setPicked(null);
      return;
    }
    if (pourCount(game.tubes, picked, i) > 0) {
      const next = play(game, { from: picked, to: i });
      // A sorted level counts at once, so leaving before Next keeps it.
      update(next, isSolved(next.tubes) ? Math.max(best, next.level) : best);
      return;
    }
    // Not allowed there: pick this tube up instead, or shake if there's nothing to pick.
    if (game.tubes[i].length > 0) setPicked(i);
    else {
      setShake(i);
      setPicked(null);
    }
  };

  const askHint = () => {
    const move = hint(game.tubes);
    setPicked(null);
    setTip(move ?? 'none');
  };

  const rows = game.tubes.length > 7 ? 2 : 1;
  const perRow = Math.ceil(game.tubes.length / rows);

  return (
    <Page title={`Level ${game.level}`} back="/beads" game="beads">
      <div className="beads-play">
        <SummaryRow label={solved ? 'Sorted!' : `${game.moves.length} ${game.moves.length === 1 ? 'move' : 'moves'}`} figures={best ? `Best level ${best}` : undefined} title="How to play">
          <HowTo />
        </SummaryRow>

        <div className="beads-shelf" style={{ '--per-row': perRow } as CSSProperties}>
          {game.tubes.map((tube, i) => {
            const lift = picked === i ? topRun(tube) : 0;
            const classes = ['beads-tube'];
            if (picked === i) classes.push('picked');
            if (shake === i) classes.push('shake');
            if (tip && tip !== 'none' && tip.from === i) classes.push('tip-from');
            if (tip && tip !== 'none' && tip.to === i) classes.push('tip-to');
            if (tube.length === CAPACITY && topRun(tube) === CAPACITY) classes.push('done');
            return (
              <button key={i} className={classes.join(' ')} onClick={() => tap(i)} onAnimationEnd={() => setShake(null)} aria-label={`Tube ${i + 1}: ${tube.length} beads`}>
                {tube.map((colour, b) => (
                  <span key={b} className={b >= tube.length - lift ? 'bead lifted' : 'bead'} style={{ '--bead': `var(--beads-${colour + 1})`, '--slot': b } as CSSProperties} />
                ))}
              </button>
            );
          })}
        </div>

        <p className="note beads-note" aria-live="polite">
          {solved
            ? `Sorted in ${game.moves.length} moves.`
            : tip === 'none'
              ? 'No way on from here. Undo a few moves, or start again.'
              : stuck
                ? 'No moves left. Undo, or start again.'
                : picked !== null
                  ? 'Now tap where they go.'
                  : tip
                    ? `Try tube ${tip.from + 1} to tube ${tip.to + 1}.`
                    : 'Tap a tube to pick up its top beads.'}
        </p>

        <div className="spacer" />

        {solved ? (
          <button className="button primary" onClick={() => update(newGame(game.level + 1))}>
            Next level
          </button>
        ) : (
          <div className="beads-controls">
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
