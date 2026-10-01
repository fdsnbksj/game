import { describe, expect, it } from 'vitest';
import { AGE_I, AGE_II, AGE_III, ALL_CARDS, BOARDS, cardOf, GUILDS } from '../../src/games/wonders/cards';
import { baseId, deck, setup } from '../../src/games/wonders/setup';

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
