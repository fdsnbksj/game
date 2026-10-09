import type { Rng } from '../../nonogram/rng';
import { costumeItem, COSTUMES, type Rarity } from './costumes';
import { SUMMON_PARTS } from './look';

// Summon: the gacha for costumes and rarer avatar parts, paid in gems earned by fighting,
// with one free pull a day. Pure: the screen passes a random source and today's date.

/** Out of 1000. */
export const RATES: Record<Rarity, number> = { legendary: 20, epic: 80, rare: 300, common: 600 };
/** The pull this many since the last Legendary is always one. */
export const PITY = 50;
export const PULL_COST = 100;
export const TEN_COST = 900;
/** What a duplicate turns into. */
export const REFUND: Record<Rarity, number> = { common: 10, rare: 25, epic: 60, legendary: 150 };

/** Item ids by rarity: avatar parts are common, costumes the rest. */
export const POOL: Record<Rarity, readonly string[]> = {
  common: SUMMON_PARTS,
  rare: COSTUMES.filter((c) => c.rarity === 'rare').map((c) => costumeItem(c.id)),
  epic: COSTUMES.filter((c) => c.rarity === 'epic').map((c) => costumeItem(c.id)),
  legendary: COSTUMES.filter((c) => c.rarity === 'legendary').map((c) => costumeItem(c.id)),
};

export const ALL_ITEMS: readonly string[] = [...POOL.common, ...POOL.rare, ...POOL.epic, ...POOL.legendary];

export const rarityOf = (item: string): Rarity => (['legendary', 'epic', 'rare', 'common'] as const).find((r) => POOL[r].includes(item)) ?? 'common';

export interface Pulled {
  item: string;
  rarity: Rarity;
}

const ORDER: Rarity[] = ['legendary', 'epic', 'rare', 'common'];

/** One pull. `pity` is pulls since the last Legendary; `atLeastRare` lifts a common. */
export function pullOnce(rng: Rng, pity: number, atLeastRare = false): { pulled: Pulled; pity: number } {
  let rarity: Rarity;
  if (pity + 1 >= PITY) rarity = 'legendary';
  else {
    let roll = rng(1000);
    rarity = ORDER.find((r) => (roll -= RATES[r]) < 0)!;
    if (atLeastRare && rarity === 'common') rarity = 'rare';
  }
  const pool = POOL[rarity];
  return { pulled: { item: pool[rng(pool.length)], rarity }, pity: rarity === 'legendary' ? 0 : pity + 1 };
}

/** Ten pulls, at least one Rare or better. */
export function pullTen(rng: Rng, pity: number): { pulled: Pulled[]; pity: number } {
  const pulled: Pulled[] = [];
  for (let i = 0; i < 10; i++) {
    const lift = i === 9 && pulled.every((p) => p.rarity === 'common');
    const next = pullOnce(rng, pity, lift);
    pulled.push(next.pulled);
    pity = next.pity;
  }
  return { pulled, pity };
}

export type Earned = { kind: 'bot'; boss: boolean; first: boolean } | { kind: 'arena'; won: boolean };

/** Gems for a fight. */
export function gemsFor(e: Earned): number {
  if (e.kind === 'arena') return e.won ? 20 : 5;
  if (e.first) return e.boss ? 150 : 50;
  return e.boss ? 25 : 10;
}
