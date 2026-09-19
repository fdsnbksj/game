import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchRankings, RANKINGS_SIZE, type Rankings as RankingsData } from '../services/rankings';
import { dayId } from '../shared/constants';
import { useGameStore } from '../store';

// The rankings are per UTC day, so format the day in UTC or it shows yesterday west of Greenwich.
const DAY_FORMAT = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const PODIUM = ['first', 'second', 'third'];

export function Rankings() {
  const uid = useGameStore((s) => s.uid)!;
  const [rankings, setRankings] = useState<RankingsData | null>(null);
  const [failed, setFailed] = useState(false);
  const day = dayId();

  useEffect(() => {
    fetchRankings(day, uid).then(setRankings, () => setFailed(true));
  }, [day, uid]);

  const onBoard = rankings?.top.some((entry) => entry.uid === uid) ?? false;

  return (
    <main className="screen">
      <header className="topbar">
        <Link className="button small" to="/">
          ← Home
        </Link>
        <h2>Today</h2>
        <span className="spacer" />
        <span className="muted">{DAY_FORMAT.format(new Date(`${day}T00:00:00Z`))}</span>
      </header>
      <p className="muted small-print rankings-note">Each player's best finished run today. Resets at 00:00 UTC.</p>

      {!rankings && !failed && <div className="spinner large" aria-label="Loading" />}
      {failed && <p className="error">Couldn't load the rankings.</p>}
      {rankings && rankings.top.length === 0 && <p className="muted">No finished runs yet today. Be the first!</p>}
      {rankings && rankings.top.length > 0 && (
        <ol className="rankings">
          {rankings.top.map((entry, index) => (
            <li
              key={entry.uid}
              className={[entry.uid === uid && 'me', PODIUM[index]].filter(Boolean).join(' ') || undefined}
              style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
            >
              <span className="rank">{index + 1}</span>
              <span className="name">{entry.displayName}</span>
              <span className="wins">
                {entry.wins}
                <small>{entry.wins === 1 ? 'win' : 'wins'}</small>
              </span>
              <span className="hp">{entry.hp > 0 ? `${entry.hp} HP` : 'KO'}</span>
            </li>
          ))}
        </ol>
      )}
      {rankings && !onBoard && (
        <div className="rankings">
          <div className="row me off-board">
            <span className="rank">–</span>
            <span className="name">
              {rankings.mine ? 'You' : 'No finished run today'}
              {rankings.mine && <small className="muted">Not in the top {RANKINGS_SIZE}</small>}
            </span>
            <span className="wins">
              {rankings.mine?.wins ?? 0}
              <small>{rankings.mine?.wins === 1 ? 'win' : 'wins'}</small>
            </span>
            <span className="hp">{rankings.mine ? (rankings.mine.hp > 0 ? `${rankings.mine.hp} HP` : 'KO') : ''}</span>
          </div>
        </div>
      )}
    </main>
  );
}
