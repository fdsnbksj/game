export type Slot = 'body' | 'wing' | 'hat' | 'trail';
export type Rarity = 'common' | 'rare' | 'epic';

export interface Item {
  id: string;
  slot: Slot;
  name: string;
  rarity: Rarity;
  /** Best score needed to unlock. 0 means every player starts with it. */
  unlockScore: number;
  spriteKey: string;
}

/** 0xRRGGBB integers, so Firestore rules can range-check them. */
export interface LoadoutColors {
  body: number;
  wing: number;
  trail: number;
}

export interface Loadout {
  body: string;
  wing: string;
  hat: string;
  trail: string;
  colors: LoadoutColors;
}

export interface UserProfile {
  displayName: string;
  /** All-time best, which drives cosmetic unlocks. */
  bestScore: number;
  gamesPlayed: number;
  /** UTC day (YYYY-MM-DD) that dailyScore belongs to. */
  dailyId: string;
  /** Best score on that day's course, and what the daily leaderboard shows. */
  dailyScore: number;
}

export interface LeaderboardEntry {
  uid: string;
  score: number;
  displayName: string;
  loadout: Loadout;
}

export interface RunResult {
  score: number;
}
