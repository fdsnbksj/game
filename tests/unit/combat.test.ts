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

  it('poisons with Toxin attacks, damaging over time', () => {
    const toxic: Placed[] = [
      { unitId: 'acidfrog', star: 2, cell: 3 },
      { unitId: 'sludgebear', star: 2, cell: 2 },
    ];
    const clean: Placed[] = [
      { unitId: 'bytebat', star: 2, cell: 3 },
      { unitId: 'ironhog', star: 2, cell: 2 },
    ];
    const poisoned = simulate(toxic, clean, 'toxin').events.filter((event) => event.k === 'dot');
    expect(poisoned.length).toBeGreaterThan(0);
    // Only the side without Toxin takes it.
    const sideOf = (id: number) => simulate(toxic, clean, 'toxin').fighters[id].side;
    expect(poisoned.every((event) => sideOf(event.id) === 'b')).toBe(true);
  });

  it('makes abilities do more with Prism', () => {
    const enemy: Placed[] = [{ unitId: 'ironhog', star: 3, cell: 3 }];
    const firstShield = (allies: Placed[]) => {
      const event = simulate(allies, enemy, 'power').events.find((e) => e.k === 'shield');
      return event && event.k === 'shield' ? event.amount : 0;
    };
    // Two Prism units switch the trait on; pairing with a non-Prism unit doesn't.
    const withPrism = firstShield([{ unitId: 'prismfly', star: 1, cell: 0 }, { unitId: 'lumihare', star: 1, cell: 1 }, { unitId: 'chromeshell', star: 1, cell: 3 }]);
    const without = firstShield([{ unitId: 'prismfly', star: 1, cell: 0 }, { unitId: 'voltmoth', star: 1, cell: 1 }, { unitId: 'chromeshell', star: 1, cell: 3 }]);
    expect(withPrism).toBeGreaterThan(0);
    expect(withPrism).toBeGreaterThan(without);
  });

  it('casts more often with Support mana', () => {
    const enemy: Placed[] = [{ unitId: 'thunderstag', star: 3, cell: 3 }];
    const casts = (allies: Placed[]) => simulate(allies, enemy, 'mana').events.filter((e) => e.k === 'cast').length;
    const supported = casts([{ unitId: 'sporecat', star: 2, cell: 0 }, { unitId: 'prismfly', star: 2, cell: 1 }, { unitId: 'chromeshell', star: 2, cell: 3 }]);
    const alone = casts([{ unitId: 'sporecat', star: 2, cell: 0 }, { unitId: 'voltmoth', star: 2, cell: 1 }, { unitId: 'chromeshell', star: 2, cell: 3 }]);
    expect(supported).toBeGreaterThan(alone);
  });

  it('heals every nearby ally at once', () => {
    // Sunwash reaches two hexes, so the allies stand next to the healer.
    const hurt: Placed[] = [
      { unitId: 'beamray', star: 2, cell: 9 },
      { unitId: 'chromeshell', star: 1, cell: 2 },
      { unitId: 'ironhog', star: 1, cell: 3 },
    ];
    const healsOf = (allies: Placed[]) =>
      simulate(allies, [{ unitId: 'thunderstag', star: 3, cell: 3 }], 'care').events.filter((event) => event.k === 'heal');
    const heals = healsOf(hurt);
    expect(heals.length).toBeGreaterThan(0);
    // Sunwash reaches more than one ally.
    expect(new Set(heals.map((event) => event.id)).size).toBeGreaterThan(1);
  });

  it('speeds allies up with a haste ability', () => {
    const hasted = simulate(
      [{ unitId: 'lumihare', star: 2, cell: 0 }, { unitId: 'chromemantis', star: 2, cell: 3 }],
      [{ unitId: 'ironhog', star: 2, cell: 3 }],
      'haste',
    );
    expect(hasted.events.some((event) => event.k === 'haste')).toBe(true);
  });

  it('heals an item holder for part of the damage it deals', () => {
    const enemy: Placed[] = [{ unitId: 'ironhog', star: 3, cell: 3 }];
    const healsOf = (item?: string) =>
      simulate([{ unitId: 'chromemantis', star: 2, cell: 3, ...(item ? { item } : {}) }], enemy, 'siphon').events.filter(
        (event) => event.k === 'heal',
      ).length;
    expect(healsOf('siphon_core')).toBeGreaterThan(0);
    expect(healsOf()).toBe(0);
  });

  it('makes a creature tougher with an item', () => {
    const enemy: Placed[] = [{ unitId: 'bytebat', star: 2, cell: 3 }];
    const lasts = (item?: string) =>
      simulate([{ unitId: 'chromeshell', star: 1, cell: 3, ...(item ? { item } : {}) }], enemy, 'plate').ticks;
    expect(lasts('heavy_plate')).toBeGreaterThan(lasts());
  });

  it('counts the winners surviving stars', () => {
    const result = simulate(strong, weak, 'x');
    const deadIds = new Set(result.events.filter((e) => e.k === 'death').map((e) => e.id));
    const stars = result.fighters.filter((f) => f.side === 'a' && !deadIds.has(f.id)).reduce((sum, f) => sum + f.star, 0);
    expect(result.survivorStars).toBe(stars);
  });
});

const GOLDEN_HASH = 276271311;
