import { costumeOf, type CostumeId } from './costumes';

// Your hero's look: a round, bouncy bean of a cartoon built from parts, every field an index into one of the
// catalogues below. Most parts are free; the ones marked `free: false` come from Summon
// (gacha.ts) and must be owned to wear. firestore.rules keeps a copy of each catalogue's
// size (tests/unit/rulesSync.test.ts compares them). Colours live in src/index.css.

export interface Part {
  id: string;
  name: string;
  free: boolean;
}

const free = (id: string, name: string): Part => ({ id, name, free: true });
const summoned = (id: string, name: string): Part => ({ id, name, free: false });

export const SKIN_TONES = 6;
export const COLOURS = 12;

export const FACES: readonly Part[] = [
  free('smile', 'Smile'),
  free('grin', 'Grin'),
  free('cool', 'Cool'),
  free('wink', 'Wink'),
  free('angry', 'Fierce'),
  free('surprised', 'Surprised'),
  free('sleepy', 'Sleepy'),
  free('smirk', 'Smirk'),
];

export const HAIRS: readonly Part[] = [
  free('none', 'None'),
  free('short', 'Short'),
  free('spiky', 'Spiky'),
  free('bob', 'Bob'),
  free('long', 'Long'),
  free('curly', 'Curly'),
  free('bun', 'Bun'),
  free('mohawk', 'Mohawk'),
  free('ponytail', 'Ponytail'),
];

export const HATS: readonly Part[] = [
  free('none', 'None'),
  free('cap', 'Cap'),
  free('beanie', 'Beanie'),
  free('bandana', 'Bandana'),
  summoned('crown', 'Crown'),
  summoned('tophat', 'Top hat'),
  summoned('viking', 'Viking helmet'),
  summoned('halo', 'Halo'),
  summoned('catears', 'Cat ears'),
  summoned('propeller', 'Propeller cap'),
  summoned('wizard', 'Wizard hat'),
  summoned('chef', 'Chef hat'),
];

export const SHIRTS: readonly Part[] = [free('tee', 'Tee'), free('hoodie', 'Hoodie'), free('jacket', 'Jacket'), summoned('armour', 'Armour')];

export const PANTS: readonly Part[] = [free('pants', 'Trousers'), free('shorts', 'Shorts')];

export const EXTRAS: readonly Part[] = [
  free('none', 'None'),
  summoned('sunglasses', 'Sunglasses'),
  summoned('scarf', 'Scarf'),
  summoned('cape', 'Cape'),
  summoned('wings', 'Wings'),
  summoned('headphones', 'Headphones'),
  summoned('sword', 'Back sword'),
];

export interface Look {
  skin: number;
  face: number;
  hair: number;
  hairColour: number;
  hat: number;
  shirt: number;
  shirtColour: number;
  pants: number;
  pantsColour: number;
  extra: number;
}

export type LookField = keyof Look;

/** Each field's number of choices. */
export const LOOK_SIZES: Record<LookField, number> = {
  skin: SKIN_TONES,
  face: FACES.length,
  hair: HAIRS.length,
  hairColour: COLOURS,
  hat: HATS.length,
  shirt: SHIRTS.length,
  shirtColour: COLOURS,
  pants: PANTS.length,
  pantsColour: COLOURS,
  extra: EXTRAS.length,
};

/** The parts behind a field, for those that have them (colours and skin tones are all free). */
export const PARTS_OF: Partial<Record<LookField, readonly Part[]>> = { face: FACES, hair: HAIRS, hat: HATS, shirt: SHIRTS, pants: PANTS, extra: EXTRAS };

export const DEFAULT_LOOK: Look = { skin: 1, face: 0, hair: 1, hairColour: 10, hat: 0, shirt: 0, shirtColour: 7, pants: 0, pantsColour: 10, extra: 0 };

/** The id a Summon part is owned under, like `hat:crown`. */
export const partItem = (field: LookField, part: Part) => `${field}:${part.id}`;

/** Every part that comes from Summon, by item id. */
export const SUMMON_PARTS: readonly string[] = (Object.keys(PARTS_OF) as LookField[]).flatMap((field) =>
  PARTS_OF[field]!.filter((p) => !p.free).map((p) => partItem(field, p)),
);

/** Whether this choice can be worn with what's owned. */
export function canWear(field: LookField, index: number, owned: readonly string[]): boolean {
  const part = PARTS_OF[field]?.[index];
  return !part || part.free || owned.includes(partItem(field, part));
}

/** A look from storage or the network, or null if any field is out of range. */
export function validLook(value: unknown): Look | null {
  if (!value || typeof value !== 'object') return null;
  const look = {} as Look;
  for (const field of Object.keys(LOOK_SIZES) as LookField[]) {
    const v = (value as Record<string, unknown>)[field];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= LOOK_SIZES[field]) return null;
    look[field] = v;
  }
  return look;
}

/** The look with any part you no longer own swapped for the free default. */
export function wearable(look: Look, owned: readonly string[]): Look {
  const out = { ...look };
  for (const field of Object.keys(PARTS_OF) as LookField[]) if (!canWear(field, out[field], owned)) out[field] = DEFAULT_LOOK[field];
  return out;
}

/** How a hero shows to others: its look and the costume it wears, if any. */
export interface Appearance {
  look: Look;
  costume: CostumeId | null;
}

export const PLAIN: Appearance = { look: DEFAULT_LOOK, costume: null };

/** An appearance from the network, or the plain one. */
export function appearanceOf(look: unknown, costume: unknown): Appearance {
  return { look: validLook(look) ?? DEFAULT_LOOK, costume: costumeOf(costume)?.id ?? null };
}
