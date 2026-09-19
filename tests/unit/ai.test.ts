import { describe, expect, it } from 'vitest';
import { getUnit, MAX_ROUNDS } from '../../src/sim/balance';
import { aiOpponent } from '../../src/sim/ai';
import { simulate } from '../../src/sim/combat';
import { maxGoldByRound, sellValue, xpGoldForLevel } from '../../src/sim/economy';
import { autoFill, boardCount, boardUnits, finishRound, newRun, type RunState } from '../../src/sim/planning';
import { fromSnapshot, isLegalBoard, toSnapshot } from '../../src/sim/validate';

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
      // Whatever a real run fields must pass the same check the rules make.
      expect(isLegalBoard(toSnapshot(boardUnits(planned), planned.level, 'ai'), planned.round)).toBe(true);
      const opponent = aiOpponent(`full:opp`, run.round);
      const result = simulate(boardUnits(planned), opponent.units, `full:${run.round}`);
      run = finishRound(planned, result, opponent.name);
      rounds += 1;
    }
    expect(rounds).toBeLessThanOrEqual(MAX_ROUNDS);
    expect(run.history).toHaveLength(rounds);
  });
});

describe('board legality', () => {
  it('accepts every board a bot fields', () => {
    for (let n = 0; n < 10; n++) {
      for (let round = 1; round <= MAX_ROUNDS; round++) {
        const { units } = aiOpponent(`legal${n}`, round);
        expect(isLegalBoard(toSnapshot(units, Math.max(1, units.length), 'ai'), round)).toBe(true);
      }
    }
  });

  it('round-trips a board through its stored form', () => {
    const { units } = aiOpponent('trip', 9);
    expect(fromSnapshot(toSnapshot(units, units.length, 'ai'))).toEqual(units);
  });

  it('rejects boards no player could have had', () => {
    const ok = toSnapshot([{ unitId: 'sparkmouse', star: 1, cell: 3 }], 1, 'ai');
    expect(isLegalBoard(ok, 1)).toBe(true);
    // Round 1 pays 3 gold: a 2-star (3 copies) of a 2-cost unit is 6.
    expect(isLegalBoard({ ...ok, u: ['bytebat'], s: [2] }, 1)).toBe(false);
    expect(isLegalBoard({ ...ok, u: ['sparkmouse', 'voltmoth'], c: [3, 4], s: [1, 1] }, 1)).toBe(false);
    expect(isLegalBoard({ ...ok, lv: 2, u: ['sparkmouse', 'voltmoth'], c: [3, 3], s: [1, 1] }, 5)).toBe(false);
    expect(isLegalBoard({ ...ok, c: [28] }, 5)).toBe(false);
    expect(isLegalBoard({ ...ok, s: [4] }, 5)).toBe(false);
    expect(isLegalBoard({ ...ok, u: ['pikachu'] }, 5)).toBe(false);
  });
});
