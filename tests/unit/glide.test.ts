import { describe, expect, it } from 'vitest';
import { hashSeed } from '../../src/shared/random';
import {
  DIRS,
  GLIDE_VERSION,
  hint,
  isOut,
  isSolved,
  makeLevel,
  movesLeft,
  newGame,
  play,
  replay,
  settingsFor,
  slide,
  solve,
  undo,
  type Board,
  type GlideGame,
  type Move,
} from '../../src/games/glide/glide';

/** A hand-drawn board: `#` a wall, `.` ice; blocks and pads given as cells. */
function board(rows: string[], starts: number[], pads: number[], par = 9): Board {
  return { size: rows.length, walls: rows.join('').split('').map((c) => c === '#'), starts, pads, par };
}

function game(b: Board): GlideGame {
  return { level: 0, board: b, blocks: b.starts.slice(), moves: [] };
}

describe('a slide', () => {
  const b = board(['.....', '..#..', '.....', '.....', '.....'], [0, 4], [24, 20]);

  it('runs to the edge', () => {
    expect(slide(b, [0, 4], 0, 'down')).toBe(20);
  });

  it('stops before a wall', () => {
    expect(slide(b, [12, 4], 0, 'up')).toBe(12); // the wall is right above
    expect(slide(b, [22, 4], 0, 'up')).toBe(12);
  });

  it('stops before another block', () => {
    expect(slide(b, [0, 4], 0, 'right')).toBe(3);
  });

  it("stays put when it can't move", () => {
    expect(slide(b, [0, 4], 0, 'up')).toBe(0);
    expect(slide(b, [0, 4], 0, 'left')).toBe(0);
  });

  it('slides over pads without stopping', () => {
    const one = board(['.....', '.....', '.....', '.....', '.....'], [0], [2]);
    expect(slide(one, [0], 0, 'right')).toBe(4);
  });
});

describe('a game', () => {
  const b = board(['.....', '.....', '.....', '.....', '....#'], [0], [23], 2);

  it("doesn't count a move that goes nowhere", () => {
    const g = play(game(b), { block: 0, dir: 'up' });
    expect(g.moves).toHaveLength(0);
  });

  it('refuses a move once solved, or once out of moves', () => {
    let g = play(game(b), { block: 0, dir: 'down' });
    g = play(g, { block: 0, dir: 'right' });
    expect(isSolved(g.board, g.blocks)).toBe(true);
    expect(play(g, { block: 0, dir: 'up' })).toBe(g);

    let h = play(game(b), { block: 0, dir: 'right' });
    h = play(h, { block: 0, dir: 'down' });
    expect(movesLeft(h)).toBe(0);
    expect(isOut(h)).toBe(true);
    expect(play(h, { block: 0, dir: 'left' })).toBe(h);
  });

  it('refuses a block or a direction that does not exist', () => {
    const g = game(b);
    expect(play(g, { block: 3, dir: 'down' })).toBe(g);
    expect(play(g, { block: 0, dir: 'sideways' as Move['dir'] })).toBe(g);
  });

  it('solves a hand-drawn board in the fewest moves', () => {
    expect(solve(b, b.starts, 5)).toEqual([
      { block: 0, dir: 'down' },
      { block: 0, dir: 'right' },
    ]);
    expect(solve(b, b.starts, 1)).toBeNull();
  });
});

describe('levels', () => {
  it('grow from one block on 5×5 to three on 7×7', () => {
    expect(settingsFor(1)).toEqual({ size: 5, blocks: 1, par: 3 });
    expect(settingsFor(13).blocks).toBe(3);
    expect(settingsFor(100)).toEqual({ size: 7, blocks: 3, par: 12 });
  });

  it('give exactly the fewest moves each can be done in', () => {
    for (let level = 1; level <= 40; level++) {
      const b = makeLevel(level);
      const { size, blocks } = settingsFor(level);
      expect(b.size).toBe(size);
      expect(b.starts).toHaveLength(blocks);
      expect(new Set(b.starts).size).toBe(blocks);
      expect(new Set(b.pads).size).toBe(blocks);
      for (const cell of [...b.starts, ...b.pads]) expect(b.walls[cell]).toBe(false);
      // Every block has to move.
      b.pads.forEach((pad, i) => expect(pad).not.toBe(b.starts[i]));
      expect(b.par).toBe(settingsFor(level).par);
      expect(solve(b, b.starts, b.par)).toHaveLength(b.par);
      expect(solve(b, b.starts, b.par - 1)).toBeNull();
    }
  });

  it('are the same every time', () => {
    expect(makeLevel(17)).toEqual(makeLevel(17));
  });
});

describe('whole games', () => {
  it('following the hints solves every level', () => {
    for (let level = 1; level <= 30; level++) {
      let g = newGame(level);
      while (!isSolved(g.board, g.blocks)) {
        const move = hint(g);
        expect(move).not.toBeNull();
        g = play(g, move!);
      }
      expect(g.moves).toHaveLength(g.board.par);
    }
  });

  it('end solved or out of moves when played at random, and replay exactly', () => {
    for (let n = 0; n < 200; n++) {
      const level = 1 + (n % 25);
      let g = newGame(level);
      let seed = hashSeed(`random:${n}`);
      while (!isSolved(g.board, g.blocks) && !isOut(g)) {
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        const move = { block: seed % g.blocks.length, dir: DIRS[(seed >>> 8) % 4] };
        g = play(g, move);
      }
      expect(g.moves.length).toBeLessThanOrEqual(g.board.par);
      expect(replay(level, g.moves)).toEqual(g);
    }
  });

  it('undo takes back exactly one move', () => {
    let g = newGame(9);
    const first = hint(g)!;
    g = play(g, first);
    const second = hint(g)!;
    const after = play(g, second);
    expect(undo(after)).toEqual(g);
    expect(undo(newGame(9))).toEqual(newGame(9));
  });

  it('a hint says so when the moves left cannot do it', () => {
    let g = newGame(5);
    while (!isOut(g)) {
      const legal = g.blocks.flatMap((_, block) => DIRS.map((dir) => ({ block, dir }))).find((m) => {
        const next = play(g, m);
        return next !== g && !isSolved(next.board, next.blocks);
      });
      if (!legal) break;
      g = play(g, legal);
      if (!isOut(g) && hint(g) === null) break;
    }
    if (!isSolved(g.board, g.blocks)) expect(hint(g)).toBeNull();
  });

  it('match the golden levels (bump GLIDE_VERSION and this hash when levels or moves would come out differently)', () => {
    expect(GLIDE_VERSION).toBe(1);
    const text = Array.from({ length: 30 }, (_, i) => {
      const b = makeLevel(i + 1);
      return `${b.walls.map((w) => (w ? 1 : 0)).join('')}:${b.starts}:${b.pads}:${b.par}`;
    }).join('|');
    expect(hashSeed(text)).toBe(2047899991);
  });
});
