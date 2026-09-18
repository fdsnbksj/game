import { increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { dayId, MAX_RUNS_PER_SAVE, MAX_SCORE, MIN_SECONDS_BETWEEN_RUNS } from '../shared/constants';
import { nextProgress } from '../shared/progress';
import type { Item } from '../shared/types';
import { requireSession, useGameStore } from '../store';
import { unlockEarnedItems } from './inventory';
import { leaderboardEntryRef, userRef } from './refs';

export interface RunOutcome {
  score: number;
  /** Whether the run reached Firestore. Runs that don't beat today's best are only counted locally. */
  saved: boolean;
  newBest: boolean;
  newDailyBest: boolean;
  unlocked: Item[];
  /** The streak, when this run was the first saved today; null otherwise. */
  streak: number | null;
  newBestStreak: boolean;
}

/** The rules reject saves that are too close together, so wait out the gap first. */
async function waitForCooldown(lastSaveAt: number) {
  const waitMs = lastSaveAt + MIN_SECONDS_BETWEEN_RUNS * 1000 - Date.now();
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
}

/**
 * Saves a run only when it beats the player's best for today's course; other runs
 * just add to a local counter that rides along with the next save.
 */
export async function submitRun(rawScore: number): Promise<RunOutcome> {
  const { uid, profile, loadout, pendingRuns, lastSaveAt, setProfile, markSaved, addPendingRun, invalidateLeaderboard } =
    requireSession();
  const score = Math.min(Math.max(Math.floor(rawScore), 0), MAX_SCORE);
  const today = dayId();
  const bestToday = profile.dailyId === today ? profile.dailyScore : 0;

  if (score <= bestToday) {
    addPendingRun();
    return { score, saved: false, newBest: false, newDailyBest: false, unlocked: [], streak: null, newBestStreak: false };
  }

  const newBest = score > profile.bestScore;
  const bestScore = Math.max(profile.bestScore, score);
  const runs = Math.min(pendingRuns + 1, MAX_RUNS_PER_SAVE);
  // Only the first save of a day moves the streak; the rules reject counting a day twice.
  const progress = nextProgress(profile, today);

  await waitForCooldown(lastSaveAt);

  // The rules only accept a leaderboard entry alongside the run that set this daily score.
  const batch = writeBatch(db);
  batch.update(userRef(uid), {
    bestScore,
    dailyId: today,
    dailyScore: score,
    gamesPlayed: increment(runs),
    lastRunAt: serverTimestamp(),
    ...progress,
  });
  batch.set(leaderboardEntryRef(today, uid), {
    score,
    displayName: profile.displayName,
    loadout,
    submittedAt: serverTimestamp(),
  });
  await batch.commit();

  setProfile({
    ...profile,
    bestScore,
    gamesPlayed: profile.gamesPlayed + runs,
    dailyId: today,
    dailyScore: score,
    ...progress,
  });
  markSaved(runs);
  invalidateLeaderboard();

  return {
    score,
    saved: true,
    newBest,
    newDailyBest: true,
    unlocked: newBest ? await unlockEarnedItems(bestScore) : [],
    streak: progress?.streak ?? null,
    newBestStreak: progress !== null && progress.bestStreak > profile.bestStreak,
  };
}

/** Counts a run that was abandoned or failed to save, so games played stays roughly right. */
export function countRunLocally() {
  useGameStore.getState().addPendingRun();
}
