import { Link, useNavigate } from 'react-router';
import { Board, MiniGrid } from '../components/Board';
import { SettingsButton } from '../components/SettingsSheet';
import { puzzleFor, useNonogramStore, type Which } from '../nonogramStore';
import { dayId } from '../shared/constants';

/**
 * One puzzle, laid out for a thumb: the grid low on the screen, the controls under it.
 * There's no clock and no way to lose, so it can be put down at any moment.
 */
export function Play({ which }: { which: Which }) {
  const navigate = useNavigate();
  const level = useNonogramStore((s) => s.level);
  // Subscribed so the grid redraws on every change; playOf reads the same state.
  useNonogramStore((s) => (which === 'ladder' ? s.ladder : s.daily));
  const play = useNonogramStore((s) => s.playOf)(which);
  const stroke = useNonogramStore((s) => s.stroke);
  const undo = useNonogramStore((s) => s.undo);
  const setMode = useNonogramStore((s) => s.setMode);
  const clear = useNonogramStore((s) => s.clear);
  const justSolved = useNonogramStore((s) => s.justSolved);
  const dismissSolved = useNonogramStore((s) => s.dismissSolved);
  const day = dayId();
  const dailyDone = useNonogramStore((s) => s.dailySolved.includes(day));
  const puzzle = puzzleFor(which, level, day);

  if (which === 'daily' && dailyDone && !justSolved) {
    return (
      <main className="screen center">
        <div className="glass splash-card">
          <p className="lead center-text">Today's puzzle is solved.</p>
          <p className="note center-text">A new one arrives at 00:00 UTC.</p>
          <Link className="button primary" to="/">
            Done
          </Link>
        </div>
      </main>
    );
  }

  const title = which === 'ladder' ? `Level ${level}` : "Today's puzzle";
  return (
    <main className="screen play">
      <header className="play-head">
        <Link className="icon-button" to="/" aria-label="Home">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="play-title">
          <strong>{title}</strong>
          <span className="micro">
            {puzzle.size}×{puzzle.size}
          </span>
        </div>
        <SettingsButton>
          <button className="button danger" onClick={() => clear(which)} disabled={play.history.length === 0}>
            Clear this grid
          </button>
        </SettingsButton>
      </header>

      {/* Pushes the grid down to where a thumb reaches. */}
      <div className="spacer" />

      <Board key={puzzle.id} puzzle={puzzle} play={play} onStroke={(cells) => stroke(which, cells)} />

      <div className="play-controls">
        <div className="segmented mode-switch" role="radiogroup" aria-label="What a tap does">
          <button role="radio" aria-checked={play.mode === 'fill'} onClick={() => setMode(which, 'fill')}>
            <span className="mode-icon fill" aria-hidden="true" /> Fill
          </button>
          <button role="radio" aria-checked={play.mode === 'cross'} onClick={() => setMode(which, 'cross')}>
            <span className="mode-icon cross" aria-hidden="true" /> Cross
          </button>
        </div>
        <button className="icon-button undo" aria-label="Undo" onClick={() => undo(which)} disabled={play.history.length === 0}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {justSolved && (
        <div className="overlay">
          <div className="panel solved-panel" role="dialog" aria-label="Solved">
            <MiniGrid size={justSolved.size} marks={justSolved.marks} px={120} />
            <p className="big-score">Solved</p>
            <p className="note">{justSolved.title}</p>
            {justSolved.which === 'ladder' ? (
              <>
                <button className="button primary big" onClick={dismissSolved}>
                  Next puzzle
                </button>
                <button
                  className="button ghost"
                  onClick={() => {
                    dismissSolved();
                    navigate('/');
                  }}
                >
                  Back to my book
                </button>
              </>
            ) : (
              <button
                className="button primary big"
                onClick={() => {
                  dismissSolved();
                  navigate('/');
                }}
              >
                Done
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
