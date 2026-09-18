import { isNextDay } from './constants';
import type { UserProfile } from './types';

export type ProgressFields = Pick<UserProfile, 'streak' | 'bestStreak' | 'streakDay' | 'daysPlayed'>;

/**
 * Progress after a save on `today`, or null when today has already counted.
 * Mirrors isValidProgress() in firestore.rules.
 */
export function nextProgress(profile: UserProfile, today: string): ProgressFields | null {
  if (profile.streakDay === today) return null;
  const streak = isNextDay(profile.streakDay, today) ? profile.streak + 1 : 1;
  return {
    streak,
    bestStreak: Math.max(profile.bestStreak, streak),
    streakDay: today,
    daysPlayed: profile.daysPlayed + 1,
  };
}

/** The stored streak is as of streakDay; it's gone once a whole day passes without a save. */
export function liveStreak(profile: UserProfile, today: string): number {
  return profile.streakDay === today || isNextDay(profile.streakDay, today) ? profile.streak : 0;
}

/** Whether today still needs a saved run to keep the streak going. */
export function streakAtRisk(profile: UserProfile, today: string): boolean {
  return profile.streak > 0 && isNextDay(profile.streakDay, today);
}

export interface Medal {
  id: 'bronze' | 'silver' | 'gold' | 'neon';
  name: string;
  /** All-time best needed. */
  score: number;
}

/** Earned by all-time best. Client-side only: they're derived from bestScore, which the rules already guard. */
export const MEDALS: readonly Medal[] = [
  { id: 'bronze', name: 'Bronze', score: 10 },
  { id: 'silver', name: 'Silver', score: 25 },
  { id: 'gold', name: 'Gold', score: 50 },
  { id: 'neon', name: 'Neon', score: 100 },
];

export function medalFor(bestScore: number): Medal | null {
  return [...MEDALS].reverse().find((medal) => bestScore >= medal.score) ?? null;
}

export function nextMedal(bestScore: number): Medal | null {
  return MEDALS.find((medal) => bestScore < medal.score) ?? null;
}
