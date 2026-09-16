import type { Item, Loadout, Slot } from './types';

/** Slots drawn as stacked images, back to front. The trail is a particle effect, the face is fixed. */
export const LAYER_ORDER: readonly Slot[] = ['body', 'wing', 'hat'];

/** Every customizable slot, in the order the Customize screen lists them. */
export const COSMETIC_SLOTS: readonly Slot[] = ['body', 'wing', 'hat', 'trail'];

// Firestore rules read unlock scores from items/{id}, so run `npm run seed` after editing this list.
export const ITEMS: readonly Item[] = [
  { id: 'body_round', slot: 'body', name: 'Round', rarity: 'common', unlockScore: 0, spriteKey: 'body_round' },
  { id: 'body_sleek', slot: 'body', name: 'Sleek', rarity: 'rare', unlockScore: 10, spriteKey: 'body_sleek' },
  { id: 'body_chunky', slot: 'body', name: 'Chunky', rarity: 'epic', unlockScore: 25, spriteKey: 'body_chunky' },
  { id: 'wing_basic', slot: 'wing', name: 'Basic', rarity: 'common', unlockScore: 0, spriteKey: 'wing_basic' },
  { id: 'wing_pointed', slot: 'wing', name: 'Pointed', rarity: 'rare', unlockScore: 8, spriteKey: 'wing_pointed' },
  { id: 'wing_feathered', slot: 'wing', name: 'Feathered', rarity: 'epic', unlockScore: 20, spriteKey: 'wing_feathered' },
  { id: 'hat_none', slot: 'hat', name: 'None', rarity: 'common', unlockScore: 0, spriteKey: 'hat_none' },
  { id: 'hat_cap', slot: 'hat', name: 'Cap', rarity: 'rare', unlockScore: 5, spriteKey: 'hat_cap' },
  { id: 'hat_antenna', slot: 'hat', name: 'Antenna', rarity: 'rare', unlockScore: 15, spriteKey: 'hat_antenna' },
  { id: 'hat_crown', slot: 'hat', name: 'Crown', rarity: 'epic', unlockScore: 35, spriteKey: 'hat_crown' },
  { id: 'trail_none', slot: 'trail', name: 'None', rarity: 'common', unlockScore: 0, spriteKey: 'trail_none' },
  { id: 'trail_spark', slot: 'trail', name: 'Sparks', rarity: 'rare', unlockScore: 12, spriteKey: 'trail_spark' },
  { id: 'trail_rainbow', slot: 'trail', name: 'Rainbow', rarity: 'epic', unlockScore: 30, spriteKey: 'trail_rainbow' },
];

const ITEMS_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

export function getItem(id: string): Item | undefined {
  return ITEMS_BY_ID.get(id);
}

export const DEFAULT_ITEM_IDS = ITEMS.filter((item) => item.unlockScore === 0).map((item) => item.id);

export const DEFAULT_LOADOUT: Loadout = {
  body: 'body_round',
  wing: 'wing_basic',
  hat: 'hat_none',
  trail: 'trail_none',
  colors: { body: 0xffd23f, wing: 0xff8f1f, trail: 0x36e2ff },
};

export function sameLoadout(a: Loadout, b: Loadout): boolean {
  return (
    COSMETIC_SLOTS.every((slot) => a[slot] === b[slot]) &&
    a.colors.body === b.colors.body &&
    a.colors.wing === b.colors.wing &&
    a.colors.trail === b.colors.trail
  );
}
