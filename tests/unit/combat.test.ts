import { describe, expect, it } from 'vitest';
import { MAX_TICKS, OVERTIME_TICK } from '../../src/sim/balance';
import { simulate, type Placed } from '../../src/sim/combat';
import { hashSeed } from '../../src/shared/random';

const strong: Placed[] = [
  { unitId: 'thunderstag', star: 2, cell: 3 },
  { unitId: 'ironhog', star: 2, cell: 2 },
  { unitId: 'staticfox', star: 2, cell: 4 },
  { unitId: 'nullserpent', star: 1, cell: 24 },
  { unitId: 'mirrorowl', star: 2, cell: 23 },
];
const weak: Placed[] = [
  { unitId: 'sparkmouse', star: 1, cell: 3 },
  { unitId: 'voltmoth', star: 1, cell: 24 },
];
const even: Placed[] = [
  { unitId: 'chromeshell', star: 1, cell: 3 },
  { unitId: 'sparkmouse', star: 1, cell: 2 },
  { unitId: 'glitchtoad', star: 1, cell: 23 },
];

describe('combat', () => {
  it('replays identically from the same boards and seed', () => {
    expect(JSON.stringify(simulate(strong, even, 's1'))).toBe(JSON.stringify(simulate(strong, even, 's1')));
  });

  it('matches the recorded fight', () => {
    // If this changes, fights have changed: bump BALANCE_VERSION, then update the hash.
    const log = JSON.stringify(simulate(strong, even, 'golden'));
    expect(hashSeed(log)).toBe(GOLDEN_HASH);
  });

  it('lets the stronger board win from either side', () => {
    expect(simulate(strong, weak, 'x').winner).toBe('a');
    expect(simulate(weak, strong, 'x').winner).toBe('b');
  });

  it('gives the win to the only side with units', () => {
    expect(simulate(weak, [], 'x').winner).toBe('a');
    expect(simulate([], weak, 'x').winner).toBe('b');
    expect(simulate([], [], 'x').winner).toBe('draw');
  });

  it('ends within the time limit and keeps health in range', () => {
    for (let n = 0; n < 20; n++) {
      const result = simulate(even, even, `mirror${n}`);
      expect(result.ticks).toBeLessThanOrEqual(MAX_TICKS);
      for (const event of result.events) {
        if (event.k === 'hit' || event.k === 'heal') {
          const max = result.fighters[event.id].maxHp;
          expect(event.hp).toBeGreaterThanOrEqual(0);
          expect(event.hp).toBeLessThanOrEqual(max);
        }
      }
    }
  });

  it('breaks a stalemate between tanks with overtime', () => {
    // Without overtime, shields outpace damage here and the fight runs to the time limit.
    const result = simulate([{ unitId: 'chromeshell', star: 2, cell: 3 }], [{ unitId: 'chromeshell', star: 1, cell: 3 }], 'stalemate');
    expect(result.ticks).toBeGreaterThan(OVERTIME_TICK);
    expect(result.ticks).toBeLessThan(MAX_TICKS);
    expect(result.winner).toBe('a');
  });

  it('never puts two living units on one cell', () => {
    const result = simulate(strong, even, 'crowd');
    const cells = new Map(result.fighters.map((f) => [f.id, f.cell]));
    const dead = new Set<number>();
    for (const event of result.events) {
      if (event.k === 'death') dead.add(event.id);
      if (event.k === 'move') {
        cells.set(event.id, event.cell);
        const living = [...cells].filter(([id]) => !dead.has(id)).map(([, cell]) => cell);
        expect(new Set(living).size).toBe(living.length);
      }
    }
  });

  it('counts the winners surviving stars', () => {
    const result = simulate(strong, weak, 'x');
    const deadIds = new Set(result.events.filter((e) => e.k === 'death').map((e) => e.id));
    const stars = result.fighters.filter((f) => f.side === 'a' && !deadIds.has(f.id)).reduce((sum, f) => sum + f.star, 0);
    expect(result.survivorStars).toBe(stars);
  });
});

const GOLDEN_HASH = 276271311;
