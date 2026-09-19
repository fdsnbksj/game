import { describe, expect, it } from 'vitest';
import { getUnit, MAX_ROUNDS } from '../../src/sim/balance';
import { aiOpponent } from '../../src/sim/ai';
import { simulate } from '../../src/sim/combat';
import { maxGoldByRound, sellValue, xpGoldForLevel } from '../../src/sim/economy';
import { autoFill, boardCount, boardUnits, finishRound, newRun, type RunState } from '../../src/sim/planning';

describe('AI opponents', () => {
  it('builds the same board for the same seed and round', () => {
    expect(aiOpponent('seed', 7)).toEqual(aiOpponent('seed', 7));
  });

  it('only builds boards a player could afford', () => {
    const max = maxGoldByRound();
    for (let n = 0; n < 10; n++) {
      for (let round = 1; round <= MAX_ROUNDS; round++) {
        const { units } = aiOpponent(`seed${n}`, round);
        const value = units.reduce((sum, u) => sum + sellValue(getUnit(u.unitId).cost, u.star), 0);
        expect(value + xpGoldForLevel(units.length, round)).toBeLessThanOrEqual(max[round]);
        expect(new Set(units.map((u) => u.cell)).size).toBe(units.length);
      }
    }
  });

  it('fields a growing team as rounds pass', () => {
    expect(aiOpponent('seed', 1).units.length).toBeGreaterThan(0);
    expect(aiOpponent('seed', 12).units.length).toBeGreaterThan(aiOpponent('seed', 2).units.length);
  });
});

describe('a whole run', () => {
  it('plays to the end with gold and board size always legal', () => {
    let run: RunState = newRun('full');
    let rounds = 0;
    while (!run.done) {
      // The player copies what an AI of the same seed would field this round.
      const planned = autoFill(run);
      expect(planned.gold).toBeGreaterThanOrEqual(0);
      expect(boardCount(planned)).toBeLessThanOrEqual(planned.level);
      const opponent = aiOpponent(`full:opp`, run.round);
      const result = simulate(boardUnits(planned), opponent.units, `full:${run.round}`);
      run = finishRound(planned, result, opponent.name);
      rounds += 1;
    }
    expect(rounds).toBeLessThanOrEqual(MAX_ROUNDS);
    expect(run.history).toHaveLength(rounds);
  });
});
