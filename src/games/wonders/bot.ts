import { stream } from '../../nonogram/rng';
import { cardOf, type Card } from './cards';
import { baseId } from './setup';
import { buildCost, canBuildFree, leftOf, legalMoves, ownSupply, rightOf, sciencePoints, shieldsOf, stageCost, stagesOf, type Move, type WondersState } from './state';

// A simple, steady player for empty seats. It scores every legal move by rough value and
// takes the best, breaking ties with the room's seed so every phone agrees on its choice.
// Not strong: it builds sensibly, keeps up with its neighbours' shields, and finishes chains.

function cardValue(s: WondersState, seat: number, card: Card): number {
  const city = s.cities[seat];
  const own = ownSupply(city);
  switch (card.color) {
    case 'brown':
    case 'grey': {
      // Resources matter early; a kind you don't make yet matters most.
      const makes = [...Object.keys(card.produces ?? {}), ...(card.choice ?? [])];
      const fresh = makes.some((res) => own.fixed[res as keyof typeof own.fixed] === 0);
      return (fresh ? 4 : 1.5) * [1.2, 0.8, 0.2][s.age - 1];
    }
    case 'blue':
      return card.points ?? 0;
    case 'green': {
      const symbols = city.cards.map(cardOf).flatMap((c) => (c.science ? [c.science] : []));
      return sciencePoints([...symbols, card.science!], 0) - sciencePoints(symbols, 0) + 1;
    }
    case 'red': {
      // Worth most when it wins or saves a battle with a neighbour.
      const mine = shieldsOf(city);
      const near = [leftOf(s, seat), rightOf(s, seat)].map((i) => shieldsOf(s.cities[i]));
      const swing = near.filter((t) => mine <= t && mine + card.shields! > t).length;
      return 1 + swing * [1.5, 2.5, 4][s.age - 1];
    }
    case 'yellow':
      return (card.coins ?? 0) / 3 + (card.pointsPer ? 3 : 0) + (card.discount ? 2 * (s.age === 1 ? 1 : 0.4) : 0) + (card.choice ? 2 : 0) + (card.coinsPer ? 1.5 : 0);
    case 'purple':
      return 4;
  }
}

/** The bot's move for `seat` now, or null if it has nothing to do. */
export function botMove(s: WondersState, seat: number): Move | null {
  const moves = legalMoves(s, seat);
  if (!moves.length) return null;
  const rng = stream(`wonders:${s.seed}:bot:${seat}:${s.age}:${s.turn}:${s.reviving.length}`);
  const city = s.cities[seat];
  const value = (m: Move): number => {
    if (m.type === 'revive') return m.card ? cardValue(s, seat, cardOf(baseId(m.card))) : 0;
    const card = cardOf(baseId(m.card));
    if (m.as === 'discard') return 0.5 + (city.coins < 3 ? 1 : 0);
    if (m.as === 'wonder') {
      const stage = stagesOf(city)[city.stages];
      const cost = stageCost(s, seat)!.total;
      return 3 + (stage.points ?? 0) * 0.7 + (stage.coins ?? 0) / 3 + (stage.shields ?? 0) * 1.5 - cost * 0.3 + (s.age === 3 ? 2 : 0);
    }
    const cost = m.free ? 0 : buildCost(s, seat, card.id)!.total;
    // Save the free build for something worth it.
    const freeBonus = m.free ? (canBuildFree(s, seat) ? -1 : 0) : 0;
    return cardValue(s, seat, card) - cost * 0.35 + freeBonus;
  };
  const scored = moves.map((m) => ({ m, v: value(m) + rng(1000) / 100000 }));
  scored.sort((a, b) => b.v - a.v);
  return scored[0].m;
}
