import { describe, expect, it } from 'vitest';
import { getUnit, POOL_SIZE, SHOP_SIZE, UNITS } from '../../src/sim/balance';
import { rollShop } from '../../src/sim/shop';

describe('shop', () => {
  it('rolls the same shop for the same seed', () => {
    expect(rollShop('run:shop:3:0', 5, {})).toEqual(rollShop('run:shop:3:0', 5, {}));
  });

  it('rolls a different shop after a reroll', () => {
    const rolls = [0, 1, 2, 3].map((n) => rollShop(`run:shop:3:${n}`, 5, {}).join());
    expect(new Set(rolls).size).toBeGreaterThan(1);
  });

  it('only offers 1-cost units at level 1', () => {
    for (let n = 0; n < 50; n++) {
      const shop = rollShop(`s${n}`, 1, {});
      expect(shop).toHaveLength(SHOP_SIZE);
      for (const id of shop) expect(getUnit(id!).cost).toBe(1);
    }
  });

  it('never offers a unit whose copies are all taken', () => {
    const taken = { sparkmouse: POOL_SIZE[1] };
    for (let n = 0; n < 100; n++) expect(rollShop(`s${n}`, 1, taken)).not.toContain('sparkmouse');
  });

  it('shows an empty slot once every affordable unit is gone', () => {
    const taken = Object.fromEntries(UNITS.map((unit) => [unit.id, POOL_SIZE[unit.cost]]));
    expect(rollShop('s', 8, taken)).toEqual([null, null, null, null, null]);
  });
});
