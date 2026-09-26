import { describe, expect, it } from 'vitest';
import { cluesOf, lineClue } from '../../src/nonogram/clues';
import { DAILY_SIZE, dailyNonogram, nonogram, sizeFor } from '../../src/nonogram/generate';
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
  const puzzles = [
    ...Array.from({ length: 200 }, (_, i) => nonogram(i + 1)),
    ...Array.from({ length: 30 }, (_, i) => dailyNonogram(`2026-10-${String(i + 1).padStart(2, '0')}`)),
  ];

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
    expect(dailyNonogram('2026-09-26').size).toBe(DAILY_SIZE);
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
    expect(hashSeed(JSON.stringify(clues))).toBe(3492071791);
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
