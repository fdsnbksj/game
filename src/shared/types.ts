// The retired Neon Flap item catalog's types, kept for its seed script and rules tests.
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
