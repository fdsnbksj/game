import { describe, expect, it } from 'vitest';
import { hashSeed } from '../../src/shared/random';
import {
  EXIT_ROW,
  GRIDLOCK_VERSION,
  OUT,
  SIZE,
  fewestLeft,
  hint,
  isSolved,
  makeLevel,
  newGame,
  occupancy,
  packMove,
  play,
  reach,
  replay,
  settingsFor,
  slides,
  solve,
  undo,
  unpackMove,
  type Car,
  type GridlockGame,
  type Lot,
} from '../../src/games/gridlock/gridlock';

/** A hand-built car park: the red car first. */
function game(cars: Car[], starts: number[], par = 9): GridlockGame {
  const lot: Lot = { cars, starts, par };
  return { level: 0, lot, at: starts.slice(), moves: [] };
}

const red: Car = { len: 2, across: true, line: EXIT_ROW };

function byHints(g: GridlockGame) {
  for (let i = 0; i < 60 && !isSolved(g); i++) g = play(g, hint(g)!);
  return g;
}

describe('a slide', () => {
  // The red car at column 0; a truck standing down column 3 across its way; a car across row 0.
  const cars: Car[] = [red, { len: 3, across: false, line: 3 }, { len: 2, across: true, line: 0 }];
  const g = game(cars, [0, 1, 0]);

  it('reaches as far as the next car or the wall', () => {
    expect(reach(cars, g.at, 0)).toEqual([0, 1]);
    expect(reach(cars, g.at, 1)).toEqual([0, 3]);
    expect(reach(cars, [0, 1, 2], 1)).toEqual([1, 3]); // the car across row 0 now stands over column 3
    expect(reach(cars, g.at, 2)).toEqual([0, 4]);
  });

  it('moves a car along its own line only, any distance in one move', () => {
    const next = play(g, { car: 2, to: 4 });
    expect(next.at).toEqual([0, 1, 4]);
    expect(next.moves).toHaveLength(1);
    expect(occupancy(cars, next.at)[4]).toBe(2);
  });

  it('refuses a slide through another car, off the lot, or that goes nowhere', () => {
    expect(play(g, { car: 0, to: 3 })).toBe(g);
    expect(play(g, { car: 1, to: 4 })).toBe(g);
    expect(play(g, { car: 0, to: 0 })).toBe(g);
    expect(play(g, { car: 5, to: 1 })).toBe(g);
    expect(play(g, { car: 0, to: 1.5 })).toBe(g);
  });

  it('is solved when the red car reaches the gap, and nothing moves after', () => {
    let next = play(g, { car: 1, to: 3 });
    expect(isSolved(next)).toBe(false);
    next = play(next, { car: 0, to: OUT });
    expect(isSolved(next)).toBe(true);
    expect(play(next, { car: 2, to: 4 })).toBe(next);
    expect(undo(next)).toBe(next);
  });

  it('lists every slide', () => {
    expect(slides(cars, g.at)).toEqual([
      { car: 0, to: 1 },
      { car: 1, to: 0 },
      { car: 1, to: 2 },
      { car: 1, to: 3 },
      ...[1, 2, 3, 4].map((to) => ({ car: 2, to })),
    ]);
  });
});

describe('the solver', () => {
  it('finds the fewest slides out', () => {
    // A truck down column 3 across the red car's way; it can't go down past the car across row 5.
    const cars: Car[] = [red, { len: 3, across: false, line: 3 }, { len: 2, across: true, line: 5 }];
    const way = solve(cars, [0, 2, 3])!;
    expect(way).toHaveLength(3);
    expect(way[1]).toEqual({ car: 1, to: 3 });
    expect(way[2]).toEqual({ car: 0, to: OUT });
    // With the car across row 5 out of the way already, it's two.
    expect(solve(cars, [0, 2, 0])).toHaveLength(2);
    expect(solve(cars, [OUT, 0, 3])).toEqual([]);
  });

  it('knows when there is no way out', () => {
    // Two trucks down columns 4 and 5 fill rows 0–5 between them: the red car can never pass.
    const cars: Car[] = [red, { len: 3, across: false, line: 4 }, { len: 3, across: false, line: 4 }];
    expect(solve(cars, [0, 0, 3])).toBeNull();
  });
});

describe('levels', () => {
  it('get harder as they go', () => {
    expect(settingsFor(1).par).toBe(3);
    expect(settingsFor(40).par).toBeGreaterThan(settingsFor(10).par);
    expect(settingsFor(40).cars).toBeGreaterThan(settingsFor(1).cars);
  });

  it('are fair: cars fit, none overlap, nothing blocks the red row for good, and par is the fewest way out', () => {
    let total = 0;
    for (let level = 1; level <= 30; level++) {
      const lot = makeLevel(level);
      expect(lot.cars[0]).toEqual(red);
      lot.cars.forEach((car, i) => {
        expect(lot.starts[i]).toBeGreaterThanOrEqual(0);
        expect(lot.starts[i] + car.len).toBeLessThanOrEqual(SIZE);
        if (i > 0) expect(car.across && car.line === EXIT_ROW).toBe(false);
      });
      const cells = lot.cars.reduce((n, c) => n + c.len, 0);
      expect(occupancy(lot.cars, lot.starts).filter((c) => c >= 0)).toHaveLength(cells);
      expect(lot.par).toBeGreaterThan(0);
      expect(lot.par).toBeLessThanOrEqual(settingsFor(level).par);
      expect(solve(lot.cars, lot.starts)!.length).toBe(lot.par);
      total += lot.par;
    }
    expect(total / 30).toBeGreaterThan(7);
    expect(makeLevel(1).par).toBe(3);
  });

  it('come out the same every time', () => {
    expect(makeLevel(7)).toEqual(makeLevel(7));
  });
});

describe('a game', () => {
  it('is solved by following hints in exactly par moves', () => {
    for (let level = 1; level <= 20; level++) {
      const g = newGame(level);
      expect(fewestLeft(g)).toBe(g.lot.par);
      const done = byHints(g);
      expect(isSolved(done)).toBe(true);
      expect(done.moves).toHaveLength(g.lot.par);
      expect(hint(done)).toBeNull();
    }
  });

  it('undoes one slide at a time, back to the start', () => {
    let g = newGame(4);
    const start = g;
    g = play(g, hint(g)!);
    g = play(g, hint(g)!);
    expect(undo(undo(g))).toEqual(start);
    expect(undo(start)).toBe(start);
  });

  it('can always be finished after random play, and replays the same', () => {
    const lots = new Map<number, Lot>();
    for (let n = 0; n < 200; n++) {
      const level = 1 + (n % 12);
      if (!lots.has(level)) lots.set(level, makeLevel(level));
      const lot = lots.get(level)!;
      let g = replay(level, [], lot);
      let seed = hashSeed(`random:${n}`);
      for (let i = 0; i < 30 && !isSolved(g); i++) {
        const options = slides(g.lot.cars, g.at);
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        g = play(g, options[(seed >>> 8) % options.length]);
      }
      expect(replay(level, g.moves, lot)).toEqual(g);
      const done = byHints(g);
      expect(isSolved(done)).toBe(true);
      // A save holds each slide as one number.
      expect(replay(level, done.moves.map(packMove).map(unpackMove), lot)).toEqual(done);
    }
  });

  it('drops moves that do not apply when replayed', () => {
    const g = replay(1, [{ car: 0, to: 99 }, { car: 42, to: 1 }]);
    expect(g.moves).toEqual([]);
  });

  it('matches the golden levels (bump GRIDLOCK_VERSION and this hash when levels or hints would come out differently)', () => {
    expect(GRIDLOCK_VERSION).toBe(1);
    const text = Array.from({ length: 16 }, (_, i) => {
      const g = newGame(i + 1);
      const h = hint(g)!;
      return `${g.lot.cars.map((c) => `${c.len}${c.across ? 'a' : 'd'}${c.line}`).join('')}:${g.lot.starts.join('')}:${g.lot.par}:${h.car}-${h.to}`;
    }).join('|');
    expect(hashSeed(text)).toBe(2984094842);
  });
});
