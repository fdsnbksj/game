import { stream } from '../../nonogram/rng';
import type { Appearance } from './look';
import type { SkillId, Tree } from './stats';

// The arena: fights against other players' heroes, played by the bot brain while their
// owners are away. Only the attacker's rating moves. firestore.rules keeps copies of
// ARENA_UNLOCK and MAX_DELTA (arenaUnlock, arenaMaxDelta); tests/unit/rulesSync.test.ts
// compares them.

export const START_RATING = 1000;
/** Beat this bot level (the first boss) to enter. */
export const ARENA_UNLOCK = 5;
/** No fight moves a rating by more than this. */
export const MAX_DELTA = 35;
export const MIN_GAIN = 5;
/** How far a defender's stopwatch stops can be from the target, in ms. */
export const DEFENDER_SPREAD = 400;
/** The rules want results this far apart; a little more, for clocks that disagree. */
export const RESULT_SPACING_MS = 10_500;

export interface ArenaHero {
  uid: string;
  name: string;
  tree: Tree;
  /** The skills it fights with. */
  loadout?: SkillId[];
  rating: number;
  /** How it looks, and the costume whose bonus it fights with. */
  appearance?: Appearance;
  /** A bot-ladder hero standing in while the arena is empty. */
  sparring?: boolean;
}

/**
 * The rating change for a fight. A win gains 20, more for beating a higher-rated hero and
 * less for a lower one (5 to 35); a loss costs whatever a win wouldn't have gained, out of 40.
 */
export function ratingChange(mine: number, theirs: number, won: boolean): number {
  const gain = Math.max(MIN_GAIN, Math.min(MAX_DELTA, 20 + Math.floor((theirs - mine) / 25)));
  return won ? gain : -(MIN_GAIN + MAX_DELTA - gain);
}

export const TIERS = [
  { name: 'Bronze', from: 0 },
  { name: 'Silver', from: 1100 },
  { name: 'Gold', from: 1250 },
  { name: 'Platinum', from: 1400 },
  { name: 'Diamond', from: 1600 },
] as const;

export type Tier = (typeof TIERS)[number]['name'];

export function tierOf(rating: number): Tier {
  let tier: Tier = 'Bronze';
  for (const t of TIERS) if (rating >= t.from) tier = t.name;
  return tier;
}

/** One opponent from those found, never yourself; the same seed picks the same one. */
export function pickOpponent(candidates: readonly ArenaHero[], me: string, seed: string): ArenaHero | null {
  const others = candidates.filter((c) => c.uid !== me);
  return others.length ? others[stream(`${seed}:opponent`)(others.length)] : null;
}
