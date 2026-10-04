import { stream, type Rng } from '../../nonogram/rng';
import { HARBOUR_SLOTS, HEXES, hexNeighbours } from './board';

// The deal: which land is where, its numbers, the harbours and the order of the
// development cards. All from the room's seed, so every phone deals the same island.

export type Res = 'brick' | 'lumber' | 'wool' | 'grain' | 'ore';
export const RESOURCES: Res[] = ['brick', 'lumber', 'wool', 'grain', 'ore'];

export type Terrain = 'hills' | 'forest' | 'pasture' | 'fields' | 'mountains' | 'desert';
export const YIELD: Record<Terrain, Res | null> = { hills: 'brick', forest: 'lumber', pasture: 'wool', fields: 'grain', mountains: 'ore', desert: null };

export type Dev = 'knight' | 'point' | 'roads' | 'plenty' | 'monopoly';
/** A harbour trades one resource 2:1, or any 3:1. */
export type Harbour = Res | 'any';

export interface Setup {
  terrain: Terrain[];
  /** Each hex's number; null on the desert. */
  numbers: (number | null)[];
  /** By harbour slot (HARBOUR_SLOTS). */
  harbours: Harbour[];
  /** The development deck, top card first. */
  deck: Dev[];
}

const TERRAIN: Terrain[] = [
  ...Array<Terrain>(4).fill('forest'),
  ...Array<Terrain>(4).fill('pasture'),
  ...Array<Terrain>(4).fill('fields'),
  ...Array<Terrain>(3).fill('hills'),
  ...Array<Terrain>(3).fill('mountains'),
  'desert',
];
const NUMBERS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
const HARBOURS: Harbour[] = ['any', 'any', 'any', 'any', ...RESOURCES];
const DECK: Dev[] = [
  ...Array<Dev>(14).fill('knight'),
  ...Array<Dev>(5).fill('point'),
  ...Array<Dev>(2).fill('roads'),
  ...Array<Dev>(2).fill('plenty'),
  ...Array<Dev>(2).fill('monopoly'),
];

function shuffle<T>(list: readonly T[], rng: Rng): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Dots under a number: how many of the 36 rolls make it. */
export const pips = (n: number | null) => (n === null ? 0 : 6 - Math.abs(7 - n));

export function setup(seed: string): Setup {
  const rng = (name: string) => stream(`isle:${seed}:${name}`);
  const terrain = shuffle(TERRAIN, rng('terrain'));
  // Deal the numbers again until no two red ones (6 and 8) sit side by side.
  const numberRng = rng('numbers');
  let numbers: (number | null)[];
  do {
    const dealt = shuffle(NUMBERS, numberRng);
    numbers = terrain.map((t) => (t === 'desert' ? null : dealt.shift()!));
  } while (HEXES.some((_, i) => pips(numbers[i]) === 5 && hexNeighbours(i).some((j) => pips(numbers[j]) === 5)));
  return {
    terrain,
    numbers,
    harbours: shuffle(HARBOURS, rng('harbours')).slice(0, HARBOUR_SLOTS.length),
    deck: shuffle(DECK, rng('deck')),
  };
}
