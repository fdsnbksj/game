import { describe, expect, it } from 'vitest';
import { BATTLE_CELLS, distance, firstStep, neighbors, SIDE_CELLS, toBattleCell } from '../../src/sim/hex';

const cells = [...Array(BATTLE_CELLS).keys()];

describe('hex grid', () => {
  it('gives every neighbour a distance of one', () => {
    for (const cell of cells) for (const n of neighbors(cell)) expect(distance(cell, n)).toBe(1);
  });

  it('gives interior cells six neighbours', () => {
    expect(neighbors(3 * 7 + 3)).toHaveLength(6);
  });

  it('measures distance symmetrically', () => {
    for (const a of cells) for (const b of cells) expect(distance(a, b)).toBe(distance(b, a));
  });

  it('puts side a on the bottom rows and side b on the top rows', () => {
    for (let own = 0; own < SIDE_CELLS; own++) {
      expect(toBattleCell(own, 'a')).toBeGreaterThanOrEqual(28);
      expect(toBattleCell(own, 'b')).toBeLessThan(28);
    }
    // Front rows face each other.
    expect(Math.floor(toBattleCell(0, 'a') / 7)).toBe(4);
    expect(Math.floor(toBattleCell(0, 'b') / 7)).toBe(3);
  });

  it('mirrors side b exactly, preserving every distance', () => {
    for (let x = 0; x < SIDE_CELLS; x++) {
      for (let y = 0; y < SIDE_CELLS; y++) {
        expect(distance(toBattleCell(x, 'b'), toBattleCell(y, 'b'))).toBe(distance(toBattleCell(x, 'a'), toBattleCell(y, 'a')));
      }
    }
  });

  it('steps along a shortest path around blockers', () => {
    const blocked = new Set([30, 31, 32]);
    const step = firstStep(45, (cell) => cell === 17, (cell) => blocked.has(cell));
    expect(step).not.toBeNull();
    expect(distance(step!, 45)).toBe(1);
    expect(blocked.has(step!)).toBe(false);
  });

  it('finds no step when already at the goal or walled in', () => {
    expect(firstStep(10, (cell) => cell === 10, () => false)).toBeNull();
    expect(firstStep(10, (cell) => cell === 50, (cell) => cell !== 10)).toBeNull();
  });
});
