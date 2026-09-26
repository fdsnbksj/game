// A grid is a flat list of cells, row by row; 1 is filled, 0 is empty.
export type Grid = number[];

/** The lengths of the filled runs along one line; an empty line has no clue numbers. */
export function lineClue(line: readonly number[]): number[] {
  const clue: number[] = [];
  let run = 0;
  for (const cell of line) {
    if (cell === 1) run++;
    else if (run > 0) {
      clue.push(run);
      run = 0;
    }
  }
  if (run > 0) clue.push(run);
  return clue;
}

export const row = <T>(grid: readonly T[], size: number, r: number): T[] =>
  grid.slice(r * size, r * size + size);

export const column = <T>(grid: readonly T[], size: number, c: number): T[] =>
  Array.from({ length: size }, (_, r) => grid[r * size + c]);

export interface Clues {
  rows: number[][];
  cols: number[][];
}

export function cluesOf(grid: Grid, size: number): Clues {
  const lines = Array.from({ length: size }, (_, i) => i);
  return {
    rows: lines.map((r) => lineClue(row(grid, size, r))),
    cols: lines.map((c) => lineClue(column(grid, size, c))),
  };
}

export const sameClue = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((n, i) => n === b[i]);
