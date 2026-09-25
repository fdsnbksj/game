import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BALANCE_VERSION, ITEMS, LEVEL_XP, MAX_LEVEL, START_HP, UNITS, XP_COST, XP_PER_BUY, XP_PER_ROUND } from '../../src/sim/balance';
import { maxGold, maxItems, stageDamage, xpGoldForLevel } from '../../src/sim/economy';
import { SIDE_CELLS } from '../../src/sim/hex';
import { LADDER_VERSION } from '../../src/sim/puzzle';

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

/**
 * A one-argument rules function of the round, run as JavaScript. Rules expressions that
 * these use (ternaries, list indexing, arithmetic, math.floor) mean the same in both.
 */
function formula(name: string): (round: number) => number {
  const match = rules.match(new RegExp(`function ${name}\\(round\\) \\{\\s*return ([\\s\\S]*?);\\s*\\}`));
  if (!match) throw new Error(`firestore.rules has no function ${name}(round)`);
  return new Function('round', `return ${match[1].replace(/math\.floor/g, 'Math.floor')};`) as (round: number) => number;
}

/** Runs have no last round; check far past any run anyone will play. */
const HORIZON = 200;
const ROUNDS = Array.from({ length: HORIZON }, (_, i) => i + 1);

describe('firestore.rules matches src/sim', () => {
  it('has the same scalar settings', () => {
    expect(returned('balanceVersion')).toBe(BALANCE_VERSION);
    expect(returned('puzzleVersion')).toBe(LADDER_VERSION);
    expect(returned('startHp')).toBe(START_HP);
    expect(returned('maxLevel')).toBe(MAX_LEVEL);
  });

  it('has the same unit costs', () => {
    expect(returned('unitCosts')).toEqual(Object.fromEntries(UNITS.map((unit) => [unit.id, unit.cost])));
  });

  it('has the same XP table, gold budget and base damage', () => {
    expect(returned('levelXp')).toEqual(LEVEL_XP);
    expect(ROUNDS.map(formula('maxGold'))).toEqual(ROUNDS.map(maxGold));
    expect(ROUNDS.map(formula('stageDamage'))).toEqual(ROUNDS.map(stageDamage));
  });

  it('has the same items and item limits', () => {
    expect(returned('itemIds')).toEqual(ITEMS.map((item) => item.id));
    expect(ROUNDS.map(formula('maxItems'))).toEqual(ROUNDS.map(maxItems));
    expect(returned('itemSlots')).toEqual([...Array(MAX_LEVEL).keys()]);
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
      for (const round of ROUNDS) expect(rulesXpGold(level, round)).toBe(xpGoldForLevel(level, round));
    }
  });

  it('allows a board of up to the maximum level', () => {
    // boardCost() adds one term per possible unit, so it must have MAX_LEVEL of them.
    const body = rules.match(/function boardCost\(board, costs\) \{([\s\S]*?)\}/)![1];
    expect(body.match(/slotCost\(/g)).toHaveLength(MAX_LEVEL);
  });
});
