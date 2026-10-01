import { RESOURCES, type Cost, type Res } from './cards';

// Paying for a card or a wonder stage. What your city makes is free; anything else is
// bought from a neighbour, one unit at a time, at 2 coins (or 1 with a trade discount),
// from whatever their brown and grey cards and wonder board make. Buying doesn't use up
// their production. Every way of using choice cards (yours and theirs) is tried, and
// each unit goes to whichever neighbour is cheapest.

/** Resources a city can use (its own) or sell (to a neighbour). */
export interface Supply {
  fixed: Record<Res, number>;
  /** One of these, each turn, per entry. */
  choices: Res[][];
}

export interface Payment {
  /** The cost's own coins, to the bank. */
  coins: number;
  /** Coins to each neighbour for resources. */
  left: number;
  right: number;
  total: number;
}

export const emptySupply = (): Supply => ({ fixed: { wood: 0, stone: 0, clay: 0, ore: 0, glass: 0, cloth: 0, papyrus: 0 }, choices: [] });

/**
 * The cheapest payment for `cost`, or null if it can't be made with `coins`.
 * `price.left[res]` is what one unit costs from the left neighbour.
 */
export function payment(
  own: Supply,
  left: Supply,
  right: Supply,
  price: { left: Record<Res, number>; right: Record<Res, number> },
  cost: Cost,
  coins: number,
): Payment | null {
  const base = cost.coins ?? 0;
  if (base > coins) return null;
  const need = RESOURCES.map((res) => Math.max(0, (cost.res?.[res] ?? 0) - own.fixed[res]));
  if (need.every((n) => n === 0)) return { coins: base, left: 0, right: 0, total: base };

  let best: { left: number; right: number } | null = null;
  const budget = coins - base;
  // Neighbours' choice cards (brown double cards) are the only ones that branch; fixed
  // production is bought greedily, from the cheaper side first.
  const sellerChoices = [...left.choices.map((res) => ({ side: 'left' as const, res })), ...right.choices.map((res) => ({ side: 'right' as const, res }))];

  const settle = (still: number[], extra: { left: number[]; right: number[] }) => {
    let l = 0;
    let r = 0;
    for (let k = 0; k < RESOURCES.length; k++) {
      let n = still[k];
      if (n === 0) continue;
      const res = RESOURCES[k];
      const sides = (['left', 'right'] as const).slice().sort((x, y) => price[x][res] - price[y][res]);
      for (const side of sides) {
        const have = (side === 'left' ? left : right).fixed[res] + extra[side][k];
        const take = Math.min(n, have);
        if (side === 'left') l += take * price.left[res];
        else r += take * price.right[res];
        n -= take;
      }
      if (n > 0) return;
    }
    if (l + r <= budget && (!best || l + r < best.left + best.right)) best = { left: l, right: r };
  };

  const walkSellers = (j: number, still: number[], extra: { left: number[]; right: number[] }) => {
    if (j === sellerChoices.length) return settle(still, extra);
    walkSellers(j + 1, still, extra);
    const { side, res } = sellerChoices[j];
    for (const option of res) {
      const k = RESOURCES.indexOf(option);
      if (still[k] === 0) continue;
      const next = { ...extra, [side]: extra[side].map((n, i) => (i === k ? n + 1 : n)) };
      walkSellers(j + 1, still, next);
    }
  };

  /** Uses each of your own choice cards for one needed resource (or none), then buys the rest. */
  const walk = (i: number, still: number[]) => {
    if (i === own.choices.length) {
      if (still.every((n) => n === 0)) best = { left: 0, right: 0 };
      else walkSellers(0, still, { left: RESOURCES.map(() => 0), right: RESOURCES.map(() => 0) });
      return;
    }
    walk(i + 1, still);
    for (const res of own.choices[i]) {
      const k = RESOURCES.indexOf(res);
      if (still[k] === 0) continue;
      const next = [...still];
      next[k]--;
      walk(i + 1, next);
    }
  };
  walk(0, need);

  if (!best) return null;
  const { left: l, right: r } = best as { left: number; right: number };
  return { coins: base, left: l, right: r, total: base + l + r };
}
