import { describe, expect, it } from 'vitest';
import {
  BEADS_VERSION,
  CAPACITY,
  coloursFor,
  hint,
  isComplete,
  isSolved,
  isStuck,
  legalMoves,
  makeLevel,
  MAX_COLOURS,
  newGame,
  play,
  pourCount,
  replay,
  solve,
  SPARE_TUBES,
  topRun,
  undo,
  type BeadsGame,
} from '../../src/games/beads/beads';
import { createRandom, hashSeed } from '../../src/shared/random';

// Bead Sort: a level comes from its number alone, every level can be sorted, and a game is
// its level plus its moves, so a save comes back exactly by replaying them.

describe('levels', () => {
  it('grow from three colours to nine, one more every third level', () => {
    expect([1, 3, 4, 6, 7, 19, 100].map(coloursFor)).toEqual([3, 3, 4, 4, 5, 9, MAX_COLOURS]);
  });

  it('hold four of each colour, plus two empty tubes, and are the same every time', () => {
    for (let level = 1; level <= 30; level++) {
      const tubes = makeLevel(level);
      const colours = coloursFor(level);
      expect(tubes).toHaveLength(colours + SPARE_TUBES);
      expect(tubes.filter((t) => t.length === 0)).toHaveLength(SPARE_TUBES);
      for (let c = 0; c < colours; c++) expect(tubes.flat().filter((b) => b === c)).toHaveLength(CAPACITY);
      expect(makeLevel(level)).toEqual(tubes);
    }
  });

  it('never start half done: no tube shows three of a colour on top', () => {
    for (let level = 1; level <= 30; level++) for (const tube of makeLevel(level)) expect(topRun(tube)).toBeLessThan(CAPACITY - 1);
  });

  it('can all be sorted, and the solver’s way really sorts them', () => {
    for (let level = 1; level <= 60; level++) {
      const path = solve(makeLevel(level))!;
      expect(path).not.toBeNull();
      const game = path.reduce<BeadsGame>((g, move) => {
        const next = play(g, move);
        expect(next).not.toBe(g);
        return next;
      }, newGame(level));
      expect(isSolved(game.tubes)).toBe(true);
    }
  });
});

describe('moves', () => {
  it('slide the whole top run of one colour, as much as fits', () => {
    const tubes = [[0, 1, 1], [2, 1], [], [3, 3, 3, 3]];
    expect(topRun(tubes[0])).toBe(2);
    expect(pourCount(tubes, 0, 1)).toBe(2);
    expect(pourCount(tubes, 0, 2)).toBe(2);
    expect(pourCount(tubes, 1, 0)).toBe(1);
    const game = play({ level: 1, tubes, moves: [] }, { from: 0, to: 1 });
    expect(game.tubes).toEqual([[0], [2, 1, 1, 1], [], [3, 3, 3, 3]]);
  });

  it('only go onto the same colour or an empty tube, with room', () => {
    const tubes = [[0, 1], [2], [1, 1, 1, 0], [], [3, 3, 3, 3]];
    expect(pourCount(tubes, 0, 1)).toBe(0); // wrong colour
    expect(pourCount(tubes, 0, 2)).toBe(0); // full
    expect(pourCount(tubes, 0, 0)).toBe(0); // itself
    expect(pourCount(tubes, 3, 0)).toBe(0); // nothing to move
    expect(pourCount(tubes, 4, 3)).toBe(0); // a finished tube stays put
    const game = { level: 1, tubes, moves: [] };
    expect(play(game, { from: 0, to: 1 })).toBe(game);
  });

  it('are sorted when every tube is empty or full of one colour', () => {
    expect(isComplete([2, 2, 2, 2])).toBe(true);
    expect(isComplete([2, 2, 2])).toBe(false);
    expect(isSolved([[1, 1, 1, 1], [], [0, 0, 0, 0]])).toBe(true);
    expect(isSolved([[1, 1, 1], [1], [0, 0, 0, 0]])).toBe(false);
  });

  it('leave out pointless ones: a one-colour tube into an empty one, or to a second empty tube', () => {
    const moves = legalMoves([[0, 0], [1, 0], [], []]);
    expect(moves).toEqual([
      { from: 0, to: 1 },
      { from: 1, to: 0 },
      { from: 1, to: 2 },
    ]);
  });

  it('can be stuck, and then the hint says so', () => {
    const tubes = [
      [0, 1, 0, 1],
      [1, 0, 1, 0],
    ];
    expect(isStuck(tubes)).toBe(true);
    expect(hint(tubes)).toBeNull();
  });

  it('undo one at a time, back to the start', () => {
    let game = newGame(5);
    const start = game;
    const path = solve(game.tubes)!;
    for (const move of path.slice(0, 4)) game = play(game, move);
    const before = play(newGame(5), path[0]);
    for (let i = 0; i < 3; i++) game = undo(game);
    expect(game).toEqual(before);
    expect(undo(undo(game))).toEqual(start);
  });

  it('give a hint that leads to sorted', () => {
    let game = newGame(12);
    for (let i = 0; i < 200 && !isSolved(game.tubes); i++) game = play(game, hint(game.tubes)!);
    expect(isSolved(game.tubes)).toBe(true);
  });
});

/** Random moves until sorted, stuck or out of patience; then the hint finishes it if it can. */
function randomGame(level: number, seed: string) {
  const random = createRandom(hashSeed(seed));
  let game = newGame(level);
  for (let i = 0; i < 150 && !isSolved(game.tubes); i++) {
    const moves = legalMoves(game.tubes);
    if (moves.length === 0) break;
    game = play(game, moves[Math.floor(random() * moves.length)]);
  }
  return game;
}

describe('whole games', () => {
  it('random players always end sorted or stuck, and the hint says which way out', () => {
    let finished = 0;
    for (let n = 0; n < 200; n++) {
      const level = 1 + (n % 25);
      let game = randomGame(level, `random:${n}`);
      const way = solve(game.tubes);
      if (way) for (const move of way) game = play(game, move);
      else while (game.moves.length > 0 && !solve(game.tubes)) game = undo(game);
      if (!way) for (const move of solve(game.tubes)!) game = play(game, move);
      expect(isSolved(game.tubes)).toBe(true);
      finished++;
    }
    expect(finished).toBe(200);
  });

  it('resume from a save: the level and moves replay to the same tubes', () => {
    for (let n = 0; n < 50; n++) {
      const game = randomGame(1 + (n % 20), `save:${n}`);
      const saved = JSON.parse(JSON.stringify({ level: game.level, moves: game.moves }));
      expect(replay(saved.level, saved.moves)).toEqual(game);
    }
  });

  it('match the golden levels (bump BEADS_VERSION and this hash when levels or moves would come out differently)', () => {
    expect(BEADS_VERSION).toBe(1);
    const levels = Array.from({ length: 40 }, (_, i) => makeLevel(i + 1));
    const games = Array.from({ length: 10 }, (_, n) => randomGame(n + 1, `golden:${n}`));
    expect(hashSeed(JSON.stringify({ levels, games }))).toBe(3585159986);
  });
});
