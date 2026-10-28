import { createRandom, hashSeed } from '../../shared/random';

// Gridlock: a 6×6 car park packed with cars and trucks. Each one only drives forwards and back
// along its own line; slide them about until the red car can drive out of the gap in the right
// wall. A slide of any length is one move. Pure and deterministic: a level comes from its number
// alone, so it's the same car park on every phone, and a game in progress is its level and moves.

/** Bump when a level, a slide or a hint would come out differently; it restarts saved games. */
export const GRIDLOCK_VERSION = 1;

export const SIZE = 6;
/** The row the red car (car 0) is on; the exit is at its right end. */
export const EXIT_ROW = 2;
/** Where the red car stands when it's at the exit: solved. */
export const OUT = SIZE - 2;

/** A car: how long, which way it faces, and the row (across) or column (down) it drives along. */
export interface Car {
  len: 2 | 3;
  across: boolean;
  line: number;
}

/** A level's car park: its cars (car 0 the red one), where each starts, and the fewest moves out. */
export interface Lot {
  cars: Car[];
  /** Each car's front-left cell along its line: a column for a car across, a row for one down. */
  starts: number[];
  par: number;
}

/** A slide: which car, and where along its line it ends up. */
export interface Move {
  car: number;
  to: number;
}

export interface GridlockGame {
  level: number;
  lot: Lot;
  /** Where each car is now, along its line. */
  at: number[];
  moves: Move[];
}

/** How hard a level is: how many cars it starts with, how often one is a truck, and the moves out it aims for. */
export function settingsFor(level: number) {
  const l = Math.max(1, level);
  return {
    cars: Math.min(6 + Math.floor(l / 3), 13),
    trucks: Math.min(0.15 + l * 0.01, 0.4),
    par: Math.min(3 + Math.floor((l - 1) / 2), 18),
  };
}

/** The cells a car covers when it stands at `pos`, as row × SIZE + column. */
export function cellsOf(car: Car, pos: number): number[] {
  return Array.from({ length: car.len }, (_, i) => (car.across ? car.line * SIZE + pos + i : (pos + i) * SIZE + car.line));
}

/** Which car is in each cell, or -1. */
export function occupancy(cars: readonly Car[], at: readonly number[]): number[] {
  const grid = new Array<number>(SIZE * SIZE).fill(-1);
  cars.forEach((car, i) => {
    for (const cell of cellsOf(car, at[i])) grid[cell] = i;
  });
  return grid;
}

/** How far back and forwards a car can drive from where it is: [lowest, highest] along its line. */
export function reach(cars: readonly Car[], at: readonly number[], car: number, grid = occupancy(cars, at)): [number, number] {
  const c = cars[car];
  const cell = (pos: number) => (c.across ? c.line * SIZE + pos : pos * SIZE + c.line);
  let lo = at[car];
  while (lo > 0 && grid[cell(lo - 1)] < 0) lo--;
  let hi = at[car];
  while (hi + c.len < SIZE && grid[cell(hi + c.len)] < 0) hi++;
  return [lo, hi];
}

export function isOut(at: readonly number[]) {
  return at[0] === OUT;
}

export function isSolved(game: GridlockGame) {
  return isOut(game.at);
}

/** Plays one slide; returns the game unchanged when it doesn't apply (or once solved). */
export function play(game: GridlockGame, move: Move): GridlockGame {
  const { cars } = game.lot;
  if (isSolved(game) || !Number.isInteger(move.car) || move.car < 0 || move.car >= cars.length || !Number.isInteger(move.to)) return game;
  const [lo, hi] = reach(cars, game.at, move.car);
  if (move.to === game.at[move.car] || move.to < lo || move.to > hi) return game;
  const at = game.at.slice();
  at[move.car] = move.to;
  return { ...game, at, moves: [...game.moves, { car: move.car, to: move.to }] };
}

/** Every slide from here, each car's from back to front. */
export function slides(cars: readonly Car[], at: readonly number[]): Move[] {
  const grid = occupancy(cars, at);
  const out: Move[] = [];
  for (let car = 0; car < cars.length; car++) {
    const [lo, hi] = reach(cars, at, car, grid);
    for (let to = lo; to <= hi; to++) if (to !== at[car]) out.push({ car, to });
  }
  return out;
}

/** A position as one number: each car's place, three bits a car (13 cars fit well inside 2⁵³). */
function keyOf(at: readonly number[]) {
  let key = 0;
  for (let i = at.length - 1; i >= 0; i--) key = key * 8 + at[i];
  return key;
}

function moved(at: readonly number[], move: Move) {
  const next = at.slice();
  next[move.car] = move.to;
  return next;
}

/** The fewest slides from `at` that get the red car out (breadth-first), or null if it can't get out. */
export function solve(cars: readonly Car[], at: readonly number[], limit = 200_000): Move[] | null {
  if (isOut(at)) return [];
  const seen = new Map<number, { from: number; move: Move } | null>([[keyOf(at), null]]);
  let queue: number[][] = [at.slice()];
  while (queue.length) {
    const next: number[][] = [];
    for (const state of queue) {
      const from = keyOf(state);
      for (const move of slides(cars, state)) {
        const after = moved(state, move);
        const key = keyOf(after);
        if (seen.has(key)) continue;
        seen.set(key, { from, move });
        if (isOut(after)) {
          const path: Move[] = [];
          for (let k = key, step = seen.get(k); step; k = step.from, step = seen.get(k)) path.push(step.move);
          return path.reverse();
        }
        if (seen.size > limit) return null;
        next.push(after);
      }
    }
    queue = next;
  }
  return null;
}

/** The most positions a level's car park may have; bigger ones are drawn again (rare, and slow to solve). */
const EXPLORE_LIMIT = 5_000;
const TRIES = 24;

/** A seeded car park: the red car on its row, then as many cars and trucks as fit in the tries. */
function drawLot(random: () => number, settings: ReturnType<typeof settingsFor>): { cars: Car[]; at: number[] } {
  const cars: Car[] = [{ len: 2, across: true, line: EXIT_ROW }];
  const at = [Math.floor(random() * 3)];
  const grid = occupancy(cars, at);
  for (let attempt = 0; attempt < 300 && cars.length < settings.cars; attempt++) {
    const car: Car = { len: random() < settings.trucks ? 3 : 2, across: random() < 0.5, line: Math.floor(random() * SIZE) };
    const pos = Math.floor(random() * (SIZE + 1 - car.len));
    // A car across the red one's row would block it for good, or do nothing.
    if (car.across && car.line === EXIT_ROW) continue;
    const cells = cellsOf(car, pos);
    if (cells.some((c) => grid[c] >= 0)) continue;
    for (const c of cells) grid[c] = cars.length;
    cars.push(car);
    at.push(pos);
  }
  return { cars, at };
}

/**
 * Every position the drawn car park can reach and how many slides each is from out, then the one
 * nearest the level's aim without going over it (the first found on a tie). Null when the car
 * park is too big to explore or the red car can never get out.
 */
function hardestStart(cars: Car[], start: number[], aim: number): { at: number[]; par: number } | null {
  const index = new Map<number, number>([[keyOf(start), 0]]);
  const states: number[][] = [start];
  // Each position's neighbours by index, kept so the second search needn't slide them again.
  const links: number[][] = [];
  for (let i = 0; i < states.length; i++) {
    const here: number[] = [];
    for (const move of slides(cars, states[i])) {
      const after = moved(states[i], move);
      const key = keyOf(after);
      let j = index.get(key);
      if (j === undefined) {
        j = states.length;
        index.set(key, j);
        states.push(after);
        if (states.length > EXPLORE_LIMIT) return null;
      }
      here.push(j);
    }
    links.push(here);
  }
  // Slides can always be driven back, so the distance out is a breadth-first search from every way out.
  const dist = new Array<number>(states.length).fill(-1);
  let queue: number[] = [];
  states.forEach((s, i) => {
    if (isOut(s)) {
      dist[i] = 0;
      queue.push(i);
    }
  });
  if (!queue.length) return null;
  while (queue.length) {
    const next: number[] = [];
    for (const i of queue) {
      for (const j of links[i]) {
        if (dist[j] >= 0) continue;
        dist[j] = dist[i] + 1;
        next.push(j);
      }
    }
    queue = next;
  }
  let best = -1;
  for (let i = 0; i < states.length; i++) if (dist[i] >= 0 && dist[i] <= aim && (best < 0 || dist[i] > dist[best])) best = i;
  return dist[best] > 0 ? { at: states[best], par: dist[best] } : null;
}

/** Makes a level from its seed: the hardest start found, as near its aim as the tries allow. */
export function makeLevel(level: number): Lot {
  const settings = settingsFor(level);
  const random = createRandom(hashSeed(`gridlock:${GRIDLOCK_VERSION}:level:${level}`));
  let best: Lot | null = null;
  for (let t = 0; t < TRIES || !best || (t < 2 * TRIES && best.par < settings.par - 3); t++) {
    const { cars, at } = drawLot(random, settings);
    const found = hardestStart(cars, at, settings.par);
    if (!found || (best && found.par <= best.par)) continue;
    best = { cars, starts: found.at, par: found.par };
    if (found.par === settings.par) break;
  }
  return best;
}

export function newGame(level: number): GridlockGame {
  const lot = makeLevel(level);
  return { level, lot, at: lot.starts.slice(), moves: [] };
}

/** A level and its moves, played from the start: how a saved game comes back. Moves that don't apply are dropped. */
export function replay(level: number, moves: readonly Move[], lot = makeLevel(level)): GridlockGame {
  let game: GridlockGame = { level, lot, at: lot.starts.slice(), moves: [] };
  for (const move of moves) game = play(game, move);
  return game;
}

/** Takes back the last slide. */
export function undo(game: GridlockGame): GridlockGame {
  if (game.moves.length === 0 || isSolved(game)) return game;
  return replay(game.level, game.moves.slice(0, -1), game.lot);
}

/** The first slide of a fewest way out from here, or null once out. Following hints takes exactly `fewestLeft` moves. */
export function hint(game: GridlockGame): Move | null {
  return solve(game.lot.cars, game.at)?.[0] ?? null;
}

/** How many slides the fewest way out from here takes. */
export function fewestLeft(game: GridlockGame): number {
  return solve(game.lot.cars, game.at)?.length ?? 0;
}

/** A move as one number for the save, and back. */
export const packMove = (m: Move) => m.car * 8 + m.to;
export const unpackMove = (n: number): Move => ({ car: Math.floor(n / 8), to: n % 8 });
