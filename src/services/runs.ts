import { increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { MAX_SCORE } from '../shared/constants';
import type { Item } from '../shared/types';
import { requireSession } from '../store';
import { unlockEarnedItems } from './inventory';
import { leaderboardEntryRef, userRef } from './refs';

export interface RunOutcome {
  score: number;
  newBest: boolean;
  unlocked: Item[];
}

export async function submitRun(rawScore: number): Promise<RunOutcome> {
  const { uid, profile, loadout, setProfile, invalidateLeaderboard } = requireSession();
  const score = Math.min(Math.max(Math.floor(rawScore), 0), MAX_SCORE);
  const newBest = score > profile.bestScore;
  const bestScore = Math.max(profile.bestScore, score);

  // The rules only accept a leaderboard entry alongside the run update in the same batch.
  const batch = writeBatch(db);
  batch.update(userRef(uid), { bestScore, gamesPlayed: increment(1), lastRunAt: serverTimestamp() });
  if (newBest) {
    batch.set(leaderboardEntryRef(uid), {
      score,
      displayName: profile.displayName,
      loadout,
      submittedAt: serverTimestamp(),
    });
  }
  await batch.commit();

  setProfile({ ...profile, bestScore, gamesPlayed: profile.gamesPlayed + 1 });
  if (!newBest) return { score, newBest, unlocked: [] };

  invalidateLeaderboard();
  return { score, newBest, unlocked: await unlockEarnedItems(bestScore) };
}
