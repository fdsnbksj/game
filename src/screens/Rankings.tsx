import { useEffect, useState } from 'react';
import { Page } from '../components/Page';
import { useCameFrom } from '../components/cameFrom';
import { fetchLadder, RANKINGS_SIZE, type Ranking } from '../services/solves';
import { useGameStore } from '../store';

/** The highest level each player has solved. */
export function Rankings() {
  const uid = useGameStore((s) => s.uid);
  const cameFrom = useCameFrom();
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
    <Page title="Rankings" back={cameFrom()}>
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
    </Page>
  );
}
