import { describe, expect, it } from 'vitest';
import { simulate, type Placed } from '../../src/sim/combat';
import { SIDE_CELLS } from '../../src/sim/hex';
import { puzzle, puzzleSeed, puzzleSize, targetShare, type Puzzle } from '../../src/sim/puzzle';

const LEVELS = Array.from({ length: 60 }, (_, i) => i + 1);
const made = new Map<number, Puzzle>(LEVELS.map((level) => [level, puzzle(level)]));

const key = (units: readonly { unitId: string; star: number }[]) => units.map((unit) => `${unit.unitId}:${unit.star}`).sort();
const legalCells = (units: readonly Placed[]) =>
  units.every((unit) => Number.isInteger(unit.cell) && unit.cell >= 0 && unit.cell < SIDE_CELLS) && new Set(units.map((unit) => unit.cell)).size === units.length;

describe('puzzles', () => {
  it('are the same every time', () => {
    for (const level of [1, 7, 25]) expect(puzzle(level)).toEqual(made.get(level));
  });

  it('grow from two units a side to a full board', () => {
    expect(made.get(1)!.enemy).toHaveLength(2);
    expect(made.get(60)!.enemy).toHaveLength(8);
    for (const p of made.values()) {
      expect(p.enemy).toHaveLength(puzzleSize(p.level));
      expect(p.hand).toHaveLength(puzzleSize(p.level));
    }
  });

  it('can always be won, by a placement of exactly the hand', () => {
    for (const p of made.values()) {
      expect(key(p.solution), `level ${p.level}`).toEqual(key(p.hand));
      expect(p.solution.flatMap((unit) => (unit.item ? [unit.item] : [])).sort()).toEqual([...p.items].sort());
      expect(legalCells(p.solution) && legalCells(p.enemy), `level ${p.level}`).toBe(true);
      expect(simulate(p.solution, p.enemy, puzzleSeed(p.level), p.rivalPercent).winner, `level ${p.level}`).toBe('a');
    }
  });

  it('get harder: fewer placements win deeper in', () => {
    const early = LEVELS.slice(0, 10).map((level) => made.get(level)!.share);
    const late = LEVELS.slice(-10).map((level) => made.get(level)!.share);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(late)).toBeLessThan(mean(early));
    expect(mean(late)).toBeLessThanOrEqual(targetShare(60) * 2);
  });

  it('take a bounded number of fights to make', () => {
    for (const p of made.values()) expect(p.fights, `level ${p.level}`).toBeLessThanOrEqual(1200);
  });
});
