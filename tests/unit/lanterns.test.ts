import { describe, expect, it } from 'vitest';
import { hashSeed } from '../../src/shared/random';
import {
  LANTERNS_VERSION,
  fewestWay,
  flip,
  hint,
  isSolved,
  makeLevel,
  newGame,
  play,
  reach,
  replay,
  sizeFor,
  tapsLeft,
  undo,
  type LanternsGame,
} from '../../src/games/lanterns/lanterns';

/** Plays hints until solved; returns the game. */
function solveByHints(game: LanternsGame) {
  let g = game;
  for (let i = 0; i < 100 && !isSolved(g); i++) g = play(g, hint(g)!);
  return g;
}

/** The fewest taps by trying every set of cells (small squares only). */
function bruteFewest(size: number, lit: boolean[]) {
  const n = size * size;
  let best = Infinity;
  for (let mask = 0; mask < 1 << n; mask++) {
    let l = lit;
    let count = 0;
    for (let c = 0; c < n; c++) if ((mask >> c) & 1) (l = flip(size, l, c)), count++;
    if (l.every((on) => !on)) best = Math.min(best, count);
  }
  return best;
}

describe('a tap', () => {
  it('flips the lantern and the ones beside it, inside the square', () => {
    expect(reach(3, 4).sort()).toEqual([1, 3, 4, 5, 7]);
    expect(reach(3, 0).sort()).toEqual([0, 1, 3]);
    expect(reach(3, 8).sort()).toEqual([5, 7, 8]);
    expect(reach(4, 7).sort((a, b) => a - b)).toEqual([3, 6, 7, 11]);
    const dark = new Array<boolean>(9).fill(false);
    expect(flip(3, dark, 4)).toEqual([false, true, false, true, true, true, false, true, false]);
    expect(flip(3, flip(3, dark, 4), 4)).toEqual(dark);
  });
});

describe('the fewest way', () => {
  it('is nothing when all are out', () => {
    expect(fewestWay(5, new Array<boolean>(25).fill(false))).toEqual([]);
  });

  it('puts every lantern out, in as few taps as trying every way', () => {
    for (const size of [3, 4]) {
      for (let n = 0; n < 30; n++) {
        let lit = new Array<boolean>(size * size).fill(false);
        let seed = hashSeed(`fewest:${size}:${n}`);
        for (let i = 0; i < 5; i++) {
          seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
          lit = flip(size, lit, (seed >>> 8) % (size * size));
        }
        const way = fewestWay(size, lit)!;
        let l = lit;
        for (const c of way) l = flip(size, l, c);
        expect(l.every((on) => !on)).toBe(true);
        expect(way.length).toBe(bruteFewest(size, lit));
      }
    }
  });

  it('says when it cannot be done (some 4×4 and 5×5 squares have no way out)', () => {
    const lit = new Array<boolean>(25).fill(false);
    lit[0] = true;
    expect(fewestWay(5, lit)).toBeNull();
    const four = new Array<boolean>(16).fill(false);
    four[0] = true;
    expect(fewestWay(4, four)).toBeNull();
  });
});

describe('a game', () => {
  it('flips the tapped lanterns and remembers the tap', () => {
    const g0 = newGame(1);
    const g = play(g0, 4);
    expect(g.lit).toEqual(flip(3, g0.lit, 4));
    expect(g.moves).toEqual([4]);
  });

  it('refuses a cell that is not there, and any tap once solved', () => {
    const g = newGame(1);
    expect(play(g, -1)).toBe(g);
    expect(play(g, 9)).toBe(g);
    expect(play(g, 1.5)).toBe(g);
    const done = solveByHints(g);
    expect(isSolved(done)).toBe(true);
    expect(play(done, 0)).toBe(done);
    expect(hint(done)).toBeNull();
  });

  it('undo takes back exactly one tap', () => {
    const g = play(play(newGame(4), 3), 7);
    expect(undo(g)).toEqual(play(newGame(4), 3));
    expect(undo(undo(g))).toEqual(newGame(4));
    expect(undo(newGame(4))).toEqual(newGame(4));
  });

  it('comes back from its save', () => {
    let g = newGame(11);
    for (const cell of [0, 4, 4, 9, 20, 24, 2, 13]) g = play(g, cell);
    expect(replay(11, g.moves)).toEqual(g);
    expect(replay(11, [...g.moves, -3, 999]).moves).toEqual(g.moves);
  });
});

describe('levels', () => {
  it('grow from 3×3 to 7×7', () => {
    expect(sizeFor(1)).toBe(3);
    expect(sizeFor(3)).toBe(4);
    expect(sizeFor(8)).toBe(5);
    expect(sizeFor(15)).toBe(6);
    expect(sizeFor(25)).toBe(7);
    expect(sizeFor(500)).toBe(7);
  });

  it('start lit, can always be put out, and get longer', () => {
    let last = 0;
    for (let level = 1; level <= 60; level++) {
      const b = makeLevel(level);
      expect(b.size).toBe(sizeFor(level));
      expect(b.start).toHaveLength(b.size * b.size);
      expect(b.start.some(Boolean)).toBe(true);
      expect(fewestWay(b.size, b.start)!.length).toBe(b.par);
      expect(b.par).toBeGreaterThanOrEqual(3);
      if (level === 30) last = b.par;
    }
    expect(last).toBeGreaterThan(makeLevel(1).par);
  });

  it('are the same every time', () => {
    expect(makeLevel(17)).toEqual(makeLevel(17));
  });

  it('are solved by following the hints, in exactly the fewest taps', () => {
    for (let level = 1; level <= 40; level++) {
      const g = solveByHints(newGame(level));
      expect(isSolved(g)).toBe(true);
      expect(g.moves.length).toBe(g.board.par);
    }
  });

  it('hints still finish a level after random taps', () => {
    for (let n = 0; n < 200; n++) {
      const level = 1 + (n % 30);
      let g = newGame(level);
      let seed = hashSeed(`random:${n}`);
      for (let i = 0; i < 30 && !isSolved(g); i++) {
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        g = play(g, (seed >>> 8) % g.lit.length);
      }
      expect(replay(level, g.moves)).toEqual(g);
      const left = tapsLeft(g);
      const done = solveByHints(g);
      expect(isSolved(done)).toBe(true);
      expect(done.moves.length - g.moves.length).toBe(left);
      expect(replay(level, done.moves)).toEqual(done);
    }
  });

  it('match the golden levels (bump LANTERNS_VERSION and this hash when levels or taps would come out differently)', () => {
    expect(LANTERNS_VERSION).toBe(1);
    const text = Array.from({ length: 30 }, (_, i) => {
      const b = makeLevel(i + 1);
      return `${b.size}:${b.par}:${b.start.map(Number).join('')}`;
    }).join('|');
    expect(hashSeed(text)).toBe(1080239231);
  });
});
