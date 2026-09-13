import { getDocs, limit, orderBy, query } from 'firebase/firestore';
import { LEADERBOARD_REFRESH_MS, LEADERBOARD_SIZE } from '../shared/constants';
import type { LeaderboardEntry, Loadout } from '../shared/types';
import { useGameStore } from '../store';
import { leaderboardCollection } from './refs';

/** Returns the cached top scores, re-querying at most once per LEADERBOARD_REFRESH_MS to save reads. */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const { leaderboard, leaderboardFetchedAt, setLeaderboard } = useGameStore.getState();
  if (Date.now() - leaderboardFetchedAt < LEADERBOARD_REFRESH_MS) return leaderboard;

  const snap = await getDocs(query(leaderboardCollection(), orderBy('score', 'desc'), limit(LEADERBOARD_SIZE)));
  const entries = snap.docs.map((d) => ({
    uid: d.id,
    score: d.get('score') as number,
    displayName: d.get('displayName') as string,
    loadout: d.get('loadout') as Loadout,
  }));
  setLeaderboard(entries);
  return entries;
}
