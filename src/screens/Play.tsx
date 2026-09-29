import { useState } from 'react';
import { Link } from 'react-router';
import { Board } from '../components/Board';
import { KnowledgeCard } from '../components/KnowledgeCard';
import { Menu } from '../components/Menu';
import { levelPuzzle, useNonogramStore } from '../nonogramStore';

/**
 * Nonograms: one puzzle, laid out for a thumb, with the grid low on the screen and the
 * controls under it. There's no clock and no way to lose, so it can be put down at any
 * moment. Solving it shows one idea worth knowing, then the next level.
 */
export function Play() {
  const level = useNonogramStore((s) => s.level);
  // Subscribed so the grid redraws on every change; play() reads the same state.
  useNonogramStore((s) => s.ladder);
  const play = useNonogramStore((s) => s.play)();
  const stroke = useNonogramStore((s) => s.stroke);
  const undo = useNonogramStore((s) => s.undo);
  const setMode = useNonogramStore((s) => s.setMode);
  const clear = useNonogramStore((s) => s.clear);
  const justSolved = useNonogramStore((s) => s.justSolved);
  const dismissSolved = useNonogramStore((s) => s.dismissSolved);
  const [menu, setMenu] = useState(false);
  // While the card is up, the finished picture stays on screen, moved up above the card.
  const shown = justSolved ? levelPuzzle(justSolved.level) : levelPuzzle(level);
  const shownPlay = justSolved ? { ...play, size: shown.size, marks: justSolved.marks } : play;

  return (
    <main className="screen play">
      <header className="bar">
        <Link className="icon-button" to="/" aria-label="All games">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="bar-title">Level {justSolved?.level ?? level}</h1>
        <button className="icon-button" aria-label="Menu" onClick={() => setMenu(true)}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="5" cy="12" r="1.6" fill="currentColor" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" />
            <circle cx="19" cy="12" r="1.6" fill="currentColor" />
          </svg>
        </button>
      </header>

      {/* Pushes the grid down to where a thumb reaches. */}
      {!justSolved && <div className="spacer" />}

      <Board key={shown.id} puzzle={shown} play={shownPlay} onStroke={justSolved ? () => {} : stroke} />

      <div className="play-controls" hidden={justSolved !== null}>
        <div className="segmented" role="radiogroup" aria-label="What a tap does">
          <button role="radio" aria-checked={play.mode === 'fill'} onClick={() => setMode('fill')}>
            <span className="mode-icon fill" aria-hidden="true" /> Fill
          </button>
          <button role="radio" aria-checked={play.mode === 'cross'} onClick={() => setMode('cross')}>
            <span className="mode-icon cross" aria-hidden="true" /> Cross
          </button>
        </div>
        <button className="icon-button undo" aria-label="Undo" onClick={undo} disabled={play.history.length === 0}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {menu && <Menu onClose={() => setMenu(false)} onClear={clear} canClear={play.history.length > 0} />}

      {justSolved && (
        <div className="overlay clear">
          <div className="panel" role="dialog" aria-label="Solved">
            <p className="solved-title">Level {justSolved.level} solved</p>
            {justSolved.knowledge && <KnowledgeCard id={justSolved.knowledge} />}
            <button className="button primary" onClick={dismissSolved}>
              Next
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
