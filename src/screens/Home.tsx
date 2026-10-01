import { Link } from 'react-router';
import { sizeFor } from '../nonogram/generate';
import { useNonogramStore } from '../nonogramStore';
import { useGameStore } from '../store';

const Chevron = () => (
  <svg className="chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** A few squares filled in, like a puzzle half done. */
const NonogramGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    {[0, 1, 2].flatMap((r) =>
      [0, 1, 2].map((c) => (
        <rect
          key={`${r}${c}`}
          x={3 + c * 6.5}
          y={3 + r * 6.5}
          width="5"
          height="5"
          rx="1.2"
          fill="currentColor"
          opacity={[1, 0.25, 1, 1, 1, 0.25, 0.25, 1, 1][r * 3 + c]}
        />
      )),
    )}
  </svg>
);

/** A crown, for the court of Avalon. */
const AvalonGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5L3 8z" fill="currentColor" opacity="0.9" />
    <rect x="5" y="19.5" width="14" height="2" rx="1" fill="currentColor" />
  </svg>
);

/** Columns under a pediment: a wonder. */
const DuelGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M12 3l9 5H3l9-5z" fill="currentColor" />
    {[5, 10.5, 16].map((x) => (
      <rect key={x} x={x} y="10" width="3" height="8" rx="0.8" fill="currentColor" opacity="0.85" />
    ))}
    <rect x="3" y="19" width="18" height="2" rx="1" fill="currentColor" />
  </svg>
);

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** The games, and who you are. */
export function Home() {
  const player = useGameStore((s) => s.player);
  const email = useGameStore((s) => s.email);
  const level = useNonogramStore((s) => s.level);
  const name = player?.displayName;
  const size = sizeFor(level);

  return (
    <main className="screen">
      <header className="home-head">
        <div>
          <p className="home-hello">{greeting()}</p>
          <h1 className="home-name">{name ?? 'Welcome'}</h1>
        </div>
        <Link className="avatar" to="/account" aria-label="Account">
          {name ? name.slice(0, 1).toUpperCase() : '·'}
        </Link>
      </header>

      <Link className="continue-card" to="/nonograms">
        <div>
          <span className="micro">Continue</span>
          <strong>Nonograms · Level {level}</strong>
          <span className="note">
            {size}×{size} grid, right where you left it
          </span>
        </div>
        <span className="continue-play" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path d="M8 5.5v13l10.5-6.5L8 5.5z" fill="currentColor" />
          </svg>
        </span>
      </Link>

      <p className="group-title">Games</p>
      <nav className="game-tiles" aria-label="Games">
        <Link className="game-tile" to="/nonograms">
          <span className="game-glyph nonogram">
            <NonogramGlyph />
          </span>
          <div>
            <strong>Nonograms</strong>
            <small>Logic puzzles for between chapters</small>
          </div>
          <span className="tile-chip">Lv {level}</span>
        </Link>
        <Link className="game-tile" to="/avalon">
          <span className="game-glyph avalon">
            <AvalonGlyph />
          </span>
          <div>
            <strong>Avalon</strong>
            <small>Hidden loyalty at one table</small>
          </div>
          <span className="tile-chip">5–10</span>
        </Link>
        <Link className="game-tile" to="/duel">
          <span className="game-glyph duel">
            <DuelGlyph />
          </span>
          <div>
            <strong>Rival Wonders</strong>
            <small>Two rival cities, three ages</small>
          </div>
          <span className="tile-chip">2</span>
        </Link>
      </nav>

      <div className="spacer" />
      <div className="group">
        <Link className="row" to="/account">
          <span>Account</span>
          <span className="row-detail">{player ? (email ? 'Signed in' : 'Guest') : 'Connecting…'}</span>
          <Chevron />
        </Link>
      </div>
    </main>
  );
}
