import type { Item, Loadout, Slot } from './types';

/** Back-to-front draw order for character layers. */
export const LAYER_ORDER: readonly Slot[] = ['body', 'outfit', 'hair', 'accessory'];

// Firestore rules read unlock scores from items/{id}, so run `npm run seed` after editing this list.
export const ITEMS: readonly Item[] = [
  { id: 'body_basic', slot: 'body', name: 'Classic', rarity: 'common', unlockScore: 0, spriteKey: 'body_basic' },
  { id: 'body_round', slot: 'body', name: 'Round', rarity: 'rare', unlockScore: 25, spriteKey: 'body_round' },
  { id: 'outfit_basic', slot: 'outfit', name: 'T-shirt', rarity: 'common', unlockScore: 0, spriteKey: 'outfit_basic' },
  { id: 'outfit_hoodie', slot: 'outfit', name: 'Hoodie', rarity: 'rare', unlockScore: 15, spriteKey: 'outfit_hoodie' },
  { id: 'outfit_armor', slot: 'outfit', name: 'Armor', rarity: 'epic', unlockScore: 35, spriteKey: 'outfit_armor' },
  { id: 'hair_basic', slot: 'hair', name: 'Short', rarity: 'common', unlockScore: 0, spriteKey: 'hair_basic' },
  { id: 'hair_spiky', slot: 'hair', name: 'Spiky', rarity: 'rare', unlockScore: 20, spriteKey: 'hair_spiky' },
  { id: 'hair_long', slot: 'hair', name: 'Long', rarity: 'epic', unlockScore: 30, spriteKey: 'hair_long' },
  { id: 'acc_none', slot: 'accessory', name: 'None', rarity: 'common', unlockScore: 0, spriteKey: 'acc_none' },
  { id: 'acc_glasses', slot: 'accessory', name: 'Glasses', rarity: 'rare', unlockScore: 10, spriteKey: 'acc_glasses' },
  { id: 'acc_crown', slot: 'accessory', name: 'Crown', rarity: 'epic', unlockScore: 40, spriteKey: 'acc_crown' },
];

const ITEMS_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

export function getItem(id: string): Item | undefined {
  return ITEMS_BY_ID.get(id);
}

export const DEFAULT_ITEM_IDS = ITEMS.filter((item) => item.unlockScore === 0).map((item) => item.id);

export const DEFAULT_LOADOUT: Loadout = {
  body: 'body_basic',
  hair: 'hair_basic',
  outfit: 'outfit_basic',
  accessory: 'acc_none',
  colors: { skin: 0xf2c9a0, hair: 0x3b2a20, outfit: 0x3a7bd5 },
};

export function sameLoadout(a: Loadout, b: Loadout): boolean {
  return (
    LAYER_ORDER.every((slot) => a[slot] === b[slot]) &&
    a.colors.skin === b.colors.skin &&
    a.colors.hair === b.colors.hair &&
    a.colors.outfit === b.colors.outfit
  );
}
