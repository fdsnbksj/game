import { useEffect, useState } from 'react';
import { fetchLadder, LADDER_SIZE, type Ladder } from '../services/puzzles';
import { fetchRankings, RANKINGS_SIZE, type Rankings as RankingsData } from '../services/rankings';
import type { RunMode } from '../sim/planning';
import { dayId } from '../shared/constants';
import { useGameStore } from '../store';

// The rankings are per UTC day, so format the day in UTC or it shows yesterday west of Greenwich.
const DAY_FORMAT = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

export function Rankings() {
  const uid = useGameStore((s) => s.uid)!;
  const [tab, setTab] = useState<RunMode | 'puzzles'>('run');
  const mode: RunMode = tab === 'puzzles' ? 'run' : tab;
  const [rankings, setRankings] = useState<RankingsData | null>(null);
  const [failed, setFailed] = useState(false);
  const day = dayId();

  useEffect(() => {
    setRankings(null);
    setFailed(false);
    if (tab === 'puzzles') return;
    let current = true;
    fetchRankings(day, uid, mode).then(
      (next) => current && setRankings(next),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [day, uid, mode, tab]);

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
          <h1>{tab === 'puzzles' ? 'Puzzles' : 'Today'}</h1>
        </div>
        {tab !== 'puzzles' && <span className="micro">{DAY_FORMAT.format(new Date(`${day}T00:00:00Z`))}</span>}
      </header>

      <div className="segmented glass" role="tablist">
        <button role="tab" aria-selected={tab === 'run'} onClick={() => setTab('run')}>
          Runs
        </button>
        <button role="tab" aria-selected={tab === 'daily'} onClick={() => setTab('daily')}>
          Daily
        </button>
        <button role="tab" aria-selected={tab === 'puzzles'} onClick={() => setTab('puzzles')}>
          Puzzles
        </button>
      </div>
      {tab === 'puzzles' ? (
        <PuzzleLadder uid={uid} />
      ) : (
        <>
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
        </>
      )}
    </main>
  );
}

/** The furthest anyone has climbed the puzzle ladder. It doesn't reset; a new ladder starts when the puzzles change. */
function PuzzleLadder({ uid }: { uid: string }) {
  const [ladder, setLadder] = useState<Ladder | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    fetchLadder(uid).then(
      (next) => current && setLadder(next),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [uid]);

  const onBoard = ladder?.top.some((entry) => entry.uid === uid) ?? false;
  return (
    <>
      <p className="note">The highest puzzle level each player has cleared. Every level is the same for everyone.</p>
      {!ladder && !failed && <div className="spinner large" aria-label="Loading" />}
      {failed && <p className="error">Couldn't load the puzzle rankings.</p>}
      {ladder && ladder.top.length === 0 && (
        <div className="glass empty-card">
          <p>No one has cleared a puzzle yet.</p>
          <p className="note">Clear the first one to take first place.</p>
        </div>
      )}
      {ladder && ladder.top.length > 0 && (
        <ol className="glass rank-list">
          {ladder.top.map((entry, index) => (
            <li key={entry.uid} className={entry.uid === uid ? 'me' : undefined}>
              <span className="rank">{index + 1}</span>
              <span className="name">{entry.name}</span>
              <span className="wins">
                {entry.level} <small>{entry.level === 1 ? 'level' : 'levels'}</small>
              </span>
            </li>
          ))}
        </ol>
      )}
      {ladder?.mine && !onBoard && (
        <div className="glass rank-list pinned">
          <div className="me">
            <span className="rank">–</span>
            <span className="name">
              You
              <small className="note">Not in the top {LADDER_SIZE}</small>
            </span>
            <span className="wins">
              {ladder.mine.level} <small>{ladder.mine.level === 1 ? 'level' : 'levels'}</small>
            </span>
          </div>
        </div>
      )}
    </>
  );
}
