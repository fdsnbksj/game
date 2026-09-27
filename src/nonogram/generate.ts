import type { Topic } from '../learn/knowledge';
import { cluesOf, type Clues, type Grid } from './clues';
import { PICTURES, type Picture } from './pictures';
import { stream } from './rng';
import { solve } from './solver';

// Puzzles are made from their level alone, so they go on forever and are the same for
// everyone. Each level reveals a hand-drawn picture (pictures.ts), used in order for the
// levels of its size; once a size's pictures run out they come back mirrored, then as
// drawn again. Every one is kept only if its clues settle every cell by line logic,
// which means it has exactly one answer and never needs a guess.

/** Bump when the generator changes: every puzzle changes with it, so it starts a new ladder. */
export const NONOGRAM_VERSION = 2;

/**
 * Grid side: 5 to start, growing to 10, still big enough for a thumb. Each size lasts as
 * many levels as it has pictures, so every picture is seen once on the way up.
 */
export function sizeFor(level: number): number {
  if (level <= 6) return 5;
  if (level <= 14) return 6;
  if (level <= 24) return 7;
  if (level <= 38) return 8;
  return 10;
}

/** The first level of each size, from sizeFor(). */
const FIRST_LEVEL: Record<number, number> = { 5: 1, 6: 7, 7: 15, 8: 25, 10: 39 };

export interface Nonogram extends Clues {
  /** `level:12`. (The removed daily puzzle used `day:2026-09-26`.) */
  id: string;
  size: number;
  /** The one answer, for tests and the audit; play is checked against the clues. */
  solution: Grid;
  /** What it shows, like "a lighthouse", and the topic of the card it leads to. */
  name?: string;
  topic?: Topic;
}

const toGrid = (rows: readonly string[]) => rows.join('').split('').map((c) => (c === '#' ? 1 : 0));
const mirror = (rows: readonly string[]) => rows.map((row) => [...row].reverse().join(''));

export function isLineSolvable(grid: Grid, size: number): boolean {
  const solved = solve(cluesOf(grid, size));
  return solved !== null && solved.every((cell) => cell !== -1);
}

/** A size's pictures that line logic can solve, made once. */
const usable = new Map<number, Picture[]>();
function picturesOf(size: number) {
  let list = usable.get(size);
  if (!list) {
    list = (PICTURES[size] ?? []).filter((p) => isLineSolvable(toGrid(p.rows), size));
    usable.set(size, list);
  }
  return list;
}

export function nonogram(level: number): Nonogram {
  const size = sizeFor(level);
  const id = `level:${level}`;
  const list = picturesOf(size);
  if (list.length === 0) return random(id, size);
  const i = level - FIRST_LEVEL[size];
  const picture = list[i % list.length];
  // Mirroring changes no clue's difficulty, so a mirrored picture is just as solvable.
  const rows = Math.floor(i / list.length) % 2 === 1 ? mirror(picture.rows) : picture.rows;
  const solution = toGrid(rows);
  return { id, size, solution, ...cluesOf(solution, size), name: picture.name, topic: picture.topic };
}

/** Each try is a little denser, and dense pictures settle easily; a full grid always does. */
const DENSER_EVERY = 3;

/** A random pattern, for a size with no pictures. */
function random(id: string, size: number): Nonogram {
  for (let attempt = 0; ; attempt++) {
    const rng = stream(`nonogram:${NONOGRAM_VERSION}:${id}:${attempt}`);
    // Percent filled: around 58 to start, one point more every few tries.
    const density = 55 + rng(8) + Math.floor(attempt / DENSER_EVERY);
    const solution = Array.from({ length: size * size }, () => (rng(100) < density ? 1 : 0));
    if (isLineSolvable(solution, size)) return { id, size, solution, ...cluesOf(solution, size) };
  }
}
