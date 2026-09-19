import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BALANCE_VERSION, LEVEL_XP, MAX_LEVEL, MAX_ROUNDS, START_HP, UNITS, XP_COST, XP_PER_BUY, XP_PER_ROUND } from '../../src/sim/balance';
import { maxGoldByRound, stageDamage, xpGoldForLevel } from '../../src/sim/economy';
import { SIDE_CELLS } from '../../src/sim/hex';

// firestore.rules repeats some game numbers, because rules can't import code. If a balance
// change updates src/sim but not the rules, honest players' rounds get rejected; this
// catches it before deploy.

const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');

/** The literal a rules function returns, parsed as JSON. */
function returned(name: string): unknown {
  const match = rules.match(new RegExp(`function ${name}\\(\\) \\{\\s*return ([\\s\\S]*?);\\s*\\}`));
  if (!match) throw new Error(`firestore.rules has no function ${name}()`);
  return JSON.parse(match[1].replace(/'/g, '"'));
}

describe('firestore.rules matches src/sim', () => {
  it('has the same scalar settings', () => {
    expect(returned('balanceVersion')).toBe(BALANCE_VERSION);
    expect(returned('maxRounds')).toBe(MAX_ROUNDS);
    expect(returned('startHp')).toBe(START_HP);
    expect(returned('maxLevel')).toBe(MAX_LEVEL);
  });

  it('has the same unit costs', () => {
    expect(returned('unitCosts')).toEqual(Object.fromEntries(UNITS.map((unit) => [unit.id, unit.cost])));
  });

  it('has the same XP table, gold budget and base damage', () => {
    expect(returned('levelXp')).toEqual(LEVEL_XP);
    expect(returned('maxGold')).toEqual(maxGoldByRound());
    expect(returned('stageDamage')).toEqual([0, ...Array.from({ length: MAX_ROUNDS }, (_, i) => stageDamage(i + 1))]);
  });

  it('covers every cell of a board', () => {
    expect(returned('ownCells')).toEqual([...Array(SIDE_CELLS).keys()]);
  });

  it("agrees with the rules' XP gold formula", () => {
    // xpGold() in the rules hardcodes 4 gold per 4 XP and 2 XP a round.
    expect([XP_COST, XP_PER_BUY, XP_PER_ROUND]).toEqual([4, 4, 2]);
    const rulesXpGold = (level: number, round: number) => {
      const needed = LEVEL_XP[level] - 2 * (round - 1);
      return needed > 0 ? needed + ((4 - (needed % 4)) % 4) : 0;
    };
    for (let level = 1; level <= MAX_LEVEL; level++) {
      for (let round = 1; round <= MAX_ROUNDS; round++) expect(rulesXpGold(level, round)).toBe(xpGoldForLevel(level, round));
    }
  });

  it('allows a board of up to the maximum level', () => {
    // boardCost() adds one term per possible unit, so it must have MAX_LEVEL of them.
    const body = rules.match(/function boardCost\(board, costs\) \{([\s\S]*?)\}/)![1];
    expect(body.match(/slotCost\(/g)).toHaveLength(MAX_LEVEL);
  });
});
