import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Page } from '../../components/Page';
import { SummaryRow } from '../../components/SummaryRow';
import { EXIT_ROW, SIZE, hint, isSolved, makeLevel, play, reach, replay, undo, type GridlockGame, type Lot, type Move } from '../../games/gridlock/gridlock';
import { HowTo } from './GridlockHome';
import { loadGridlock, saveGridlock } from './save';

// Gridlock's play screen: the car park in the middle, Undo, Hint and Restart under the thumb.
// Drag a car along its line; a drag is one slide, played when the finger lifts, and saved at once.

/** How many car colours there are (`--gridlock-car-1`…); the red car has its own. */
const CAR_COLOURS = 6;

interface Drag {
  id: number;
  car: number;
  /** Where the finger started, along the car's line, in px. */
  from: number;
  /** One cell's size in px. */
  cell: number;
  lo: number;
  hi: number;
  /** Where the car is drawn now, along its line, in cells (between lo and hi). */
  pos: number;
}

export function GridlockPlay() {
  const [{ game, best }, setState] = useState(loadGridlock);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [tip, setTip] = useState<Move | 'none' | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const nextLot = useRef<{ level: number; lot: Lot } | null>(null);
  const { lot, at } = game;
  const solved = isSolved(game);

  // Make the next level while the solved one is on show, so Next level is instant.
  useEffect(() => {
    if (!solved) return;
    const level = game.level + 1;
    const timer = setTimeout(() => {
      if (nextLot.current?.level !== level) nextLot.current = { level, lot: makeLevel(level) };
    }, 600);
    return () => clearTimeout(timer);
  }, [solved, game.level]);

  const update = (next: GridlockGame, nextBest = best) => {
    setState({ game: next, best: nextBest });
    saveGridlock(next, nextBest);
    setTip(null);
  };

  const along = (car: number, e: PointerEvent) => (lot.cars[car].across ? e.clientX : e.clientY);

  const down = (car: number) => (e: PointerEvent<HTMLSpanElement>) => {
    const board = boardRef.current;
    if (solved || drag || !board) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const [lo, hi] = reach(lot.cars, at, car);
    setDrag({ id: e.pointerId, car, from: along(car, e), cell: board.getBoundingClientRect().width / SIZE, lo, hi, pos: at[car] });
  };

  const move = (e: PointerEvent<HTMLSpanElement>) => {
    if (!drag || drag.id !== e.pointerId) return;
    const pos = Math.min(drag.hi, Math.max(drag.lo, at[drag.car] + (along(drag.car, e) - drag.from) / drag.cell));
    setDrag({ ...drag, pos });
  };

  const up = (e: PointerEvent<HTMLSpanElement>) => {
    if (!drag || drag.id !== e.pointerId) return;
    setDrag(null);
    const to = Math.round(drag.pos);
    if (to === at[drag.car]) return;
    const next = play(game, { car: drag.car, to });
    // A solved level counts at once, so leaving before Next keeps it.
    update(next, isSolved(next) ? Math.max(best, next.level) : best);
  };

  const cancel = () => setDrag(null);

  const nextLevel = () => {
    const level = game.level + 1;
    const ready = nextLot.current?.level === level ? nextLot.current.lot : makeLevel(level);
    nextLot.current = null;
    update(replay(level, [], ready));
  };

  const askHint = () => setTip(hint(game) ?? 'none');
  const shown = tip && tip !== 'none' ? tip : null;

  return (
    <Page title={`Level ${game.level}`} back="/gridlock" game="gridlock">
      <div className="gridlock-play">
        <SummaryRow
          label={solved ? 'Out!' : `${game.moves.length} ${game.moves.length === 1 ? 'move' : 'moves'} · fewest ${lot.par}`}
          figures={best ? `Best level ${best}` : undefined}
          title="How to play"
        >
          <HowTo />
        </SummaryRow>

        <div className={solved ? 'gridlock-frame solved' : 'gridlock-frame'}>
          <span className="gridlock-exit" style={{ '--y': EXIT_ROW } as CSSProperties} aria-hidden="true" />
          <div
            className="gridlock-board"
            ref={boardRef}
            role="application"
            aria-label={`Level ${game.level}: ${lot.cars.length} cars, the red one to drive out on the right`}
          >
            {Array.from({ length: SIZE * SIZE }, (_, i) => (
              <span key={i} className="gridlock-cell" />
            ))}
            {shown && <Car className="gridlock-ghost" car={shown.car} pos={shown.to} lot={lot} />}
            {lot.cars.map((_, i) => {
              const classes = ['gridlock-car'];
              if (i === 0) classes.push('red');
              if (drag?.car === i) classes.push('dragging');
              if (shown?.car === i) classes.push('tip');
              // Once out, the red car drives on through the gap.
              const pos = drag?.car === i ? drag.pos : solved && i === 0 ? SIZE + 1 : at[i];
              return (
                <Car
                  key={i}
                  className={classes.join(' ')}
                  car={i}
                  pos={pos}
                  lot={lot}
                  onPointerDown={down(i)}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerCancel={cancel}
                />
              );
            })}
          </div>
        </div>

        <p className="note gridlock-note" aria-live="polite">
          {solved
            ? game.moves.length <= lot.par
              ? `Out in ${game.moves.length} moves, the fewest there are.`
              : `Out in ${game.moves.length} moves. It can be done in ${lot.par}.`
            : tip === 'none'
              ? 'No way out from here. Undo a few, or start again.'
              : shown
                ? 'Slide that car to the dashed outline.'
                : game.moves.length === 0
                  ? 'Drag a car along its way. Get the red one out on the right.'
                  : ' '}
        </p>

        <div className="spacer" />

        {solved ? (
          <button className="button primary" onClick={nextLevel}>
            Next level
          </button>
        ) : (
          <div className="gridlock-controls">
            <button className="button" onClick={() => update(undo(game))} disabled={game.moves.length === 0}>
              Undo
            </button>
            <button className="button" onClick={askHint}>
              Hint
            </button>
            <button className="button" onClick={() => update(replay(game.level, [], lot))} disabled={game.moves.length === 0}>
              Restart
            </button>
          </div>
        )}
      </div>
    </Page>
  );
}

function Car({ car, pos, lot, className, ...handlers }: { car: number; pos: number; lot: Lot; className: string } & Partial<Record<'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel', (e: PointerEvent<HTMLSpanElement>) => void>>) {
  const c = lot.cars[car];
  const style = {
    '--x': c.across ? pos : c.line,
    '--y': c.across ? c.line : pos,
    '--w': c.across ? c.len : 1,
    '--h': c.across ? 1 : c.len,
    '--car': car === 0 ? 'var(--gridlock-red)' : `var(--gridlock-car-${((car - 1) % CAR_COLOURS) + 1})`,
  } as CSSProperties;
  return (
    <span className={`${className} ${c.across ? 'across' : 'down'}`} style={style} {...handlers}>
      <span className="gridlock-body">{car === 0 && className.includes('gridlock-car') ? '→' : ''}</span>
    </span>
  );
}
