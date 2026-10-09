import { useEffect, useState } from 'react';
import { Page } from '../components/Page';
import { useCameFrom } from '../components/cameFrom';
import { tierOf } from '../games/hero/arena';
import { ARENA_TOP, fetchArenaTop, type ArenaEntry } from '../services/arena';
import { useHeroStore } from '../heroStore';
import { useGameStore } from '../store';

/** The Hero Gambit arena board (the Puzzle Tower's is hidden with the other games for now). */
export function Rankings() {
  const cameFrom = useCameFrom();
  return (
    <Page title="Rankings" back={cameFrom()}>
      <ArenaBoard />
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
