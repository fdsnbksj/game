import { stream } from '../../nonogram/rng';
import { mustTake, takeCost, type Move, type PassState } from './state';

// A bot's move, from the state and the seed only (so it's the same on any phone). It takes
// a card that costs it little (one that joins its runs, or a fat pot), pays on the rest, and
// grows less choosy as its coins run low. Now and then it lets a card that joins its own run
// go round once more for the coins, when nobody else's cards sit next to it.

export function botMove(s: PassState, seat: number): Move | null {
  if (s.winners !== null || s.card === null || s.turn !== seat) return null;
  if (mustTake(s)) return { type: 'take' };
  const rng = stream(`${s.seed}:bot:${s.count}:${seat}`);
  const me = s.players[seat];
  const card = s.card;
  const cost = takeCost(me, card, s.pot);

  if (cost <= 0) {
    const fits = me.cards.includes(card - 1) || me.cards.includes(card + 1);
    const wanted = s.players.some((p, i) => i !== seat && (p.cards.includes(card - 1) || p.cards.includes(card + 1)));
    // Milk it: nobody else wants it, so let it come back with more coins.
    if (fits && !wanted && me.coins > 2 && s.pot < 4 && rng(100) < 60) return { type: 'pay' };
    return { type: 'take' };
  }

  // Choosier with a full purse; at a few coins left, anything middling will do.
  const limit = rng(4) + (me.coins <= 2 ? 12 : me.coins <= 4 ? 7 : me.coins <= 7 ? 3 : 0);
  return cost <= limit ? { type: 'take' } : { type: 'pay' };
}
