import { describe, expect, it } from 'vitest';
import { hashSeed } from '../../src/shared/random';
import {
  CLEAR,
  TRY,
  VAULT_VERSION,
  codesLeft,
  couldBe,
  fillMoves,
  fits,
  hint,
  isSolved,
  makeCode,
  newGame,
  play,
  replay,
  rulesFor,
  score,
  undo,
  type VaultGame,
} from '../../src/games/vault/vault';

function tryCode(game: VaultGame, code: number[]) {
  let g = game;
  for (const move of [...fillMoves(g, code), TRY]) g = play(g, move);
  return g;
}

/** Tries hints until the lock opens; returns the game. */
function solveByHints(game: VaultGame) {
  let g = game;
  for (let i = 0; i < 40 && !isSolved(g); i++) g = tryCode(g, hint(g)!);
  return g;
}

describe('the answer', () => {
  it('counts right places, then right colours in the wrong place', () => {
    expect(score([0, 1, 2, 3], [0, 1, 2, 3])).toEqual({ exact: 4, near: 0 });
    expect(score([0, 1, 2, 3], [3, 2, 1, 0])).toEqual({ exact: 0, near: 4 });
    expect(score([0, 1, 2, 3], [0, 2, 4, 5])).toEqual({ exact: 1, near: 1 });
    expect(score([0, 1, 2, 3], [4, 4, 5, 5])).toEqual({ exact: 0, near: 0 });
  });

  it('counts a repeated colour only as often as the code has it', () => {
    expect(score([0, 0, 1, 1], [0, 1, 0, 1])).toEqual({ exact: 2, near: 2 });
    expect(score([0, 1, 2, 3], [0, 0, 0, 0])).toEqual({ exact: 1, near: 0 });
    expect(score([1, 0, 0, 2], [0, 0, 0, 0])).toEqual({ exact: 2, near: 0 });
    expect(score([1, 2, 3, 0], [0, 0, 4, 4])).toEqual({ exact: 0, near: 1 });
  });
});

describe('levels', () => {
  it('grow from 3 pegs of 4 colours to 5 pegs of 8 that can repeat', () => {
    expect(rulesFor(1)).toEqual({ slots: 3, colours: 4, repeats: false });
    expect(rulesFor(3)).toEqual({ slots: 4, colours: 5, repeats: false });
    expect(rulesFor(7)).toEqual({ slots: 4, colours: 6, repeats: true });
    expect(rulesFor(13)).toEqual({ slots: 5, colours: 6, repeats: true });
    expect(rulesFor(21)).toEqual({ slots: 5, colours: 8, repeats: true });
    expect(rulesFor(900)).toEqual(rulesFor(21));
  });

  it('make codes that keep their rules, the same every time', () => {
    for (let level = 1; level <= 60; level++) {
      const code = makeCode(level);
      expect(fits(rulesFor(level), code)).toBe(true);
      expect(makeCode(level)).toEqual(code);
    }
  });
});

describe('a game', () => {
  it('fills the first empty slot, empties a slot, and tries a full row', () => {
    let g = newGame(1);
    g = play(play(play(g, 0), 1), 2);
    expect(g.draft).toEqual([0, 1, 2]);
    expect(play(g, 3)).toBe(g); // full
    g = play(g, CLEAR + 1);
    expect(g.draft).toEqual([0, null, 2]);
    expect(play(g, TRY)).toBe(g); // not full
    g = play(g, 3);
    expect(g.draft).toEqual([0, 3, 2]);
    g = play(g, TRY);
    expect(g.tries).toEqual([{ guess: [0, 3, 2], answer: score(g.code, [0, 3, 2]) }]);
    expect(g.draft).toEqual([null, null, null]);
  });

  it('refuses a colour twice when the level has no repeats, but allows it when it does', () => {
    const g = play(newGame(1), 2);
    expect(play(g, 2)).toBe(g);
    const r = play(newGame(10), 2);
    expect(play(r, 2).draft.slice(0, 2)).toEqual([2, 2]);
  });

  it('refuses a colour the level lacks, an empty slot, a row already tried, and anything once open', () => {
    const g = newGame(1);
    expect(play(g, 4)).toBe(g);
    expect(play(g, -1)).toBe(g);
    expect(play(g, 1.5)).toBe(g);
    expect(play(g, CLEAR)).toBe(g);
    expect(play(g, 55)).toBe(g);
    const wrong = [0, 1, 2, 3].find((c) => c !== g.code[0])!;
    const guess = [wrong, ...[0, 1, 2, 3].filter((c) => c !== wrong).slice(0, 2)];
    const once = tryCode(g, guess);
    expect(once.tries).toHaveLength(1);
    const twice = tryCode(once, guess);
    expect(twice.tries).toHaveLength(1);
    const open = tryCode(g, g.code);
    expect(isSolved(open)).toBe(true);
    expect(play(open, 0)).toBe(open);
    expect(undo(open)).toBe(open);
    expect(hint(open)).toBeNull();
  });

  it('undo takes back exactly one move, try included', () => {
    const g = play(play(newGame(5), 0), 1);
    expect(undo(g)).toEqual(play(newGame(5), 0));
    const tried = tryCode(newGame(5), [0, 1, 2, 3]);
    expect(undo(tried).tries).toHaveLength(0);
    expect(undo(tried).draft).toEqual([0, 1, 2, 3]);
    expect(undo(newGame(5))).toEqual(newGame(5));
  });

  it('comes back from its save', () => {
    let g = newGame(14);
    for (const move of [0, 1, 2, 3, 4, TRY, 5, 5, CLEAR + 1, 0, 1, 2, TRY, 3]) g = play(g, move);
    expect(replay(14, g.moves)).toEqual(g);
    expect(replay(14, [...g.moves, -3, 999, CLEAR + 7]).moves).toEqual(g.moves);
  });
});

describe('hints', () => {
  it('always fit every answer so far, and the code always fits', () => {
    let g = newGame(22);
    for (let i = 0; i < 3 && !isSolved(g); i++) {
      const h = hint(g)!;
      expect(couldBe(g, h)).toBe(true);
      expect(couldBe(g, g.code)).toBe(true);
      g = tryCode(g, h);
    }
    expect(codesLeft(newGame(1))).toBe(24);
    expect(codesLeft(newGame(3))).toBe(120);
  });

  it('open every level, in a sensible number of tries', () => {
    let total = 0;
    for (let level = 1; level <= 40; level++) {
      const g = solveByHints(newGame(level));
      expect(isSolved(g)).toBe(true);
      expect(g.tries.length).toBeLessThanOrEqual(12);
      total += g.tries.length;
    }
    expect(total / 40).toBeLessThan(8);
  });

  it('still open the lock after random play, and the game replays', () => {
    for (let n = 0; n < 200; n++) {
      const level = 1 + (n % 30);
      let g = newGame(level);
      let seed = hashSeed(`random:${n}`);
      for (let i = 0; i < 40 && !isSolved(g); i++) {
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        const r = seed >>> 8;
        const move = r % 5 === 0 ? TRY : r % 7 === 0 ? CLEAR + (r % g.rules.slots) : r % g.rules.colours;
        g = play(g, move);
      }
      expect(replay(level, g.moves)).toEqual(g);
      const done = solveByHints(g);
      expect(isSolved(done)).toBe(true);
      expect(done.tries[done.tries.length - 1].guess).toEqual(done.code);
      expect(replay(level, done.moves)).toEqual(done);
    }
  });

  it('match the golden levels (bump VAULT_VERSION and this hash when codes or hints would come out differently)', () => {
    expect(VAULT_VERSION).toBe(1);
    const text = Array.from({ length: 30 }, (_, i) => {
      const g = newGame(i + 1);
      return `${g.code.join('')}:${hint(g)!.join('')}`;
    }).join('|');
    expect(hashSeed(text)).toBe(2311242330);
  });
});
