import { getDocs, limit, orderBy, query } from 'firebase/firestore';
import { dayId, LEADERBOARD_REFRESH_MS, LEADERBOARD_SIZE } from '../shared/constants';
import type { LeaderboardEntry, Loadout } from '../shared/types';
import { useGameStore } from '../store';
import { leaderboardCollection } from './refs';

/** Today's top scores, re-queried at most once per LEADERBOARD_REFRESH_MS to save reads. */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const { leaderboard, leaderboardDay, leaderboardFetchedAt, setLeaderboard } = useGameStore.getState();
  const day = dayId();
  if (day === leaderboardDay && Date.now() - leaderboardFetchedAt < LEADERBOARD_REFRESH_MS) return leaderboard;

  const snap = await getDocs(query(leaderboardCollection(day), orderBy('score', 'desc'), limit(LEADERBOARD_SIZE)));
  const entries = snap.docs.map((d) => ({
    uid: d.id,
    score: d.get('score') as number,
    displayName: d.get('displayName') as string,
    loadout: d.get('loadout') as Loadout,
  }));
  setLeaderboard(day, entries);
  return entries;
}
