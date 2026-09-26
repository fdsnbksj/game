import { column, row, type Clues } from './clues';

// Solves the way a player does: one row or column at a time, marking only the cells
// that every arrangement of that line's clue agrees on, until nothing more follows.
// A puzzle this settles completely has exactly one answer and never needs a guess.

/** -1 not known yet, 0 empty, 1 filled. */
export type Cell = -1 | 0 | 1;

/**
 * What one line's clue forces, given what's already known: the same line with every
 * forced cell set, or null if no arrangement fits.
 */
export function solveLine(clue: readonly number[], known: readonly Cell[]): Cell[] | null {
  const n = known.length;
  const k = clue.length;
  const canEmpty = (i: number) => known[i] !== 1;
  const fits = (block: number, at: number) => {
    const end = at + clue[block];
    if (end > n) return false;
    for (let i = at; i < end; i++) if (known[i] === 0) return false;
    return end === n || canEmpty(end);
  };
  // A block placed at `at` also takes the empty cell after it, so the next block can't touch it.
  const after = (block: number, at: number) => Math.min(n, at + clue[block] + 1);

  // front[i][j]: cells before i can hold exactly the first j blocks.
  const front = Array.from({ length: n + 1 }, () => new Array<boolean>(k + 1).fill(false));
  front[0][0] = true;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= k; j++) {
      if (!front[i][j]) continue;
      if (canEmpty(i)) front[i + 1][j] = true;
      if (j < k && fits(j, i)) front[after(j, i)][j + 1] = true;
    }
  }
  // back[i][j]: cells from i on can hold exactly blocks j onwards.
  const back = Array.from({ length: n + 1 }, () => new Array<boolean>(k + 1).fill(false));
  back[n][k] = true;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = k; j >= 0; j--) {
      back[i][j] =
        (canEmpty(i) && back[i + 1][j]) || (j < k && fits(j, i) && back[after(j, i)][j + 1]);
    }
  }
  if (!back[0][0]) return null;

  const mayEmpty = new Array<boolean>(n).fill(false);
  const mayFill = new Array<boolean>(n).fill(false);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= k; j++) {
      if (front[i][j] && canEmpty(i) && back[i + 1][j]) mayEmpty[i] = true;
      if (j < k && front[i][j] && fits(j, i) && back[after(j, i)][j + 1]) {
        for (let c = i; c < i + clue[j]; c++) mayFill[c] = true;
        // The gap cell after the block is empty in this arrangement too.
        if (i + clue[j] < n) mayEmpty[i + clue[j]] = true;
      }
    }
  }
  return known.map((cell, i) => {
    if (cell !== -1) return cell;
    if (mayFill[i] && !mayEmpty[i]) return 1;
    if (mayEmpty[i] && !mayFill[i]) return 0;
    return -1;
  });
}

/** Everything the clues settle by line logic alone; null if they contradict. */
export function solve(clues: Clues): Cell[] | null {
  const size = clues.rows.length;
  const grid = new Array<Cell>(size * size).fill(-1);
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < size; r++) {
      const next = solveLine(clues.rows[r], row(grid, size, r));
      if (!next) return null;
      next.forEach((cell, c) => {
        if (grid[r * size + c] !== cell) {
          grid[r * size + c] = cell;
          changed = true;
        }
      });
    }
    for (let c = 0; c < size; c++) {
      const next = solveLine(clues.cols[c], column(grid, size, c));
      if (!next) return null;
      next.forEach((cell, r) => {
        if (grid[r * size + c] !== cell) {
          grid[r * size + c] = cell;
          changed = true;
        }
      });
    }
  }
  return grid;
}
