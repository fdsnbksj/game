import { describe, expect, it } from 'vitest';
import { LEVEL_XP, MAX_ROUNDS } from '../../src/sim/balance';
import { baseIncome, income, interest, levelForXp, maxGoldByRound, sellValue, xpGoldForLevel } from '../../src/sim/economy';

describe('economy', () => {
  it('ramps base income to 5', () => {
    expect([1, 2, 3, 4, 10].map(baseIncome)).toEqual([3, 4, 5, 5, 5]);
  });

  it('pays 1 interest per 10 gold, up to 5', () => {
    expect([0, 9, 10, 29, 50, 90].map(interest)).toEqual([0, 0, 1, 2, 5, 5]);
  });

  it('adds the win bonus', () => {
    expect(income(5, 20, true)).toBe(income(5, 20, false) + 1);
  });

  it('turns XP into levels', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(LEVEL_XP[4])).toBe(4);
    expect(levelForXp(LEVEL_XP[4] - 1)).toBe(3);
    expect(levelForXp(10_000)).toBe(8);
  });

  it('needs no XP gold for levels reached by round XP alone', () => {
    expect(xpGoldForLevel(2, 2)).toBe(0);
    expect(xpGoldForLevel(3, 2)).toBe(4);
  });

  it('refunds exactly what a unit cost', () => {
    expect(sellValue(2, 1)).toBe(2);
    expect(sellValue(2, 2)).toBe(6);
    expect(sellValue(3, 3)).toBe(27);
  });

  it('bounds gold by banking everything and winning every round', () => {
    const max = maxGoldByRound();
    expect(max).toHaveLength(MAX_ROUNDS + 1);
    expect(max[1]).toBe(3);
    for (let round = 2; round <= MAX_ROUNDS; round++) expect(max[round]).toBeGreaterThan(max[round - 1]);
  });
});
