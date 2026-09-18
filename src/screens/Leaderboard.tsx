import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchLeaderboard } from '../services/leaderboard';
import { dayId } from '../shared/constants';
import { useGameStore } from '../store';

// The board is the UTC day, so format it in UTC or it shows yesterday west of Greenwich.
const DAY_FORMAT = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

export function Leaderboard() {
  const uid = useGameStore((s) => s.uid);
  const entries = useGameStore((s) => s.leaderboard);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    fetchLeaderboard().then(
      () => setStatus('ready'),
      () => setStatus('error'),
    );
  }, []);

  return (
    <main className="screen">
      <header className="topbar">
        <Link className="button small" to="/">
          ← Home
        </Link>
        <h2>Today</h2>
        <span className="spacer" />
        <span className="muted">{DAY_FORMAT.format(new Date(`${dayId()}T00:00:00Z`))}</span>
      </header>

      {status === 'loading' && <div className="spinner large" aria-label="Loading" />}
      {status === 'error' && <p className="error">Couldn't load scores.</p>}
      {status === 'ready' && entries.length === 0 && <p className="muted">No scores yet today. Be the first!</p>}
      {status === 'ready' && entries.length > 0 && (
        <ol className="leaderboard">
          {entries.map((entry, index) => (
            <li
              key={entry.uid}
              className={entry.uid === uid ? 'me' : undefined}
              style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
            >
              <span className="rank">{index + 1}</span>
              <span>{entry.displayName}</span>
              <span className="score">{entry.score}</span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
