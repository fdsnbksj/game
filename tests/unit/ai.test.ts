import { describe, expect, it } from 'vitest';
import { getUnit } from '../../src/sim/balance';
import { aiOpponent } from '../../src/sim/ai';
import { simulate } from '../../src/sim/combat';
import { maxGold, sellValue, surgePercent, xpGoldForLevel } from '../../src/sim/economy';
import { autoFill, boardCount, boardUnits, finishRound, newRun, type RunState } from '../../src/sim/planning';
import { fromSnapshot, isLegalBoard, toSnapshot } from '../../src/sim/validate';

/** Well past round 15, where the old last round was. */
const HORIZON = 25;

describe('AI opponents', () => {
  it('builds the same board for the same seed and round', () => {
    expect(aiOpponent('seed', 7)).toEqual(aiOpponent('seed', 7));
  });

  it('only builds boards a player could afford', () => {
    for (let n = 0; n < 10; n++) {
      for (let round = 1; round <= HORIZON; round++) {
        const { units } = aiOpponent(`seed${n}`, round);
        const value = units.reduce((sum, u) => sum + sellValue(getUnit(u.unitId).cost, u.star), 0);
        expect(value + xpGoldForLevel(units.length, round)).toBeLessThanOrEqual(maxGold(round));
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
  it('plays until HP runs out, with gold and board size always legal', () => {
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
      const result = simulate(boardUnits(planned), opponent.units, `full:${run.round}`, surgePercent(run.round));
      run = finishRound(planned, result, opponent.name);
      rounds += 1;
      // The surge makes every run end; this only stops a broken one looping forever.
      if (rounds > 100) break;
    }
    expect(run.done).toBe(true);
    expect(run.hp).toBe(0);
    expect(run.history).toHaveLength(rounds);
  });
});

describe('board legality', () => {
  it('accepts every board a bot fields', () => {
    for (let n = 0; n < 10; n++) {
      for (let round = 1; round <= HORIZON; round++) {
        const { units } = aiOpponent(`legal${n}`, round);
        const board = toSnapshot(units, Math.max(1, units.length), 'ai');
        expect(isLegalBoard(board, round)).toBe(true);
        // Bots pick their items up as they go, like a player.
        if (round > 3) expect((board.it ?? []).length).toBeGreaterThan(0);
      }
    }
  });

  it('round-trips a board through its stored form', () => {
    const { units } = aiOpponent('trip', 9);
    expect(fromSnapshot(toSnapshot(units, units.length, 'ai'))).toEqual(units);
  });

  it('accepts items a run could have dropped, and rejects the rest', () => {
    const team = [
      { unitId: 'sparkmouse' as const, star: 1 as const, cell: 3, item: 'razor_fang' },
      { unitId: 'voltmoth' as const, star: 1 as const, cell: 4, item: 'volt_coil' },
    ];
    const board = toSnapshot(team, 4, 'ai');
    expect(board.it).toEqual(['razor_fang', 'volt_coil']);
    expect(board.ia).toEqual([0, 1]);
    // Two items have dropped by round 7, but only one by round 4.
    expect(isLegalBoard(board, 7)).toBe(true);
    expect(isLegalBoard(board, 4)).toBe(false);
    // One item per creature, and only real items.
    expect(isLegalBoard({ ...board, ia: [0, 0] }, 7)).toBe(false);
    expect(isLegalBoard({ ...board, it: ['excalibur', 'volt_coil'] }, 7)).toBe(false);
    expect(isLegalBoard({ ...board, ia: [0] }, 7)).toBe(false);
    expect(isLegalBoard({ ...board, ia: [0, 99] }, 7)).toBe(false);
  });

  it('carries items through a board round trip', () => {
    const team = [{ unitId: 'ironhog' as const, star: 2 as const, cell: 1, item: 'heavy_plate' }];
    expect(fromSnapshot(toSnapshot(team, 4, 'ai'))).toEqual(team);
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
