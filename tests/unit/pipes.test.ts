import { describe, expect, it } from 'vitest';
import { hashSeed } from '../../src/shared/random';
import {
  DOWN,
  LEFT,
  PIPES_VERSION,
  RIGHT,
  UP,
  fewestTaps,
  hint,
  isSolved,
  leakSides,
  leaks,
  makeLevel,
  masks,
  neighbour,
  newGame,
  play,
  replay,
  rotate,
  sizeFor,
  undo,
  watered,
  type Board,
  type PipesGame,
} from '../../src/games/pipes/pipes';

/** A hand-laid 2×2 board: the spring top left, every tile dealt as `start`. */
function tiny(start: number[]): PipesGame {
  const board: Board = { size: 2, source: 0, answer: [RIGHT | DOWN, LEFT, UP | RIGHT, LEFT], start };
  return { level: 0, board, turns: [0, 0, 0, 0], moves: [] };
}

/** Plays hints until solved; returns the game. */
function solveByHints(game: PipesGame) {
  let g = game;
  for (let i = 0; i < 1000 && !isSolved(g); i++) {
    const tip = hint(g)!;
    expect(tip.taps).toBeGreaterThan(0);
    for (let t = 0; t < tip.taps; t++) g = play(g, tip.cell);
  }
  return g;
}

describe('a tile', () => {
  it('turns a quarter clockwise', () => {
    expect(rotate(UP)).toBe(RIGHT);
    expect(rotate(LEFT)).toBe(UP);
    expect(rotate(UP | RIGHT)).toBe(RIGHT | DOWN);
    expect(rotate(UP | DOWN, 2)).toBe(UP | DOWN);
    expect(rotate(UP | RIGHT | DOWN, 4)).toBe(UP | RIGHT | DOWN);
    expect(rotate(UP, -1)).toBe(LEFT);
  });

  it('has neighbours inside the grid only', () => {
    expect(neighbour(3, 0, UP)).toBe(-1);
    expect(neighbour(3, 0, LEFT)).toBe(-1);
    expect(neighbour(3, 0, RIGHT)).toBe(1);
    expect(neighbour(3, 0, DOWN)).toBe(3);
    expect(neighbour(3, 8, DOWN)).toBe(-1);
    expect(neighbour(3, 2, RIGHT)).toBe(-1);
  });
});

describe('the water', () => {
  it('runs only through pipes that meet', () => {
    const g = tiny([RIGHT | DOWN, LEFT, UP | RIGHT, UP]);
    expect(watered(g.board, masks(g))).toEqual([true, true, true, false]);
    expect(leaks(g.board, masks(g))).toEqual([false, false, true, true]);
    expect(isSolved(g)).toBe(false);
  });

  it('says which sides of a tile leak', () => {
    const g = tiny([RIGHT | DOWN, LEFT, UP | RIGHT, UP]);
    const now = masks(g);
    expect(leakSides(g.board, now, 0)).toBe(0);
    expect(leakSides(g.board, now, 2)).toBe(RIGHT);
    expect(leakSides(g.board, now, 3)).toBe(UP);
  });

  it('solves when every tile is wet and nothing is open', () => {
    let g = tiny([RIGHT | DOWN, LEFT, UP | RIGHT, UP]);
    for (let i = 0; i < 3; i++) g = play(g, 3);
    expect(masks(g)[3]).toBe(LEFT);
    expect(isSolved(g)).toBe(true);
  });

  it('counts any way that fits, not only the answer', () => {
    // The answer runs the bottom row from the left; this way runs the right column from the top.
    const other = tiny([RIGHT | DOWN, DOWN | LEFT, UP, UP]);
    expect(other.board.start).not.toEqual(other.board.answer);
    expect(isSolved(other)).toBe(true);
  });
});

describe('a game', () => {
  it('turns the tapped tile and remembers the tap', () => {
    const g = play(newGame(1), 5);
    expect(g.turns[5]).toBe(1);
    expect(g.moves).toEqual([5]);
    expect(masks(g)[5]).toBe(rotate(g.board.start[5]));
  });

  it('refuses a cell that is not there, and any tap once solved', () => {
    const g = newGame(1);
    expect(play(g, -1)).toBe(g);
    expect(play(g, 16)).toBe(g);
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
    for (const cell of [0, 4, 4, 9, 20, 33, 2, 2, 2]) g = play(g, cell);
    expect(replay(11, g.moves)).toEqual(g);
    expect(replay(11, [...g.moves, -3, 999]).moves).toEqual(g.moves);
  });
});

describe('levels', () => {
  it('grow from 4×4 to 7×7', () => {
    expect(sizeFor(1)).toBe(4);
    expect(sizeFor(4)).toBe(5);
    expect(sizeFor(9)).toBe(6);
    expect(sizeFor(16)).toBe(7);
    expect(sizeFor(500)).toBe(7);
  });

  it('are one tree of pipes from the spring, dealt unsolved', () => {
    for (let level = 1; level <= 60; level++) {
      const b = makeLevel(level);
      expect(b.size).toBe(sizeFor(level));
      expect(b.start).toHaveLength(b.size * b.size);
      // The answer fits: water everywhere, nothing open, and n − 1 joins (so no loops).
      expect(watered(b, b.answer).every(Boolean)).toBe(true);
      expect(leaks(b, b.answer).some(Boolean)).toBe(false);
      const arms = b.answer.reduce((sum, m) => sum + ((m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1)), 0);
      expect(arms).toBe(2 * (b.size * b.size - 1));
      // Each dealt tile is the answer's, turned.
      b.start.forEach((m, cell) => expect([0, 1, 2, 3].some((k) => rotate(m, k) === b.answer[cell])).toBe(true));
      const g = newGame(level);
      expect(isSolved(g)).toBe(false);
      expect(fewestTaps(b)).toBeGreaterThan(b.size);
    }
  });

  it('are the same every time', () => {
    expect(makeLevel(17)).toEqual(makeLevel(17));
  });

  it('are solved by following the hints', () => {
    for (let level = 1; level <= 40; level++) {
      const g = solveByHints(newGame(level));
      expect(isSolved(g)).toBe(true);
      expect(g.moves.length).toBe(fewestTaps(g.board));
    }
  });

  it('hints still finish a level after random taps', () => {
    for (let n = 0; n < 200; n++) {
      const level = 1 + (n % 25);
      let g = newGame(level);
      let seed = hashSeed(`random:${n}`);
      for (let i = 0; i < 40 && !isSolved(g); i++) {
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        g = play(g, (seed >>> 8) % g.turns.length);
      }
      expect(replay(level, g.moves)).toEqual(g);
      const done = solveByHints(g);
      expect(isSolved(done)).toBe(true);
      expect(replay(level, done.moves)).toEqual(done);
    }
  });

  it('match the golden levels (bump PIPES_VERSION and this hash when levels or taps would come out differently)', () => {
    expect(PIPES_VERSION).toBe(1);
    const text = Array.from({ length: 30 }, (_, i) => {
      const b = makeLevel(i + 1);
      return `${b.size}:${b.source}:${b.answer}:${b.start}`;
    }).join('|');
    expect(hashSeed(text)).toBe(4253727274);
  });
});
