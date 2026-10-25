import { createRandom, hashSeed } from '../../shared/random';

// Lanterns: a square of lanterns, some lit. Tap one and it flips, with the four beside it (lit
// goes out, out lights up); put every lantern out. Pure and deterministic: a level is made from
// its number alone (seeded taps played backwards from all out, so every level can be done), so
// it's the same puzzle on every phone, and a game in progress is its level and taps.

/** Bump when a level or a tap would come out differently; it restarts saved games. */
export const LANTERNS_VERSION = 1;

/** A level's board. Cells are numbered row by row, `y * size + x`. */
export interface Board {
  size: number;
  /** The lanterns lit at the start. */
  start: boolean[];
  /** The fewest taps that put them all out. */
  par: number;
}

export interface LanternsGame {
  level: number;
  board: Board;
  /** Each lantern now. */
  lit: boolean[];
  /** The cells tapped, in order. */
  moves: number[];
}

/** A level's square: 3×3 to start, up to 7×7. */
export function sizeFor(level: number) {
  const l = Math.max(1, level);
  return l <= 2 ? 3 : l <= 7 ? 4 : l <= 14 ? 5 : l <= 24 ? 6 : 7;
}

/** The cells a tap on `cell` flips: itself and the ones beside it, inside the square. */
export function reach(size: number, cell: number): number[] {
  const x = cell % size;
  const y = (cell - x) / size;
  const out = [cell];
  if (y > 0) out.push(cell - size);
  if (x < size - 1) out.push(cell + 1);
  if (y < size - 1) out.push(cell + size);
  if (x > 0) out.push(cell - 1);
  return out;
}

/** The lanterns after a tap on `cell`. */
export function flip(size: number, lit: readonly boolean[], cell: number): boolean[] {
  const next = lit.slice();
  for (const c of reach(size, cell)) next[c] = !next[c];
  return next;
}

/**
 * The fewest cells to tap once each to put every lantern out from `lit`, lowest cells first, or
 * null when it can't be done. Tapping a cell twice undoes it and order doesn't matter, so a way
 * out is a set of cells: solved over GF(2) by elimination, then the smallest of every way found
 * by adding the taps that change nothing (at most four of them up to 7×7, so 16 ways to try).
 */
export function fewestWay(size: number, lit: readonly boolean[]): number[] | null {
  const n = size * size;
  // One row per lantern: which taps flip it, and whether it's lit. Taps flip symmetrically.
  const rows = Array.from({ length: n }, (_, cell) => {
    const row = new Array<number>(n + 1).fill(0);
    for (const c of reach(size, cell)) row[c] = 1;
    row[n] = lit[cell] ? 1 : 0;
    return row;
  });
  const pivotOf: number[] = [];
  let r = 0;
  for (let col = 0; col < n && r < n; col++) {
    const p = rows.findIndex((row, i) => i >= r && row[col] === 1);
    if (p < 0) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]];
    for (let i = 0; i < n; i++) {
      if (i !== r && rows[i][col] === 1) for (let k = col; k <= n; k++) rows[i][k] ^= rows[r][k];
    }
    pivotOf[r] = col;
    r++;
  }
  for (let i = r; i < n; i++) if (rows[i][n] === 1) return null;
  const isPivot = new Array<boolean>(n).fill(false);
  for (let i = 0; i < r; i++) isPivot[pivotOf[i]] = true;
  const free = Array.from({ length: n }, (_, c) => c).filter((c) => !isPivot[c]);
  let best: number[] | null = null;
  for (let mask = 0; mask < 1 << free.length; mask++) {
    const x = new Array<number>(n).fill(0);
    free.forEach((c, i) => (x[c] = (mask >> i) & 1));
    for (let i = 0; i < r; i++) {
      let v = rows[i][n];
      for (const c of free) if (rows[i][c] === 1) v ^= x[c];
      x[pivotOf[i]] = v;
    }
    const way = x.flatMap((v, c) => (v ? [c] : []));
    if (best === null || way.length < best.length) best = way;
  }
  return best;
}

/** Makes a level: seeded taps on a dark square, kept when the fewest way back is long enough. */
export function makeLevel(level: number): Board {
  const size = sizeFor(level);
  const cells = size * size;
  const random = createRandom(hashSeed(`lanterns:${LANTERNS_VERSION}:level:${level}`));
  // How many taps the level wants: 3 to start, one more every other level within a size.
  const want = Math.min(Math.floor(cells / 2), 3 + Math.floor((level - firstLevelOf(size)) / 2) + (size - 3));
  let pick: Board | null = null;
  for (let tries = 0; tries < 40; tries++) {
    let lit = new Array<boolean>(cells).fill(false);
    const order = Array.from({ length: cells }, (_, c) => c);
    for (let i = 0; i < want; i++) {
      const j = i + Math.floor(random() * (cells - i));
      [order[i], order[j]] = [order[j], order[i]];
      lit = flip(size, lit, order[i]);
    }
    const par = fewestWay(size, lit)!.length;
    if (par === 0) continue;
    if (pick === null || par > pick.par) pick = { size, start: lit, par };
    if (par >= want) break;
  }
  return pick!;
}

function firstLevelOf(size: number) {
  return size === 3 ? 1 : size === 4 ? 3 : size === 5 ? 8 : size === 6 ? 15 : 25;
}

export function isSolved(game: LanternsGame) {
  return game.lit.every((on) => !on);
}

// The last level made, so a replay doesn't make it again.
let made: { level: number; board: Board } | null = null;

export function newGame(level: number): LanternsGame {
  if (made?.level !== level) made = { level, board: makeLevel(level) };
  return { level, board: made.board, lit: made.board.start.slice(), moves: [] };
}

/** Taps one lantern; returns the game unchanged once solved, or for a cell that isn't there. */
export function play(game: LanternsGame, cell: number): LanternsGame {
  if (!Number.isInteger(cell) || cell < 0 || cell >= game.lit.length || isSolved(game)) return game;
  return { ...game, lit: flip(game.board.size, game.lit, cell), moves: [...game.moves, cell] };
}

/** Takes back the last tap (a tap undoes itself). */
export function undo(game: LanternsGame): LanternsGame {
  if (game.moves.length === 0) return game;
  const cell = game.moves[game.moves.length - 1];
  return { ...game, lit: flip(game.board.size, game.lit, cell), moves: game.moves.slice(0, -1) };
}

/** A level and its taps, played from the start: how a saved game comes back. Taps that don't apply are dropped. */
export function replay(level: number, moves: readonly number[]): LanternsGame {
  let game = newGame(level);
  for (const cell of moves) game = play(game, cell);
  return game;
}

/** The fewest taps from here. */
export function tapsLeft(game: LanternsGame): number {
  return fewestWay(game.board.size, game.lit)?.length ?? 0;
}

/** A cell on the fewest way out from here, or null once solved. Following the hints takes exactly `tapsLeft` taps. */
export function hint(game: LanternsGame): number | null {
  if (isSolved(game)) return null;
  return fewestWay(game.board.size, game.lit)?.[0] ?? null;
}
