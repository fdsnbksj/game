// Meme costumes: full-body skins worn over your hero, from Summon (gacha.ts). They come
// from Italian brainrot, memes nobody owns, and every one is our own drawing
// (src/screens/hero/Costumes.tsx). Each gives a small bonus, capped by its rarity.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export interface Bonus {
  /** Percent more HP. */
  hpPct: number;
  def: number;
  /** Crit chance, in percent. */
  crit: number;
  /** Crit damage, in percent. */
  critDmg: number;
}

export type CostumeId =
  | 'tungtung'
  | 'tralalero'
  | 'bombardiro'
  | 'cappuccina'
  | 'patapim'
  | 'bananini'
  | 'larila'
  | 'assassino'
  | 'saturnita'
  | 'trippi'
  | 'ambalabu'
  | 'frigo'
  | 'glorbo'
  | 'burbaloni'
  | 'capybara';

export interface Costume {
  id: CostumeId;
  name: string;
  rarity: Exclude<Rarity, 'common'>;
  bonus: Bonus;
}

/** The most a costume of each rarity may give. */
export const BONUS_CAP: Record<Exclude<Rarity, 'common'>, Bonus> = {
  rare: { hpPct: 5, def: 1, crit: 2, critDmg: 5 },
  epic: { hpPct: 6, def: 2, crit: 3, critDmg: 10 },
  legendary: { hpPct: 8, def: 3, crit: 4, critDmg: 15 },
};

const b = (hpPct: number, def: number, crit: number, critDmg: number): Bonus => ({ hpPct, def, crit, critDmg });

export const COSTUMES: readonly Costume[] = [
  { id: 'tungtung', name: 'Tung Tung Tung Sahur', rarity: 'legendary', bonus: b(8, 3, 3, 15) },
  { id: 'tralalero', name: 'Tralalero Tralala', rarity: 'legendary', bonus: b(6, 2, 4, 15) },
  { id: 'bombardiro', name: 'Bombardiro Crocodilo', rarity: 'legendary', bonus: b(8, 2, 4, 10) },
  { id: 'cappuccina', name: 'Ballerina Cappuccina', rarity: 'epic', bonus: b(4, 1, 3, 10) },
  { id: 'patapim', name: 'Brr Brr Patapim', rarity: 'epic', bonus: b(6, 2, 2, 5) },
  { id: 'bananini', name: 'Chimpanzini Bananini', rarity: 'epic', bonus: b(5, 1, 3, 5) },
  { id: 'larila', name: 'Lirili Larila', rarity: 'epic', bonus: b(6, 2, 1, 5) },
  { id: 'assassino', name: 'Cappuccino Assassino', rarity: 'epic', bonus: b(3, 1, 3, 10) },
  { id: 'saturnita', name: 'La Vaca Saturno Saturnita', rarity: 'epic', bonus: b(6, 2, 2, 5) },
  { id: 'trippi', name: 'Trippi Troppi', rarity: 'rare', bonus: b(4, 0, 2, 5) },
  { id: 'ambalabu', name: 'Boneca Ambalabu', rarity: 'rare', bonus: b(5, 1, 1, 0) },
  { id: 'frigo', name: 'Frigo Camelo', rarity: 'rare', bonus: b(5, 1, 0, 5) },
  { id: 'glorbo', name: 'Glorbo Fruttodrillo', rarity: 'rare', bonus: b(3, 1, 2, 5) },
  { id: 'burbaloni', name: 'Burbaloni Luliloli', rarity: 'rare', bonus: b(5, 0, 2, 0) },
  { id: 'capybara', name: 'Capybara', rarity: 'rare', bonus: b(5, 1, 1, 5) },
];

export const costumeItem = (id: CostumeId) => `costume:${id}`;

export const costumeOf = (id: unknown): Costume | null => COSTUMES.find((c) => c.id === id) ?? null;

export const NO_BONUS: Bonus = b(0, 0, 0, 0);
