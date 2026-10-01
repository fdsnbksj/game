import { Link } from 'react-router';
import { useNonogramStore } from '../nonogramStore';
import { useGameStore } from '../store';

const Chevron = () => (
  <svg className="chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** The games, and who you are. */
export function Home() {
  const player = useGameStore((s) => s.player);
  const email = useGameStore((s) => s.email);
  const level = useNonogramStore((s) => s.level);

  return (
    <main className="screen">
      <header className="bar">
        <span className="icon-button" aria-hidden="true" />
        <h1 className="bar-title">a game</h1>
        <span className="icon-button" aria-hidden="true" />
      </header>

      <div className="group">
        <Link className="row" to="/account">
          <span>{player?.displayName ?? 'Connecting…'}</span>
          <span className="row-detail">{email ? 'Account' : 'Guest'}</span>
          <Chevron />
        </Link>
      </div>

      <p className="group-title">Games</p>
      <div className="group">
        <Link className="row game-row" to="/nonograms">
          <span>
            Nonograms
            <small>Logic puzzles for between chapters</small>
          </span>
          <span className="row-detail">Level {level}</span>
          <Chevron />
        </Link>
        <Link className="row game-row" to="/avalon">
          <span>
            Avalon
            <small>Hidden loyalty, 5 to 10 players at one table</small>
          </span>
          <Chevron />
        </Link>
        <Link className="row game-row" to="/duel">
          <span>
            Rival Wonders
            <small>Two rival cities, three ages</small>
          </span>
          <Chevron />
        </Link>
      </div>
    </main>
  );
}
