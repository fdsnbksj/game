import { stream, type Rng } from '../../nonogram/rng';
import { AGE_I, AGE_II, AGE_III, BOARDS, GUILDS, type Card } from './cards';

// Everything random is decided by the room's seed, so every phone deals the same game.

/** A card in a deck: `age:id:copy`, since a deck can hold two of the same card. */
export const instance = (age: number, id: string, copy: number) => `${age}:${id}:${copy}`;
export const baseId = (inst: string) => inst.split(':')[1];

export type SideChoice = 'A' | 'B' | 'random';

export interface Setup {
  /** Each seat's wonder board and side. */
  boards: { id: string; side: 'A' | 'B' }[];
  /** The hands dealt at the start of each age, by seat. */
  hands: Record<1 | 2 | 3, string[][]>;
}

function shuffle<T>(list: readonly T[], rng: Rng): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** An age's cards for `players` players: one copy per marking at or below the count. */
export function deck(cards: Card[], players: number, age: number): string[] {
  return cards.flatMap((card) => card.players.filter((p) => p <= players).map((_, copy) => instance(age, card.id, copy)));
}

export function setup(seed: string, players: number, sides: SideChoice): Setup {
  const rng = (name: string) => stream(`wonders:${seed}:${name}`);
  const boards = shuffle(BOARDS, rng('boards'))
    .slice(0, players)
    .map((b, i) => ({ id: b.id, side: sides === 'random' ? (rng(`side:${i}`)(2) === 0 ? 'A' : 'B') : sides }) as const);
  const guilds = shuffle(GUILDS, rng('guilds'))
    .slice(0, players + 2)
    .map((g) => instance(3, g.id, 0));
  const decks = { 1: deck(AGE_I, players, 1), 2: deck(AGE_II, players, 2), 3: [...deck(AGE_III, players, 3), ...guilds] };
  const hands = {} as Setup['hands'];
  for (const age of [1, 2, 3] as const) {
    const shuffled = shuffle(decks[age], rng(`age${age}`));
    hands[age] = Array.from({ length: players }, (_, seat) => shuffled.slice(seat * 7, seat * 7 + 7));
  }
  return { boards, hands };
}
