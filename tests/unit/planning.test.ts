import { describe, expect, it } from 'vitest';
import { getUnit, REROLL_COST, XP_COST } from '../../src/sim/balance';
import type { BattleResult } from '../../src/sim/combat';
import { buy, buyXp, equip, finishRound, move, newRun, ownedUnits, reroll, sell, unequip, type RunState } from '../../src/sim/planning';

/** A run with a hand-picked shop and plenty of gold. */
function runWith(shop: string[], gold = 50, extra: Partial<RunState> = {}): RunState {
  return { ...newRun('test'), shop, gold, ...extra };
}

const result = (winner: 'a' | 'b' | 'draw', survivorStars = 0) =>
  ({ winner, survivorStars, ticks: 1, fighters: [], events: [] }) as BattleResult;

describe('planning', () => {
  it('starts round 1 with 3 gold and a full shop', () => {
    const run = newRun('seed');
    expect(run.gold).toBe(3);
    expect(run.shop.filter(Boolean)).toHaveLength(5);
  });

  it('buys a unit onto the bench and charges its cost', () => {
    const run = buy(runWith(['bytebat']), 0);
    expect(run.gold).toBe(50 - getUnit('bytebat').cost);
    expect(run.bench[0]?.unitId).toBe('bytebat');
    expect(run.shop[0]).toBeNull();
  });

  it("won't buy without the gold", () => {
    const start = runWith(['nullserpent'], 4);
    expect(buy(start, 0)).toBe(start);
  });

  it('combines three copies into a 2-star', () => {
    let run = runWith(['sparkmouse', 'sparkmouse', 'sparkmouse']);
    run = buy(buy(buy(run, 0), 1), 2);
    const owned = ownedUnits(run);
    expect(owned).toHaveLength(1);
    expect(owned[0]).toMatchObject({ unitId: 'sparkmouse', star: 2 });
  });

  it('keeps the combined unit on the board when a copy was there', () => {
    let run = runWith(['sparkmouse', 'sparkmouse', 'sparkmouse']);
    run = buy(run, 0);
    run = move(run, { area: 'bench', index: 0 }, { area: 'board', index: 3 });
    run = buy(buy(run, 1), 2);
    expect(run.board[3]).toMatchObject({ unitId: 'sparkmouse', star: 2 });
    expect(run.bench.every((slot) => slot === null)).toBe(true);
  });

  it('combines nine copies into a 3-star', () => {
    let run = runWith(Array(5).fill('voltmoth'), 100);
    run = buy(buy(buy(buy(buy(run, 0), 1), 2), 3), 4);
    run = { ...run, shop: Array(5).fill('voltmoth') };
    run = buy(buy(buy(buy(run, 0), 1), 2), 3);
    expect(ownedUnits(run)).toEqual([expect.objectContaining({ unitId: 'voltmoth', star: 3 })]);
  });

  it('buys onto a full bench when the copy completes a 2-star', () => {
    const filler = { uid: 900, unitId: 'chromeshell', star: 1 as const };
    let run = runWith(['glitchtoad'], 50, {
      bench: [
        { uid: 1, unitId: 'glitchtoad', star: 1 },
        { uid: 2, unitId: 'glitchtoad', star: 1 },
        ...Array.from({ length: 7 }, (_, i) => ({ ...filler, uid: 900 + i })),
      ],
    });
    run = buy(run, 0);
    expect(run.bench).toHaveLength(9);
    expect(ownedUnits(run).find((u) => u.unitId === 'glitchtoad')).toMatchObject({ star: 2 });
  });

  it('refunds the full cost on selling', () => {
    let run = buy(runWith(['ironhog']), 0);
    run = sell(run, { area: 'bench', index: 0 });
    expect(run.gold).toBe(50);
    expect(ownedUnits(run)).toHaveLength(0);
  });

  it("won't put more units on the board than the level allows", () => {
    let run = buy(buy(runWith(['voltmoth', 'glitchtoad']), 0), 1);
    expect(run.level).toBe(1);
    run = move(run, { area: 'bench', index: 0 }, { area: 'board', index: 0 });
    const blocked = move(run, { area: 'bench', index: 1 }, { area: 'board', index: 1 });
    expect(blocked).toBe(run);
    // Swapping keeps the count the same, so it's allowed.
    const swapped = move(run, { area: 'bench', index: 1 }, { area: 'board', index: 0 });
    expect(swapped.board[0]?.unitId).toBe('glitchtoad');
  });

  it('charges for rerolls and XP', () => {
    const start = runWith([]);
    expect(reroll(start).gold).toBe(50 - REROLL_COST);
    expect(reroll(start).shop).toEqual(reroll(start).shop);
    const leveled = buyXp(start);
    expect(leveled.gold).toBe(50 - XP_COST);
    expect(leveled.level).toBe(2);
  });

  it('pays income and XP at the start of the next round', () => {
    const run = finishRound(newRun('seed'), result('a'), 'bot');
    expect(run.round).toBe(2);
    expect(run.wins).toBe(1);
    // 3 banked, then base 4, no interest, +1 for the win.
    expect(run.gold).toBe(3 + 4 + 1);
    expect(run.level).toBe(2);
  });

  it('takes damage on a loss and ends the run at 0 HP', () => {
    const lost = finishRound(newRun('seed'), result('b', 3), 'bot');
    expect(lost.hp).toBe(100 - (2 + 0 + 3));
    const dying = finishRound({ ...newRun('seed'), hp: 1 }, result('b'), 'bot');
    expect(dying.done).toBe(true);
    expect(dying.hp).toBe(0);
  });
});

describe('items', () => {
  const withBag = (bag: string[], extra: Partial<RunState> = {}) => ({ ...runWith([]), bag, ...extra });

  it('drops an item after certain rounds, and always the same one', () => {
    const afterRound = (round: number) =>
      finishRound({ ...newRun('drops'), round }, result('a'), 'bot').bag;
    expect(afterRound(1)).toEqual([]);
    expect(afterRound(2)).toHaveLength(1);
    expect(afterRound(2)).toEqual(afterRound(2));
    expect(afterRound(5)).toHaveLength(1);
    expect(afterRound(3)).toEqual([]);
  });

  it('gives an item to a creature and takes it back', () => {
    let run = buy(withBag(['razor_fang'], { shop: ['bytebat'] }), 0);
    run = equip(run, { area: 'bench', index: 0 }, 'razor_fang');
    expect(run.bench[0]?.item).toBe('razor_fang');
    expect(run.bag).toEqual([]);
    run = unequip(run, { area: 'bench', index: 0 });
    expect(run.bench[0]?.item).toBeUndefined();
    expect(run.bag).toEqual(['razor_fang']);
  });

  it('swaps an item, putting the old one back in the bag', () => {
    let run = buy(withBag(['razor_fang', 'volt_coil'], { shop: ['bytebat'] }), 0);
    run = equip(run, { area: 'bench', index: 0 }, 'razor_fang');
    run = equip(run, { area: 'bench', index: 0 }, 'volt_coil');
    expect(run.bench[0]?.item).toBe('volt_coil');
    expect(run.bag).toEqual(['razor_fang']);
  });

  it("won't give away an item it doesn't have", () => {
    const run = buy(withBag([], { shop: ['bytebat'] }), 0);
    expect(equip(run, { area: 'bench', index: 0 }, 'razor_fang')).toBe(run);
  });

  it('returns a sold creature’s item to the bag', () => {
    let run = buy(withBag(['mana_cell'], { shop: ['bytebat'] }), 0);
    run = equip(run, { area: 'bench', index: 0 }, 'mana_cell');
    run = sell(run, { area: 'bench', index: 0 });
    expect(run.bag).toEqual(['mana_cell']);
  });

  it('keeps one item when creatures combine and frees the others', () => {
    let run = withBag(['mana_cell', 'volt_coil'], { shop: ['sparkmouse', 'sparkmouse', 'sparkmouse'] });
    run = buy(buy(run, 0), 1);
    run = equip(run, { area: 'bench', index: 0 }, 'mana_cell');
    run = equip(run, { area: 'bench', index: 1 }, 'volt_coil');
    run = buy(run, 2);
    const merged = ownedUnits(run);
    expect(merged).toHaveLength(1);
    expect(merged[0].star).toBe(2);
    expect(merged[0].item).toBe('mana_cell');
    expect(run.bag).toEqual(['volt_coil']);
  });
});
