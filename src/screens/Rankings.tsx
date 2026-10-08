import { useEffect, useState } from 'react';
import { Page } from '../components/Page';
import { useCameFrom } from '../components/cameFrom';
import { tierOf } from '../games/hero/arena';
import { ARENA_TOP, fetchArenaTop, type ArenaEntry } from '../services/arena';
import { fetchLadder, RANKINGS_SIZE, type Ranking } from '../services/solves';
import { useHeroStore } from '../heroStore';
import { useGameStore } from '../store';

/** Two boards: the Puzzle Tower (the highest level each player has solved) and the Hero Gambit arena. */
export function Rankings() {
  const cameFrom = useCameFrom();
  const [board, setBoard] = useState<'arena' | 'tower'>('arena');
  return (
    <Page title="Rankings" back={cameFrom()}>
      <div className="segmented" role="radiogroup" aria-label="Board">
        <button type="button" role="radio" aria-checked={board === 'arena'} onClick={() => setBoard('arena')}>
          Arena
        </button>
        <button type="button" role="radio" aria-checked={board === 'tower'} onClick={() => setBoard('tower')}>
          Tower
        </button>
      </div>
      {board === 'arena' ? <ArenaBoard /> : <TowerBoard />}
    </Page>
  );
}

function ArenaBoard() {
  const uid = useGameStore((s) => s.uid);
  const signedIn = useGameStore((s) => s.player !== null);
  const mine = useHeroStore((s) => s.arena);
  const [top, setTop] = useState<ArenaEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    fetchArenaTop().then(
      (next) => current && setTop(next),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [signedIn]);

  const onBoard = top?.some((entry) => entry.uid === uid) ?? false;
  return (
    <>
      {!signedIn && <p className="note">Rankings need a connection.</p>}
      {signedIn && !top && !failed && <div className="spinner" aria-label="Loading" />}
      {failed && <p className="error">Couldn't load the arena.</p>}
      {top && top.length === 0 && <p className="note">No heroes in the arena yet. Beat bot level 5 to be the first.</p>}
      {top && top.length > 0 && (
        <ol className="group ranks">
          {top.map((entry, index) => (
            <li key={entry.uid} className={entry.uid === uid ? 'row me' : 'row'}>
              <span className="rank">{index + 1}</span>
              <span className="rank-name">{entry.name}</span>
              <span className="row-detail">
                {tierOf(entry.rating)} {entry.rating}
              </span>
            </li>
          ))}
        </ol>
      )}
      {top && mine && !onBoard && (
        <div className="group ranks">
          <div className="row me">
            <span className="rank">–</span>
            <span className="rank-name">You, outside the top {ARENA_TOP}</span>
            <span className="row-detail">
              {tierOf(mine.rating)} {mine.rating}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

function TowerBoard() {
  const uid = useGameStore((s) => s.uid);
  const signedIn = useGameStore((s) => s.player !== null);
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!uid || !signedIn) return;
    let current = true;
    fetchLadder(uid).then(
      (next) => current && setRanking(next),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [uid, signedIn]);

  const onBoard = ranking?.top.some((entry) => entry.uid === uid) ?? false;

  return (
    <>
      {!signedIn && <p className="note">Rankings need a connection. The puzzles don't.</p>}
      {signedIn && !ranking && !failed && <div className="spinner" aria-label="Loading" />}
      {failed && <p className="error">Couldn't load the rankings.</p>}
      {ranking && ranking.top.length === 0 && <p className="note">No one has solved a level yet.</p>}
      {ranking && ranking.top.length > 0 && (
        <ol className="group ranks">
          {ranking.top.map((entry, index) => (
            <li key={entry.uid} className={entry.uid === uid ? 'row me' : 'row'}>
              <span className="rank">{index + 1}</span>
              <span className="rank-name">{entry.name}</span>
              <span className="row-detail">Level {entry.level}</span>
            </li>
          ))}
        </ol>
      )}
      {ranking?.mine && !onBoard && (
        <div className="group ranks">
          <div className="row me">
            <span className="rank">–</span>
            <span className="rank-name">You, outside the top {RANKINGS_SIZE}</span>
            <span className="row-detail">Level {ranking.mine.level}</span>
          </div>
        </div>
      )}
    </>
  );
}
