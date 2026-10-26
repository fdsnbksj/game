import { describe, expect, it } from 'vitest';
import { hashSeed } from '../../src/shared/random';
import {
  THREADS_VERSION,
  coloursFor,
  dragTo,
  fills,
  hint,
  isJoined,
  isNext,
  isSolved,
  isValidStroke,
  joinedCount,
  knotAt,
  makeLevel,
  newGame,
  play,
  replay,
  sizeFor,
  startStroke,
  stepsBetween,
  undo,
  type Board,
  type ThreadsGame,
} from '../../src/games/threads/threads';

/** A small hand-made board: 3×3, red from 0 to 6 down the left, blue from 1 to 8 round the rest. */
const tiny: Board = {
  size: 3,
  knots: [
    [0, 6],
    [1, 8],
  ],
  answer: [
    [0, 3, 6],
    [1, 2, 5, 4, 7, 8],
  ],
};
const tinyGame = (): ThreadsGame => ({ level: 0, board: tiny, paths: [[], []], moves: [] });

function solveByHints(game: ThreadsGame) {
  let g = game;
  for (let i = 0; i < 40 && !isSolved(g); i++) g = play(g, hint(g)!);
  return g;
}

function rng(seed: number) {
  let s = seed;
  return (n: number) => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return (s >>> 8) % n;
  };
}

describe('the square', () => {
  it('knows which squares are side by side', () => {
    expect(isNext(3, 0, 1)).toBe(true);
    expect(isNext(3, 0, 3)).toBe(true);
    expect(isNext(3, 2, 3)).toBe(false);
    expect(isNext(3, 0, 4)).toBe(false);
    expect(stepsBetween(3, 0, 8)).toEqual([1, 2, 5, 8]);
    expect(stepsBetween(3, 4, 4)).toEqual([]);
  });
});

describe('a stroke', () => {
  it('runs from a knot, square by square, through no other knot and stops at its partner', () => {
    expect(isValidStroke(tiny, { c: 0, path: [0, 3, 6] })).toBe(true);
    expect(isValidStroke(tiny, { c: 0, path: [6, 3] })).toBe(true);
    expect(isValidStroke(tiny, { c: 0, path: [] })).toBe(true);
    expect(isValidStroke(tiny, { c: 0, path: [3, 6] })).toBe(false); // not from a knot
    expect(isValidStroke(tiny, { c: 0, path: [0, 4] })).toBe(false); // diagonal
    expect(isValidStroke(tiny, { c: 0, path: [0, 1] })).toBe(false); // another knot
    expect(isValidStroke(tiny, { c: 0, path: [0, 3, 0] })).toBe(false); // a square twice
    expect(isValidStroke(tiny, { c: 1, path: [8, 7, 4, 5, 2, 1, 0] })).toBe(false); // other knot
    expect(isValidStroke(tiny, { c: 2, path: [0] })).toBe(false);
  });

  it('cuts the threads it crosses, and a lone knot clears its thread', () => {
    let g = play(tinyGame(), { c: 1, path: [1, 2, 5, 4, 3] });
    g = play(g, { c: 0, path: [0, 3, 6] });
    expect(g.paths).toEqual([[0, 3, 6], [1, 2, 5, 4]]);
    g = play(g, { c: 0, path: [0] });
    expect(g.paths[0]).toEqual([]);
  });

  it('refuses a stroke that changes nothing or is not allowed', () => {
    const g = play(tinyGame(), { c: 0, path: [0, 3] });
    expect(play(g, { c: 0, path: [0, 3] })).toBe(g);
    expect(play(g, { c: 0, path: [0, 4] })).toBe(g);
    expect(play(tinyGame(), { c: 0, path: [0] }).moves).toEqual([]);
  });
});

describe('drawing with a finger', () => {
  it('starts on a knot afresh, or on a thread where the finger is, and nowhere else', () => {
    const g = play(tinyGame(), { c: 1, path: [1, 2, 5, 4] });
    expect(startStroke(g, 0)).toEqual({ c: 0, path: [0] });
    expect(startStroke(g, 5)).toEqual({ c: 1, path: [1, 2, 5] });
    expect(startStroke(g, 8)).toEqual({ c: 1, path: [8] });
    expect(startStroke(g, 7)).toBeNull();
  });

  it('grows onto squares beside it, shrinks back over itself, walks a quick jump, and stops at its partner', () => {
    let s = { c: 1, path: [1] };
    s = dragTo(tiny, s, 7); // across, then down: 2 is not beside 1 downward, so it walks 4, 7
    expect(s.path).toEqual([1, 4, 7]);
    s = dragTo(tiny, s, 1);
    expect(s.path).toEqual([1]);
    s = dragTo(tiny, s, 0); // red's knot
    expect(s.path).toEqual([1]);
    s = dragTo(tiny, dragTo(tiny, s, 2), 8);
    expect(s.path).toEqual([1, 2, 5, 8]);
    expect(isJoined(tiny, 1, s.path)).toBe(true);
    expect(dragTo(tiny, s, 7)).toBe(s); // past its partner
  });
});

describe('a game', () => {
  it('is solved when every pair is joined and every square used, any way that fits', () => {
    let g = play(tinyGame(), { c: 0, path: [0, 3, 6] });
    g = play(g, { c: 1, path: [1, 2, 5, 8] });
    expect(joinedCount(g)).toBe(2);
    expect(isSolved(g)).toBe(false); // 4 and 7 empty
    g = play(g, { c: 1, path: [1, 2, 5, 4, 7, 8] });
    expect(isSolved(g)).toBe(true);
    expect(fills(tiny, g.paths).every((c) => c >= 0)).toBe(true);
    expect(play(g, { c: 0, path: [0] })).toBe(g);
    expect(hint(g)).toBeNull();
  });

  it('undo takes back exactly one stroke, cut threads and all', () => {
    const g0 = newGame(5);
    const [a, b] = g0.board.answer;
    const g1 = play(g0, { c: 0, path: a });
    const g2 = play(g1, { c: 1, path: b });
    expect(undo(g2)).toEqual(g1);
    expect(undo(g1)).toEqual(g0);
    expect(undo(g0)).toEqual(g0);
  });

  it('comes back from its save', () => {
    let g = newGame(12);
    const next = rng(7);
    for (let i = 0; i < 30; i++) {
      const start = startStroke(g, next(g.board.size ** 2));
      if (!start) continue;
      let s = start;
      for (let j = 0; j < 6; j++) s = dragTo(g.board, s, next(g.board.size ** 2));
      g = play(g, s);
    }
    expect(g.moves.length).toBeGreaterThan(5);
    expect(replay(12, g.moves)).toEqual(g);
    expect(replay(12, JSON.parse(JSON.stringify(g.moves)))).toEqual(g);
    expect(replay(12, [...g.moves, { c: 99, path: [0] }, { c: 0, path: [-1] }]).moves).toEqual(g.moves);
  });
});

describe('levels', () => {
  it('grow from 5×5 to 9×9, with one colour per row or one fewer', () => {
    expect([1, 3, 4, 8, 9, 15, 16, 24, 25, 500].map(sizeFor)).toEqual([5, 5, 6, 6, 7, 7, 8, 8, 9, 9]);
    for (let level = 1; level <= 60; level++) {
      const size = sizeFor(level);
      expect([size - 1, size]).toContain(coloursFor(level));
    }
    expect(coloursFor(1)).toBe(4);
    expect(coloursFor(3)).toBe(5);
    expect(coloursFor(25)).toBe(8);
  });

  it('are fair: threads cover the square once, run beside each other, are 3 or more long, and their knots are apart', () => {
    for (let level = 1; level <= 60; level++) {
      const b = makeLevel(level);
      const n = b.size * b.size;
      expect(b.size).toBe(sizeFor(level));
      expect(b.knots).toHaveLength(coloursFor(level));
      expect(b.answer.flat().sort((x, y) => x - y)).toEqual(Array.from({ length: n }, (_, i) => i));
      b.answer.forEach((t, c) => {
        expect(t.length).toBeGreaterThanOrEqual(3);
        expect(isValidStroke(b, { c, path: t })).toBe(true);
        expect(isJoined(b, c, t)).toBe(true);
        expect(isNext(b.size, t[0], t[t.length - 1])).toBe(false);
        expect(knotAt(b, t[0])).toBe(c);
      });
    }
  });

  it('are the same every time', () => {
    expect(makeLevel(17)).toEqual(makeLevel(17));
  });

  it('are solved by following the hints, at most one per colour', () => {
    for (let level = 1; level <= 40; level++) {
      const g = solveByHints(newGame(level));
      expect(isSolved(g)).toBe(true);
      expect(g.moves.length).toBeLessThanOrEqual(g.board.knots.length);
    }
  });

  it('hints still finish a level after random scribbles, and every game replays', () => {
    for (let n = 0; n < 200; n++) {
      const level = 1 + (n % 30);
      let g = newGame(level);
      const next = rng(hashSeed(`random:${n}`));
      const cells = g.board.size ** 2;
      for (let i = 0; i < 20 && !isSolved(g); i++) {
        const start = startStroke(g, next(cells));
        if (!start) continue;
        let s = start;
        for (let j = 0; j < 1 + next(8); j++) s = dragTo(g.board, s, next(cells));
        g = play(g, s);
      }
      expect(replay(level, g.moves)).toEqual(g);
      const done = solveByHints(g);
      expect(isSolved(done)).toBe(true);
      expect(done.moves.length - g.moves.length).toBeLessThanOrEqual(g.board.knots.length);
      expect(replay(level, done.moves)).toEqual(done);
    }
  });

  it('match the golden levels (bump THREADS_VERSION and this hash when levels or strokes would come out differently)', () => {
    expect(THREADS_VERSION).toBe(1);
    const text = Array.from({ length: 30 }, (_, i) => {
      const b = makeLevel(i + 1);
      return `${b.size}:${b.answer.map((t) => t.join(',')).join('/')}`;
    }).join('|');
    expect(hashSeed(text)).toBe(99383931);
  });
});
