import { useEffect, useState } from 'react';
import { fetchDaily, fetchLadder, RANKINGS_SIZE, type Ranking } from '../services/solves';
import { dayId } from '../shared/constants';
import { useGameStore } from '../store';

// The daily puzzle is per UTC day, so format the day in UTC or it shows yesterday west of Greenwich.
const DAY_FORMAT = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

type Tab = 'levels' | 'daily';

export function Rankings() {
  const uid = useGameStore((s) => s.uid);
  const signedIn = useGameStore((s) => s.player !== null);
  const [tab, setTab] = useState<Tab>('levels');
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [failed, setFailed] = useState(false);
  const day = dayId();

  useEffect(() => {
    setRanking(null);
    setFailed(false);
    if (!uid || !signedIn) return;
    let current = true;
    (tab === 'levels' ? fetchLadder(uid) : fetchDaily(day, uid)).then(
      (next) => current && setRanking(next),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [day, uid, signedIn, tab]);

  const onBoard = ranking?.top.some((entry) => entry.uid === uid) ?? false;
  const valueLabel = (value: number) =>
    tab === 'levels' ? (
      <>
        {value} <small>{value === 1 ? 'level' : 'levels'}</small>
      </>
    ) : null;

  return (
    <main className="screen with-tabs">
      <header className="page-head">
        <div>
          <p className="micro">Rankings</p>
          <h1>{tab === 'levels' ? 'Levels' : 'Today'}</h1>
        </div>
        {tab === 'daily' && <span className="micro">{DAY_FORMAT.format(new Date(`${day}T00:00:00Z`))}</span>}
      </header>

      <div className="segmented glass" role="tablist">
        <button role="tab" aria-selected={tab === 'levels'} onClick={() => setTab('levels')}>
          Levels
        </button>
        <button role="tab" aria-selected={tab === 'daily'} onClick={() => setTab('daily')}>
          Daily
        </button>
      </div>
      <p className="note">
        {tab === 'levels'
          ? 'The highest level each player has solved. Every level is the same for everyone.'
          : "The first to solve today's puzzle, in order. Resets at 00:00 UTC."}
      </p>

      {!signedIn && <p className="note center-text">Rankings need a connection. Your puzzles don't.</p>}
      {signedIn && !ranking && !failed && <div className="spinner large" aria-label="Loading" />}
      {failed && <p className="error">Couldn't load the rankings.</p>}
      {ranking && ranking.top.length === 0 && (
        <div className="glass empty-card">
          <p>{tab === 'levels' ? 'No one has solved a level yet.' : "No one has solved today's puzzle yet."}</p>
          <p className="note">Be the first.</p>
        </div>
      )}

      {ranking && ranking.top.length > 0 && (
        <ol className="glass rank-list">
          {ranking.top.map((entry, index) => (
            <li key={entry.uid} className={entry.uid === uid ? 'me' : undefined}>
              <span className="rank">{index + 1}</span>
              <span className="name">{entry.name}</span>
              <span className="wins">{valueLabel(entry.value)}</span>
            </li>
          ))}
        </ol>
      )}

      {ranking?.mine && !onBoard && (
        <div className="glass rank-list pinned">
          <div className="me">
            <span className="rank">–</span>
            <span className="name">
              You
              <small className="note">Not in the top {RANKINGS_SIZE}</small>
            </span>
            <span className="wins">{tab === 'levels' ? valueLabel(ranking.mine.value) : 'Solved'}</span>
          </div>
        </div>
      )}
    </main>
  );
}
