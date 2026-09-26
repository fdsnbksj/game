import { cluesOf, type Clues, type Grid } from './clues';
import { stream } from './rng';
import { solve } from './solver';

// Puzzles are made from their level (or day) alone, so they go on forever and are the
// same for everyone. A picture is drawn at random and kept only if its clues settle every
// cell by line logic, which means it has exactly one answer and never needs a guess.

/** Bump when the generator changes: every puzzle changes with it, so it starts a new ladder. */
export const NONOGRAM_VERSION = 1;

/** Grid side: 5 to start, one more every few levels, up to 10, still big enough for a thumb. */
export function sizeFor(level: number): number {
  if (level <= 3) return 5;
  if (level <= 8) return 6;
  if (level <= 15) return 7;
  if (level <= 25) return 8;
  return 10;
}

export const DAILY_SIZE = 10;

export interface Nonogram extends Clues {
  /** `level:12` or `day:2026-09-26`. */
  id: string;
  size: number;
  /** The one answer, for tests and the audit; play is checked against the clues. */
  solution: Grid;
}

/** Each try is a little denser, and dense pictures settle easily; a full grid always does. */
const DENSER_EVERY = 3;

function make(id: string, size: number): Nonogram {
  for (let attempt = 0; ; attempt++) {
    const rng = stream(`nonogram:${NONOGRAM_VERSION}:${id}:${attempt}`);
    // Percent filled: around 58 to start, one point more every few tries.
    const density = 55 + rng(8) + Math.floor(attempt / DENSER_EVERY);
    const solution = Array.from({ length: size * size }, () => (rng(100) < density ? 1 : 0));
    const clues = cluesOf(solution, size);
    const solved = solve(clues);
    if (solved && solved.every((cell) => cell !== -1)) {
      return { id, size, solution, ...clues };
    }
  }
}

export const nonogram = (level: number) => make(`level:${level}`, sizeFor(level));

export const dailyNonogram = (day: string) => make(`day:${day}`, DAILY_SIZE);
