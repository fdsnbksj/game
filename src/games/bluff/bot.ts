import { stream } from '../../nonogram/rng';
import { isTrue, MAX_PLAY, mustCall, TRUE_CARDS, type BluffState, type Move } from './state';

// A bot's move, from the state and the seed only (so it's the same on any phone). It plays
// true cards when it has them, a little bluff when it doesn't, and calls a liar when the
// claim can't be true or looks too good, more readily as the pile grows.

export function botMove(s: BluffState, seat: number): Move | null {
  if (s.winner !== null || s.turn !== seat) return null;
  const rng = stream(`${s.seed}:bot:${s.count}:${seat}`);
  const hand = s.players[seat].hand;

  if (s.last) {
    if (mustCall(s)) return { type: 'call' };
    const mine = hand.filter((c) => isTrue(c, s.table)).length;
    const claimed = s.last.cards.length;
    // More true cards than the deck holds: it has to be a lie.
    if (mine + claimed > TRUE_CARDS) return { type: 'call' };
    // Otherwise a hunch: bolder claims, a fuller pile and an empty hand all smell of a lie.
    const odds = 10 + claimed * 12 + s.pile * 3 + (hand.length === 0 ? 40 : 0) + (mine === 0 ? 10 : 0);
    if (rng(100) < odds) return { type: 'call' };
  }

  const truths = hand.map((c, i) => (isTrue(c, s.table) ? i : -1)).filter((i) => i >= 0);
  const lies = hand.map((c, i) => (isTrue(c, s.table) ? -1 : i)).filter((i) => i >= 0);
  if (truths.length > 0) {
    const n = Math.min(truths.length, MAX_PLAY, 1 + rng(2));
    // Now and then slip a lie in with the truth.
    const cards = truths.slice(0, n);
    if (lies.length > 0 && cards.length < MAX_PLAY && rng(100) < 20) cards.push(lies[0]);
    return { type: 'play', cards };
  }
  return { type: 'play', cards: lies.slice(0, Math.min(lies.length, 1 + (rng(100) < 25 ? 1 : 0))) };
}
