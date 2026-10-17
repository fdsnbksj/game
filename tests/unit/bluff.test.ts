import { describe, expect, it } from 'vitest';
import { botMove } from '../../src/games/bluff/bot';
import { apply, CHAMBERS, claim, HAND, isTrue, mustCall, replay, start, type BluffState, type Card, type Recorded } from '../../src/games/bluff/state';
import { stream } from '../../src/nonogram/rng';
import { hashSeed } from '../../src/shared/random';

// Bluff Table: each rule, then whole games of bots and random players to a winner.

/** A state with chosen hands and table card, for testing one rule. */
function table(hands: Card[][], over: Partial<BluffState> = {}): BluffState {
  const s = start('t', hands.length);
  return { ...s, players: s.players.map((p, i) => ({ ...p, hand: hands[i], bullet: 6 })), table: 'Q', turn: 0, ...over };
}

describe('the deal', () => {
  it('gives everyone five from a twenty-card deck, the same for a seed', () => {
    const s = start('deal', 4);
    expect(s.players.every((p) => p.hand.length === HAND)).toBe(true);
    const all = s.players.flatMap((p) => p.hand);
    expect(all.filter((c) => c === 'J').length).toBeLessThanOrEqual(2);
    for (const r of ['K', 'Q', 'A'] as const) expect(all.filter((c) => c === r).length).toBeLessThanOrEqual(6);
    expect(start('deal', 4)).toEqual(s);
    expect(s.players.every((p) => p.bullet >= 1 && p.bullet <= CHAMBERS)).toBe(true);
  });
});

describe('a play', () => {
  it('puts 1–3 of your cards down and passes to the next player', () => {
    const s = table([['Q', 'K', 'A', 'J', 'Q'], ['K', 'K', 'K', 'K', 'K'], ['A', 'A', 'A', 'A', 'A']]);
    const t = apply(s, { type: 'play', cards: [1, 2] }, 0)!;
    expect(t.players[0].hand).toEqual(['Q', 'J', 'Q']);
    expect(t.last).toEqual({ by: 0, cards: ['K', 'A'] });
    expect(t.turn).toBe(1);
    expect(t.pile).toBe(2);
  });

  it('refuses out of turn, none, more than three, repeats and cards you lack', () => {
    const s = table([['Q', 'K', 'A', 'J', 'Q'], ['K', 'K', 'K', 'K', 'K']]);
    expect(apply(s, { type: 'play', cards: [0] }, 1)).toBeNull();
    expect(apply(s, { type: 'play', cards: [] }, 0)).toBeNull();
    expect(apply(s, { type: 'play', cards: [0, 1, 2, 3] }, 0)).toBeNull();
    expect(apply(s, { type: 'play', cards: [1, 1] }, 0)).toBeNull();
    expect(apply(s, { type: 'play', cards: [5] }, 0)).toBeNull();
    expect(apply(s, { type: 'call' }, 0)).toBeNull();
  });

  it('skips players with no cards', () => {
    const s = table([['Q'], [], ['A', 'A']]);
    expect(apply(s, { type: 'play', cards: [0] }, 0)!.turn).toBe(2);
  });

  it('makes the last one holding cards call', () => {
    const s = table([['Q'], ['K', 'K']]);
    const t = apply(s, { type: 'play', cards: [0] }, 0)!;
    expect(t.turn).toBe(1);
    expect(mustCall(t)).toBe(true);
    expect(apply(t, { type: 'play', cards: [0] }, 1)).toBeNull();
    expect(apply(t, { type: 'call' }, 1)).not.toBeNull();
  });
});

describe('a call', () => {
  it('on a lie: the liar pulls the trigger, and a new round is dealt', () => {
    const s = table([['K', 'Q', 'Q', 'Q', 'Q'], ['A', 'A', 'A', 'A', 'A']]);
    const t = apply(apply(s, { type: 'play', cards: [0] }, 0)!, { type: 'call' }, 1)!;
    expect(t.showdowns.at(-1)).toMatchObject({ caller: 1, accused: 0, cards: ['K'], lied: true, shooter: 0, pull: 1, died: false });
    expect(t.players[0].pulls).toBe(1);
    expect(t.round).toBe(1);
    expect(t.turn).toBe(0);
    expect(t.players.every((p) => p.hand.length === HAND)).toBe(true);
    expect(t.last).toBeNull();
  });

  it('on the truth (jokers count): the caller pulls', () => {
    const s = table([['Q', 'J', 'K', 'K', 'K'], ['A', 'A', 'A', 'A', 'A']]);
    const t = apply(apply(s, { type: 'play', cards: [0, 1] }, 0)!, { type: 'call' }, 1)!;
    expect(t.showdowns.at(-1)).toMatchObject({ lied: false, shooter: 1 });
    expect(isTrue('J', 'K')).toBe(true);
  });

  it('the bullet ends it: the last one standing wins', () => {
    const s = table([['K', 'Q', 'Q', 'Q', 'Q'], ['A', 'A', 'A', 'A', 'A']]);
    s.players[0].bullet = 1;
    const t = apply(apply(s, { type: 'play', cards: [0] }, 0)!, { type: 'call' }, 1)!;
    expect(t.showdowns.at(-1)!.died).toBe(true);
    expect(t.players[0].alive).toBe(false);
    expect(t.winner).toBe(1);
    expect(apply(t, { type: 'play', cards: [0] }, 1)).toBeNull();
  });

  it('with three players, one going out deals the rest in, the next one leading', () => {
    const s = table([['K', 'Q', 'Q', 'Q', 'Q'], ['A', 'A', 'A', 'A', 'A'], ['Q', 'Q', 'Q', 'Q', 'Q']]);
    s.players[0].bullet = 1;
    const t = apply(apply(s, { type: 'play', cards: [0] }, 0)!, { type: 'call' }, 1)!;
    expect(t.winner).toBeNull();
    expect(t.players[0].hand).toEqual([]);
    expect(t.turn).toBe(1);
  });

  it('every revolver fires by its sixth pull at the latest', () => {
    let s = table([['K', 'K', 'K', 'K', 'K'], ['A', 'A', 'A', 'A', 'A']]);
    s.players[0].bullet = 6;
    for (let i = 0; i < 6 && s.winner === null; i++) {
      s = { ...s, players: s.players.map((p) => ({ ...p, hand: ['A', 'A', 'A', 'A', 'A'] })), table: 'K', turn: 0, last: null };
      s = apply(apply(s, { type: 'play', cards: [0] }, 0)!, { type: 'call' }, 1)!;
    }
    expect(s.players[0].pulls).toBe(6);
    expect(s.winner).toBe(1);
  });
});

describe('words', () => {
  it('says a claim out loud', () => {
    expect(claim(1, 'Q')).toBe('One queen');
    expect(claim(3, 'A')).toBe('Three aces');
  });
});

describe('whole games', () => {
  it('bots and random players always reach a winner, and replay the same', () => {
    for (let g = 0; g < 300; g++) {
      const seats = Array.from({ length: 2 + (g % 3) }, (_, i) => `p${i}`);
      const seed = `game${g}`;
      let s = start(seed, seats.length);
      const rng = stream(`${seed}:test`);
      const moves: Recorded[] = [];
      for (let t = 0; t < 2000 && s.winner === null; t++) {
        const seat = s.turn;
        let move = g % 2 === 0 || seat === 0 ? botMove(s, seat) : null;
        if (!move) {
          const hand = s.players[seat].hand.length;
          move = s.last && (mustCall(s) || rng(3) === 0) ? { type: 'call' } : { type: 'play', cards: [...new Set([rng(hand), rng(hand)])] };
        }
        const next = apply(s, move, seat);
        expect(next).not.toBeNull();
        moves.push({ by: seats[seat], move });
        s = next!;
      }
      expect(s.winner).not.toBeNull();
      expect(s.players.filter((p) => p.alive)).toHaveLength(1);
      expect(replay(seed, seats, moves)).toEqual(s);
    }
  });

  it('match the golden game (change it only when games would replay differently)', () => {
    let s = start('golden', 3);
    while (s.winner === null) s = apply(s, botMove(s, s.turn)!, s.turn)!;
    expect(hashSeed(JSON.stringify(s))).toBe(1399835672);
  });
});
