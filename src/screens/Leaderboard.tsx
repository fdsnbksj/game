import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchLeaderboard } from '../services/leaderboard';
import { useGameStore } from '../store';

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
        <h2>Leaderboard</h2>
      </header>

      {status === 'loading' && <p className="muted">Loading…</p>}
      {status === 'error' && <p className="error">Couldn't load scores.</p>}
      {status === 'ready' && entries.length === 0 && <p className="muted">No scores yet. Be the first!</p>}
      {status === 'ready' && entries.length > 0 && (
        <ol className="leaderboard">
          {entries.map((entry, index) => (
            <li key={entry.uid} className={entry.uid === uid ? 'me' : undefined}>
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
