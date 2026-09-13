export type Slot = 'body' | 'hair' | 'outfit' | 'accessory';
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
  skin: number;
  hair: number;
  outfit: number;
}

export interface Loadout {
  body: string;
  hair: string;
  outfit: string;
  accessory: string;
  colors: LoadoutColors;
}

export interface UserProfile {
  displayName: string;
  bestScore: number;
  gamesPlayed: number;
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
