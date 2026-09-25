import { useEffect, useState } from 'react';
import { fetchRankings, RANKINGS_SIZE, type Rankings as RankingsData } from '../services/rankings';
import type { RunMode } from '../sim/planning';
import { dayId } from '../shared/constants';
import { useGameStore } from '../store';

// The rankings are per UTC day, so format the day in UTC or it shows yesterday west of Greenwich.
const DAY_FORMAT = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

export function Rankings() {
  const uid = useGameStore((s) => s.uid)!;
  const [mode, setMode] = useState<RunMode>('run');
  const [rankings, setRankings] = useState<RankingsData | null>(null);
  const [failed, setFailed] = useState(false);
  const day = dayId();

  useEffect(() => {
    setRankings(null);
    setFailed(false);
    let current = true;
    fetchRankings(day, uid, mode).then(
      (next) => current && setRankings(next),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [day, uid, mode]);

  const onBoard = rankings?.top.some((entry) => entry.uid === uid) ?? false;
  const podium = rankings?.top.slice(0, 3) ?? [];
  const rest = rankings?.top.slice(3) ?? [];
  const winsLabel = (wins: number) => (wins === 1 ? 'win' : 'wins');
  // How long the run lasted, the tie-break; older entries didn't record it.
  const roundLabel = (round?: number) => (round ? `Round ${round}` : '');

  return (
    <main className="screen with-tabs">
      <header className="page-head">
        <div>
          <p className="micro">Rankings</p>
          <h1>Today</h1>
        </div>
        <span className="micro">{DAY_FORMAT.format(new Date(`${day}T00:00:00Z`))}</span>
      </header>

      <div className="segmented glass" role="tablist">
        <button role="tab" aria-selected={mode === 'run'} onClick={() => setMode('run')}>
          Runs
        </button>
        <button role="tab" aria-selected={mode === 'daily'} onClick={() => setMode('daily')}>
          Daily challenge
        </button>
      </div>
      <p className="note">
        {mode === 'daily'
          ? "Today's challenge, the same run for everyone. Resets at 00:00 UTC."
          : "Each player's best finished run today. Resets at 00:00 UTC."}
      </p>

      {!rankings && !failed && <div className="spinner large" aria-label="Loading" />}
      {failed && <p className="error">Couldn't load the rankings.</p>}
      {rankings && rankings.top.length === 0 && (
        <div className="glass empty-card">
          <p>No finished runs yet today.</p>
          <p className="note">Finish one to take first place.</p>
        </div>
      )}

      {podium.length > 0 && (
        <ol className="podium">
          {podium.map((entry, index) => (
            <li key={entry.uid} className={`glass place-${index + 1}${entry.uid === uid ? ' me' : ''}`}>
              <span className="place">{index + 1}</span>
              <span className="podium-name">{entry.displayName}</span>
              <span className="podium-wins">
                {entry.wins}
                <small>{winsLabel(entry.wins)}</small>
              </span>
              <span className="micro">{roundLabel(entry.round)}</span>
            </li>
          ))}
        </ol>
      )}

      {rest.length > 0 && (
        <ol className="glass rank-list" start={4}>
          {rest.map((entry, index) => (
            <li key={entry.uid} className={entry.uid === uid ? 'me' : undefined}>
              <span className="rank">{index + 4}</span>
              <span className="name">{entry.displayName}</span>
              <span className="wins">
                {entry.wins} <small>{winsLabel(entry.wins)}</small>
              </span>
              <span className="hp">{roundLabel(entry.round)}</span>
            </li>
          ))}
        </ol>
      )}

      {rankings?.mine && !onBoard && (
        <div className="glass rank-list pinned">
          <div className="me">
            <span className="rank">–</span>
            <span className="name">
              You
              <small className="note">Not in the top {RANKINGS_SIZE}</small>
            </span>
            <span className="wins">
              {rankings.mine.wins} <small>{winsLabel(rankings.mine.wins)}</small>
            </span>
            <span className="hp">{roundLabel(rankings.mine.round)}</span>
          </div>
        </div>
      )}
      {rankings && !rankings.mine && rankings.top.length > 0 && (
        <p className="note center-text">Finish a run today to get your own place here.</p>
      )}
    </main>
  );
}
