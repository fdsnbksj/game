import { stream, type Rng } from '../../nonogram/rng';
import { AGE_I, AGE_II, AGE_III, GUILDS, TOKENS, WONDERS, type TokenId } from './cards';

// Everything random is decided by the room's seed, so both phones lay out the same game.

/** A place in an age's layout. `x` is in half-card steps, so overlapping cards differ by 1. */
export interface SlotShape {
  row: number;
  x: number;
  faceUp: boolean;
}

/** Row sizes, top to bottom, and where each row starts (half-card steps). */
function rows(counts: number[], starts?: number[]): SlotShape[] {
  const slots: SlotShape[] = [];
  counts.forEach((count, row) => {
    const start = starts ? starts[row] : -(count - 1);
    for (let i = 0; i < count; i++) {
      // Rows alternate face up and face down, starting face up at the top.
      slots.push({ row, x: start + 2 * i, faceUp: row % 2 === 0 });
    }
  });
  return slots;
}

/**
 * The three layouts, 20 cards each: a pyramid, the same upside down, and an hourglass
 * with a gap in its middle row.
 */
export const LAYOUTS: Record<1 | 2 | 3, SlotShape[]> = {
  1: rows([2, 3, 4, 5, 6]),
  2: rows([6, 5, 4, 3, 2]),
  3: rows([2, 3, 4, 2, 4, 3, 2], [-1, -2, -3, -2, -3, -2, -1]).map((s) => (s.row === 3 && s.x === 0 ? { ...s, x: 2 } : s)),
};

/** Which slots cover slot `i`: those in the next row that overlap it by half a card. */
export function coveredBy(layout: SlotShape[], i: number): number[] {
  const s = layout[i];
  return layout.flatMap((o, j) => (o.row === s.row + 1 && Math.abs(o.x - s.x) === 1 ? [j] : []));
}

export interface Setup {
  /** The cards of each age, in slot order. */
  ages: Record<1 | 2 | 3, string[]>;
  /** Progress tokens on the board, and those left out (for the Great Library). */
  boardTokens: TokenId[];
  boxTokens: TokenId[];
  /** Wonders for the draft: two groups of four. */
  wonderGroups: [string[], string[]];
  /** Which player (0 or 1) drafts first and starts Age I. */
  first: 0 | 1;
}

function shuffle<T>(list: readonly T[], rng: Rng): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function setup(seed: string): Setup {
  const rng = (name: string) => stream(`duel:${seed}:${name}`);
  const ids = (cards: { id: string }[]) => cards.map((c) => c.id);
  // Three cards of each age stay in the box; Age III gets three guilds instead.
  const age1 = shuffle(ids(AGE_I), rng('age1')).slice(0, 20);
  const age2 = shuffle(ids(AGE_II), rng('age2')).slice(0, 20);
  const guilds = shuffle(ids(GUILDS), rng('guilds')).slice(0, 3);
  const age3 = shuffle([...shuffle(ids(AGE_III), rng('age3')).slice(0, 17), ...guilds], rng('age3-mix'));
  const tokens = shuffle(TOKENS.map((t) => t.id), rng('tokens'));
  const wonders = shuffle(ids(WONDERS), rng('wonders'));
  return {
    ages: { 1: age1, 2: age2, 3: age3 },
    boardTokens: tokens.slice(0, 5),
    boxTokens: tokens.slice(5),
    wonderGroups: [wonders.slice(0, 4), wonders.slice(4, 8)],
    first: rng('first')(2) as 0 | 1,
  };
}
