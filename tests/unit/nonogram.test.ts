import { describe, expect, it } from 'vitest';
import { cluesOf, lineClue } from '../../src/nonogram/clues';
import { isLineSolvable, nonogram, sizeFor } from '../../src/nonogram/generate';
import { PICTURES } from '../../src/nonogram/pictures';
import { isSolved, newPlay, paint, setMode, undo } from '../../src/nonogram/play';
import { solve, solveLine } from '../../src/nonogram/solver';
import { hashSeed } from '../../src/shared/random';

describe('clues', () => {
  it('counts filled runs', () => {
    expect(lineClue([1, 1, 0, 1, 0])).toEqual([2, 1]);
    expect(lineClue([0, 0, 0])).toEqual([]);
    expect(lineClue([1, 1, 1])).toEqual([3]);
  });
});

describe('solveLine', () => {
  it('fills the overlap of a long block', () => {
    expect(solveLine([4], [-1, -1, -1, -1, -1])).toEqual([-1, 1, 1, 1, -1]);
  });
  it('settles a clue that fills the line exactly', () => {
    expect(solveLine([2, 2], [-1, -1, -1, -1, -1])).toEqual([1, 1, 0, 1, 1]);
  });
  it('empties a line with no clue', () => {
    expect(solveLine([], [-1, -1, -1])).toEqual([0, 0, 0]);
  });
  it('uses what is known', () => {
    expect(solveLine([1], [-1, 1, -1, -1])).toEqual([0, 1, 0, 0]);
  });
  it('reports a contradiction', () => {
    expect(solveLine([3], [-1, 0, -1, -1, -1])).toEqual([0, 0, 1, 1, 1]);
    expect(solveLine([3], [-1, 0, -1, 0])).toBeNull();
  });
});

describe('generated puzzles', () => {
  const puzzles = Array.from({ length: 200 }, (_, i) => nonogram(i + 1));

  it('are settled completely by line logic, so each has one answer', () => {
    for (const puzzle of puzzles) {
      expect(solve(puzzle), puzzle.id).toEqual(puzzle.solution);
    }
  });

  it('have clues that match their answer', () => {
    for (const puzzle of puzzles) {
      const { rows, cols } = cluesOf(puzzle.solution, puzzle.size);
      expect({ rows, cols }).toEqual({ rows: puzzle.rows, cols: puzzle.cols });
    }
  });

  it('grow with the level and cap at 10', () => {
    expect(nonogram(1).size).toBe(5);
    expect(nonogram(500).size).toBe(10);
    for (let level = 1; level < 100; level++) {
      expect(sizeFor(level + 1)).toBeGreaterThanOrEqual(sizeFor(level));
    }
  });

  it('are the same on every device (golden hash)', () => {
    const clues = Array.from({ length: 20 }, (_, i) => {
      const { rows, cols } = nonogram(i + 1);
      return { rows, cols };
    });
    // Changes only when the generator does; then bump NONOGRAM_VERSION and update this.
    expect(hashSeed(JSON.stringify(clues))).toBe(3539198533);
  });
});

describe('pictures', () => {
  it('are square, of their size, and solvable by line logic alone', () => {
    const unsolvable: string[] = [];
    for (const [size, list] of Object.entries(PICTURES)) {
      for (const picture of list) {
        expect(picture.rows.length, picture.name).toBe(Number(size));
        for (const row of picture.rows) expect(row, picture.name).toMatch(new RegExp(`^[#.]{${size}}$`));
        const grid = picture.rows.join('').split('').map((c) => (c === '#' ? 1 : 0));
        if (!isLineSolvable(grid, Number(size))) unsolvable.push(`${size}: ${picture.name}`);
      }
    }
    // Redraw any listed here: they would need a guess, so the generator skips them.
    expect(unsolvable).toEqual([]);
  });

  it('are each seen once as the grid grows, in order', () => {
    const names = (size: number) => PICTURES[size].map((p) => p.name);
    for (const size of [5, 6, 7, 8]) {
      const levels = Array.from({ length: 60 }, (_, i) => i + 1).filter((l) => sizeFor(l) === size);
      expect(levels.map((l) => nonogram(l).name), `size ${size}`).toEqual(names(size));
    }
  });

  it('come back mirrored once the 10x10 pictures run out', () => {
    const count = PICTURES[10].length;
    const first = nonogram(39);
    const again = nonogram(39 + count);
    expect(again.name).toBe(first.name);
    const rows = (p: typeof first) => Array.from({ length: 10 }, (_, r) => p.solution.slice(r * 10, r * 10 + 10).join(''));
    expect(rows(again)).toEqual(rows(first).map((r) => [...r].reverse().join('')));
    expect(nonogram(39 + 2 * count).solution).toEqual(first.solution);
  });
});

describe('play', () => {
  const puzzle = nonogram(1);
  const filled = puzzle.solution.flatMap((cell, i) => (cell === 1 ? [i] : []));

  it('solves when the filled cells give every clue', () => {
    let state = newPlay(puzzle.size);
    expect(isSolved(state, puzzle)).toBe(false);
    for (const cell of filled) state = paint(state, [cell]);
    expect(isSolved(state, puzzle)).toBe(true);
  });

  it('ignores crosses when checking', () => {
    let state = paint(newPlay(puzzle.size), filled);
    state = setMode(state, 'cross');
    const empty = puzzle.solution.flatMap((cell, i) => (cell === 0 ? [i] : []));
    state = paint(state, empty);
    expect(isSolved(state, puzzle)).toBe(true);
  });

  it('clears when a stroke starts on a cell already marked that way', () => {
    let state = paint(newPlay(5), [0, 1, 2]);
    expect(state.marks.slice(0, 3)).toEqual([1, 1, 1]);
    state = paint(state, [0, 1]);
    expect(state.marks.slice(0, 3)).toEqual([0, 0, 1]);
  });

  it('undoes a whole drag in one step', () => {
    let state = paint(newPlay(5), [0]);
    state = paint(setMode(state, 'cross'), [0, 1, 2]);
    expect(state.marks.slice(0, 3)).toEqual([2, 2, 2]);
    state = undo(state);
    expect(state.marks.slice(0, 3)).toEqual([1, 0, 0]);
    state = undo(undo(state));
    expect(state.marks.slice(0, 3)).toEqual([0, 0, 0]);
  });
});
