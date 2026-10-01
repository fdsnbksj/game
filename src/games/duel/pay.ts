import { cardOf, RESOURCES, wonderOf, type Cost, type Res } from './cards';

// Paying for a card or a wonder. Resources you make yourself are free; the rest are bought
// from the bank, one unit at a time, at 2 coins plus however many of that resource your
// opponent makes with brown and grey cards, or 1 coin if one of your commercial cards
// fixes its price. Choice cards (one of several each turn) are tried every way round,
// and the cheapest payment wins.

/** What a player's city has built, as far as paying goes. */
export interface Builder {
  cards: string[];
  /** Built wonders. */
  wonders: string[];
}

export interface Payment {
  /** The card's own coin cost. */
  coins: number;
  /** Coins spent buying resources from the bank. */
  trade: number;
  total: number;
}

/** Fixed production from brown and grey cards. */
export function production(cards: readonly string[]): Record<Res, number> {
  const out = { wood: 0, clay: 0, stone: 0, glass: 0, papyrus: 0 };
  for (const id of cards) {
    const produces = cardOf(id).produces;
    if (produces) for (const [res, n] of Object.entries(produces) as [Res, number][]) out[res] += n;
  }
  return out;
}

/** The bank's price for each resource, for `me` buying while `them` holds what they hold. */
export function prices(me: Builder, them: Builder): Record<Res, number> {
  const theirs = production(them.cards);
  const fixed = new Set(me.cards.flatMap((id) => cardOf(id).fixes ?? []));
  return Object.fromEntries(RESOURCES.map((res) => [res, fixed.has(res) ? 1 : 2 + theirs[res]])) as Record<Res, number>;
}

/** Choice sources: commercial cards and wonders that give one of several resources each turn. */
function choices(me: Builder): Res[][] {
  return [...me.cards.map((id) => cardOf(id).choice), ...me.wonders.map((id) => wonderOf(id).choice)].filter((c): c is Res[] => !!c);
}

/**
 * The cheapest way for `me` to pay `cost`, or null if `coins` won't cover it. `discount`
 * resource units are free (2 for wonders or blue cards with the matching progress
 * token); they come off the dearest units you'd otherwise buy.
 */
export function payment(me: Builder, them: Builder, cost: Cost, coins: number, discount = 0): Payment | null {
  const own = production(me.cards);
  const price = prices(me, them);
  const sources = choices(me);
  const need = RESOURCES.map((res) => Math.max(0, (cost.res?.[res] ?? 0) - own[res]));
  let best = Infinity;

  // Every way of using each choice source for one of its resources (or none).
  const walk = (i: number, still: number[]) => {
    if (i === sources.length) {
      const units = still.flatMap((n, k) => Array<number>(n).fill(price[RESOURCES[k]])).sort((a, b) => b - a);
      const trade = units.slice(discount).reduce((sum, p) => sum + p, 0);
      best = Math.min(best, trade);
      return;
    }
    walk(i + 1, still);
    for (const res of sources[i]) {
      const k = RESOURCES.indexOf(res);
      if (still[k] === 0) continue;
      const next = [...still];
      next[k]--;
      walk(i + 1, next);
    }
  };
  walk(0, need);

  const total = (cost.coins ?? 0) + best;
  return total <= coins ? { coins: cost.coins ?? 0, trade: best, total } : null;
}
