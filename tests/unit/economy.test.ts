import { describe, expect, it } from 'vitest';
import { LEVEL_XP } from '../../src/sim/balance';
import { baseIncome, dropsItem, income, interest, levelForXp, maxGold, maxItems, nextDropRound, sellValue, surgePercent, xpGoldForLevel } from '../../src/sim/economy';

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
    // Brute force: bank every coin, win every round.
    let bank = 0;
    for (let round = 1; round <= 200; round++) {
      bank += income(round, bank, round > 1);
      expect(maxGold(round)).toBe(bank);
    }
    expect(maxGold(1)).toBe(3);
    expect(maxGold(15)).toBe(133);
  });

  it('drops an item after rounds 2, 5, 8 and every third after', () => {
    const drops = Array.from({ length: 30 }, (_, i) => i + 1).filter(dropsItem);
    expect(drops).toEqual([2, 5, 8, 11, 14, 17, 20, 23, 26, 29]);
    expect(nextDropRound(1)).toBe(2);
    expect(nextDropRound(15)).toBe(17);
    for (let round = 1; round <= 60; round++) {
      expect(maxItems(round)).toBe(drops.concat([32, 35, 38, 41, 44, 47, 50, 53, 56, 59]).filter((d) => d < round).length);
    }
  });

  it('surges the rival only after round 15, compounding', () => {
    expect(surgePercent(1)).toBe(100);
    expect(surgePercent(15)).toBe(100);
    expect(surgePercent(16)).toBe(108);
    expect(surgePercent(17)).toBe(116);
    for (let round = 16; round <= 60; round++) expect(surgePercent(round)).toBeGreaterThan(surgePercent(round - 1));
  });
});
