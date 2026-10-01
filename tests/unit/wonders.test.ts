import { describe, expect, it } from 'vitest';
import { AGE_I, AGE_II, AGE_III, ALL_CARDS, BOARDS, cardOf, GUILDS } from '../../src/games/wonders/cards';
import { botMove } from '../../src/games/wonders/bot';
import { emptySupply, payment } from '../../src/games/wonders/pay';
import { baseId, deck, setup } from '../../src/games/wonders/setup';
import { apply, buildCost, leftOf, legalMoves, replay, rightOf, sciencePoints, score, start, waitingFor, type Move, type WondersState } from '../../src/games/wonders/state';
import { createRandom, hashSeed } from '../../src/shared/random';

describe('Ancient Wonders cards', () => {
  it('make seven cards per player in every age, for 3 to 7 players', () => {
    for (let n = 3; n <= 7; n++) {
      expect(deck(AGE_I, n, 1), `Age I, ${n} players`).toHaveLength(7 * n);
      expect(deck(AGE_II, n, 2), `Age II, ${n} players`).toHaveLength(7 * n);
      expect(deck(AGE_III, n, 3).length + n + 2, `Age III, ${n} players`).toBe(7 * n);
    }
    expect(GUILDS).toHaveLength(10);
  });

  it('chain only from cards of an earlier age', () => {
    for (const card of ALL_CARDS.filter((c) => c.chainFrom)) {
      for (const from of card.chainFrom!) {
        expect(cardOf(from), `${card.id} ← ${from}`).toBeDefined();
        expect(cardOf(from).age, `${card.id} ← ${from}`).toBeLessThan(card.age);
      }
    }
  });

  it('give every wonder both sides, each stage with a cost and an effect', () => {
    expect(BOARDS).toHaveLength(7);
    for (const board of BOARDS) {
      for (const side of ['A', 'B'] as const) {
        expect(board.sides[side].length, `${board.id} ${side}`).toBeGreaterThanOrEqual(2);
        for (const stage of board.sides[side]) {
          expect(Object.keys(stage.cost.res ?? {}).length, `${board.id} ${side}`).toBeGreaterThan(0);
          const { cost, ...effects } = stage;
          expect(Object.keys(effects).length, `${board.id} ${side} has an effect`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('Ancient Wonders setup', () => {
  it('deals the same game from the same seed, a different one otherwise', () => {
    expect(setup('s', 5, 'A')).toEqual(setup('s', 5, 'A'));
    expect(setup('s', 5, 'A')).not.toEqual(setup('t', 5, 'A'));
  });

  it('gives every seat its own wonder and seven cards an age, with players + 2 guilds', () => {
    for (let n = 3; n <= 7; n++) {
      const s = setup(`n${n}`, n, 'random');
      expect(new Set(s.boards.map((b) => b.id)).size).toBe(n);
      for (const age of [1, 2, 3] as const) {
        expect(s.hands[age]).toHaveLength(n);
        for (const hand of s.hands[age]) expect(hand).toHaveLength(7);
        expect(new Set(s.hands[age].flat()).size).toBe(7 * n);
      }
      expect(s.hands[3].flat().filter((c) => cardOf(baseId(c)).color === 'purple')).toHaveLength(n + 2);
    }
    expect(setup('x', 4, 'B').boards.every((b) => b.side === 'B')).toBe(true);
  });
});


const two = (n = 2) => ({ wood: n, stone: n, clay: n, ore: n, glass: n, cloth: n, papyrus: n });
const supply = (fixed: Partial<Record<string, number>> = {}, choices: string[][] = []) => {
  const s = emptySupply();
  Object.assign(s.fixed, fixed);
  s.choices = choices as never;
  return s;
};

describe('paying neighbours', () => {
  const price = { left: two(), right: two() };
  it('buys from whichever neighbour has it, at their price', () => {
    expect(payment(supply(), supply({ ore: 1 }), supply(), price, { res: { ore: 1 } }, 5)).toEqual({ coins: 0, left: 2, right: 0, total: 2 });
    const cheapRight = { left: two(), right: { ...two(), ore: 1 } };
    expect(payment(supply(), supply({ ore: 1 }), supply({ ore: 1 }), cheapRight, { res: { ore: 1 } }, 5)).toMatchObject({ left: 0, right: 1 });
  });

  it('uses choice cards on both sides, and splits across neighbours', () => {
    expect(payment(supply({}, [['wood', 'clay']]), supply(), supply(), price, { res: { clay: 1 } }, 0)!.total).toBe(0);
    expect(payment(supply(), supply({}, [['stone', 'ore']]), supply({ ore: 1 }), price, { res: { ore: 2 } }, 5)).toMatchObject({ left: 2, right: 2 });
  });

  it("refuses what no one makes, or you can't afford", () => {
    expect(payment(supply(), supply(), supply(), price, { res: { glass: 1 } }, 9)).toBeNull();
    expect(payment(supply(), supply({ glass: 1 }), supply(), price, { res: { glass: 1 } }, 1)).toBeNull();
  });
});

describe('science', () => {
  it('scores squares and sets, with wildcards placed best', () => {
    expect(sciencePoints(['compass', 'gear', 'tablet'], 0)).toBe(10);
    expect(sciencePoints(['compass', 'compass', 'compass'], 0)).toBe(9);
    expect(sciencePoints(['compass', 'gear'], 1)).toBe(10);
    expect(sciencePoints(['tablet', 'tablet'], 1)).toBe(9);
  });
});

/** Plays everyone's picks for one turn: `choose(seat)` picks a move, or the first legal one. */
function playTurn(s: WondersState, choose: (s: WondersState, seat: number) => Move = (x, seat) => legalMoves(x, seat)[0]): WondersState {
  let next = s;
  for (const seat of waitingFor(s)) next = apply(next, choose(next, seat), seat)!;
  return next;
}

describe('turns', () => {
  it('reveal everyone together and pass hands left, then right in Age II', () => {
    const s = start('pass', 4, 'A');
    const handOf0 = s.hands[0];
    let next = apply(s, { type: 'pick', age: 1, turn: 1, card: s.hands[0][0], as: 'discard' }, 0)!;
    // Not resolved until everyone has picked.
    expect(next.turn).toBe(1);
    expect(next.cities[0].coins).toBe(3);
    for (const seat of [1, 2, 3]) next = apply(next, { type: 'pick', age: 1, turn: 1, card: next.hands[seat][0], as: 'discard' }, seat)!;
    expect(next.turn).toBe(2);
    expect(next.cities.every((c) => c.coins === 6)).toBe(true);
    // Seat 0's hand (less the discard) went to its left neighbour.
    expect(next.hands[leftOf(next, 0)]).toEqual(handOf0.slice(1));
    let age2 = next;
    while (age2.age === 1) age2 = playTurn(age2, (x, seat) => ({ type: 'pick', age: x.age, turn: x.turn, card: x.hands[seat][0], as: 'discard' }));
    const before = age2.hands[0];
    const after = playTurn(age2, (x, seat) => ({ type: 'pick', age: x.age, turn: x.turn, card: x.hands[seat][0], as: 'discard' }));
    expect(after.hands[rightOf(after, 0)]).toEqual(before.slice(1));
  });

  it('pays neighbours at the end of the turn, not before', () => {
    const s = start('trade', 3, 'A');
    // Give seat 1 ore to sell, and seat 0 a card that needs ore.
    s.cities[1].cards.push('ore-seam');
    s.cities[0].board = 'giza';
    s.hands[0][0] = '1:muster-hall:0';
    const cost = buildCost(s, 0, 'muster-hall')!;
    expect(cost.total).toBe(2);
    const next = playTurn(s, (x, seat) =>
      seat === 0 ? { type: 'pick', age: 1, turn: 1, card: x.hands[0][0], as: 'build' } : { type: 'pick', age: 1, turn: 1, card: x.hands[seat][0], as: 'discard' },
    );
    expect(next.cities[0].coins).toBe(1);
    const payee = cost.left ? leftOf(s, 0) : rightOf(s, 0);
    expect(next.cities[payee].coins).toBe(3 + 3 + 2);
  });

  it('refuse a card not in your hand, a second pick, or a duplicate building', () => {
    const s = start('refuse', 3, 'A');
    expect(apply(s, { type: 'pick', age: 1, turn: 1, card: s.hands[1][0], as: 'discard' }, 0)).toBeNull();
    const once = apply(s, { type: 'pick', age: 1, turn: 1, card: s.hands[0][0], as: 'discard' }, 0)!;
    expect(apply(once, { type: 'pick', age: 1, turn: 1, card: once.hands[0][1], as: 'discard' }, 0)).toBeNull();
    s.cities[0].cards.push('shrine');
    s.hands[0][0] = '1:shrine:1';
    expect(apply(s, { type: 'pick', age: 1, turn: 1, card: '1:shrine:1', as: 'build' }, 0)).toBeNull();
  });
});

describe('ages and wonders', () => {
  const discardAll = (x: WondersState, seat: number): Move => ({ type: 'pick', age: x.age, turn: x.turn, card: x.hands[seat][0], as: 'discard' });

  it('fight both neighbours at the end of each age', () => {
    let s = start('war', 3, 'A');
    s.cities[0].cards.push('log-wall');
    while (s.age === 1) s = playTurn(s, discardAll);
    expect(s.cities[0].victories).toEqual([1, 1]);
    expect(s.cities[1].defeats + s.cities[2].defeats).toBe(2);
    expect(s.hands.every((h) => h.length === 7)).toBe(true);
  });

  it('let a Babylon B city play its seventh card', () => {
    let s = start('seventh', 3, 'B');
    s.cities[0].board = 'babylon';
    s.cities[0].side = 'B';
    s.cities[0].stages = 2;
    for (let t = 0; t < 6; t++) s = playTurn(s, discardAll);
    expect(s.turn).toBe(7);
    expect(waitingFor(s)).toEqual([0]);
    expect(s.hands[1]).toEqual([]);
    s = playTurn(s, discardAll);
    expect(s.age).toBe(2);
  });

  it('let a Halicarnassus city build from the discards after its stage', () => {
    let s = start('mausoleum', 3, 'A');
    s.cities[0].board = 'halicarnassus';
    s.cities[0].side = 'B';
    s.cities[0].coins = 20;
    s.discard.push('1:shrine:0');
    s.cities[1].cards.push('ore-seam', 'smelter');
    s = playTurn(s, (x, seat) => (seat === 0 ? { type: 'pick', age: 1, turn: 1, card: x.hands[0][0], as: 'wonder' } : discardAll(x, seat)));
    expect(waitingFor(s)).toEqual([0]);
    expect(s.reviving).toEqual([0]);
    s = apply(s, { type: 'revive', card: '1:shrine:0' }, 0)!;
    expect(s.cities[0].cards).toContain('shrine');
    expect(s.turn).toBe(2);
  });

  it('give Olympia one free build each age', () => {
    const s = start('zeus', 3, 'A');
    s.cities[0].board = 'olympia';
    s.cities[0].side = 'A';
    s.cities[0].stages = 2;
    s.cities[0].coins = 0;
    s.hands[0][0] = '1:bathhouse:0';
    const free: Move = { type: 'pick', age: 1, turn: 1, card: '1:bathhouse:0', as: 'build', free: true };
    const next = playTurn(s, (x, seat) => (seat === 0 ? free : discardAll(x, seat)));
    expect(next.cities[0].cards).toContain('bathhouse');
    expect(next.cities[0].freeUsed).toBe(1);
    next.hands[0][0] = '1:shrine:9';
    expect(apply(next, { ...free, turn: 2, card: '1:shrine:9' }, 0)).toBeNull();
  });

  it('let Olympia B copy the best neighbouring guild at the end', () => {
    const s = start('copy', 3, 'B');
    s.cities[0].board = 'olympia';
    s.cities[0].side = 'B';
    s.cities[0].stages = 3;
    s.cities[1].cards.push('union-judges');
    s.cities[2].cards.push('shrine', 'playhouse', 'bathhouse');
    s.cities[1].cards.push('shrine');
    // Judges: 1 point per blue card in this city's neighbours (1 + 3).
    expect(score(s, 0).purple).toBe(4);
  });
});

describe('whole games', () => {
  it('end properly for 3 to 7 players, with bots and with random moves, and replay the same', () => {
    for (let n = 3; n <= 7; n++) {
      for (let g = 0; g < 12; g++) {
        const random = createRandom(hashSeed(`w:${n}:${g}`));
        const seats = Array.from({ length: n }, (_, i) => `s${i}`);
        const sides = (['A', 'B', 'random'] as const)[g % 3];
        let s = start(`game-${n}-${g}`, n, sides);
        const recorded: { by: string; move: Move }[] = [];
        for (let step = 0; s.phase !== 'over'; step++) {
          expect(step, 'stuck').toBeLessThan(2000);
          const seat = waitingFor(s)[0];
          const moves = legalMoves(s, seat);
          const move = g % 2 ? botMove(s, seat)! : moves[Math.floor(random() * moves.length)];
          const next = apply(s, move, seat);
          expect(next, JSON.stringify(move)).not.toBeNull();
          s = next!;
          recorded.push({ by: seats[seat], move });
          for (const c of s.cities) expect(c.coins).toBeGreaterThanOrEqual(0);
        }
        expect(s.outcome!.scores).toHaveLength(n);
        expect(s.outcome!.winners.length).toBeGreaterThan(0);
        expect(replay(`game-${n}-${g}`, seats, sides, recorded).outcome).toEqual(s.outcome);
      }
    }
  });
});
