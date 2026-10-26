import { createRandom, hashSeed } from '../../shared/random';

// Threads: a square with pairs of knots, one colour per pair. Draw a thread from each knot to its
// partner through the squares beside each other (no diagonals); threads can't cross or share a
// square, and every square must be used. Pure and deterministic: a level is made from its number
// alone (one seeded path through every square, cut into threads), so it's the same puzzle on
// every phone, and a game in progress is its level and strokes. Any way that fits counts.

/** Bump when a level or a stroke would come out differently; it restarts saved games. */
export const THREADS_VERSION = 1;

/** A level's board. Cells are numbered row by row, `y * size + x`. */
export interface Board {
  size: number;
  /** Each colour's two knots. */
  knots: [number, number][];
  /** One way to join them all (the threads it was cut from), for hints. */
  answer: number[][];
}

/** One stroke: a colour's whole thread after the finger lifted, from one of its knots. */
export interface Stroke {
  c: number;
  path: number[];
}

export interface ThreadsGame {
  level: number;
  board: Board;
  /** Each colour's thread now, from one of its knots ([] when not drawn). */
  paths: number[][];
  /** The strokes played, in order. */
  moves: Stroke[];
}

/** A level's square: 5×5 to start, up to 9×9. */
export function sizeFor(level: number) {
  const l = Math.max(1, level);
  return l <= 3 ? 5 : l <= 8 ? 6 : l <= 15 ? 7 : l <= 24 ? 8 : 9;
}

/** How many colours a level has: one fewer than its side, then as many, halfway through a size. */
export function coloursFor(level: number) {
  const l = Math.max(1, level);
  const size = sizeFor(l);
  const first = size === 5 ? 1 : size === 6 ? 4 : size === 7 ? 9 : size === 8 ? 16 : 25;
  const span = size === 5 ? 3 : size === 6 ? 5 : size === 7 ? 7 : size === 8 ? 9 : Infinity;
  return l - first >= span / 2 ? size : size - 1;
}

export function isNext(size: number, a: number, b: number) {
  const ax = a % size;
  const bx = b % size;
  return (Math.abs(a - b) === size && ax === bx) || (Math.abs(a - b) === 1 && Math.floor(a / size) === Math.floor(b / size));
}

function neighbours(size: number, cell: number): number[] {
  const x = cell % size;
  const y = (cell - x) / size;
  const out: number[] = [];
  if (y > 0) out.push(cell - size);
  if (x < size - 1) out.push(cell + 1);
  if (y < size - 1) out.push(cell + size);
  if (x > 0) out.push(cell - 1);
  return out;
}

/** A seeded path through every square: a snake, shuffled by backbite moves. */
function wanderingPath(size: number, random: () => number): number[] {
  let path: number[] = [];
  for (let y = 0; y < size; y++) for (let i = 0; i < size; i++) path.push(y * size + (y % 2 ? size - 1 - i : i));
  const at = new Array<number>(size * size);
  const index = () => path.forEach((c, i) => (at[c] = i));
  index();
  for (let n = 0; n < size * size * 20; n++) {
    // Join one end to a square beside it and break the path just before that square.
    if (random() < 0.5) {
      path.reverse();
      index();
    }
    const end = path[0];
    const options = neighbours(size, end).filter((c) => at[c] > 1);
    if (options.length === 0) continue;
    const i = at[options[Math.floor(random() * options.length)]];
    path = [...path.slice(0, i).reverse(), ...path.slice(i)];
    index();
  }
  return path;
}

/** Makes a level: one path through every square, cut into threads of 3 or more whose knots aren't side by side. */
export function makeLevel(level: number): Board {
  const size = sizeFor(level);
  const colours = coloursFor(level);
  const random = createRandom(hashSeed(`threads:${THREADS_VERSION}:level:${level}`));
  for (;;) {
    const path = wanderingPath(size, random);
    // Cut points: each thread at least 3 long, the rest shared out at random.
    const lengths = new Array<number>(colours).fill(3);
    for (let left = size * size - 3 * colours; left > 0; left--) lengths[Math.floor(random() * colours)]++;
    const answer: number[][] = [];
    let from = 0;
    for (const length of lengths) {
      answer.push(path.slice(from, from + length));
      from += length;
    }
    // A thread whose knots touch is no puzzle, and a straight one is barely one.
    const fair = answer.every((t) => !isNext(size, t[0], t[t.length - 1]) && !isStraight(t));
    if (fair) return { size, knots: answer.map((t) => [t[0], t[t.length - 1]]), answer };
  }
}

function isStraight(thread: number[]) {
  const step = thread[1] - thread[0];
  return thread.every((c, i) => i === 0 || c - thread[i - 1] === step);
}

/** The colour whose knot is on `cell`, or -1. */
export function knotAt(board: Board, cell: number) {
  return board.knots.findIndex(([a, b]) => a === cell || b === cell);
}

/** Whether a thread runs from one of its colour's knots to the other. */
export function isJoined(board: Board, c: number, path: readonly number[]) {
  const [a, b] = board.knots[c];
  return path.length >= 2 && ((path[0] === a && path[path.length - 1] === b) || (path[0] === b && path[path.length - 1] === a));
}

/** Each square's colour from the threads, or -1 when empty. */
export function fills(board: Board, paths: readonly (readonly number[])[]): number[] {
  const out = new Array<number>(board.size * board.size).fill(-1);
  board.knots.forEach(([a, b], c) => (out[a] = out[b] = c));
  paths.forEach((p, c) => p.forEach((cell) => (out[cell] = c)));
  return out;
}

/** Every colour joined and every square used. */
export function isSolved(game: ThreadsGame) {
  const { board, paths } = game;
  return paths.every((p, c) => isJoined(board, c, p)) && fills(board, paths).every((c) => c >= 0);
}

/** Whether a stroke is a thread its colour may have: from one of its knots, square by square, no square twice, no other knot, nothing after its partner. */
export function isValidStroke(board: Board, stroke: Stroke) {
  const { c, path } = stroke;
  if (!Number.isInteger(c) || c < 0 || c >= board.knots.length || !Array.isArray(path)) return false;
  if (path.length === 0) return true;
  const cells = board.size * board.size;
  const [a, b] = board.knots[c];
  if (path[0] !== a && path[0] !== b) return false;
  const partner = path[0] === a ? b : a;
  const seen = new Set<number>();
  for (let i = 0; i < path.length; i++) {
    const cell = path[i];
    if (!Number.isInteger(cell) || cell < 0 || cell >= cells || seen.has(cell)) return false;
    if (i > 0 && !isNext(board.size, path[i - 1], cell)) return false;
    const knot = knotAt(board, cell);
    if (knot >= 0 && knot !== c) return false;
    if (cell === partner && i !== path.length - 1) return false;
    seen.add(cell);
  }
  return true;
}

/** The threads after colour `c` becomes `path`: any other thread it crosses is cut back to just before the crossing. */
export function withThread(paths: readonly number[][], c: number, path: readonly number[]): number[][] {
  const taken = new Set(path);
  return paths.map((p, i) => {
    if (i === c) return path.slice();
    const cut = p.findIndex((cell) => taken.has(cell));
    return cut < 0 ? p : p.slice(0, cut);
  });
}

// The last level made, so a replay doesn't make it again.
let made: { level: number; board: Board } | null = null;

export function newGame(level: number): ThreadsGame {
  if (made?.level !== level) made = { level, board: makeLevel(level) };
  return { level, board: made.board, paths: made.board.knots.map(() => []), moves: [] };
}

/** Plays a stroke; returns the game unchanged once solved, or for a stroke that isn't allowed or changes nothing. */
export function play(game: ThreadsGame, stroke: Stroke): ThreadsGame {
  if (isSolved(game) || !isValidStroke(game.board, stroke)) return game;
  // A lone knot is no thread.
  const path = stroke.path.length === 1 ? [] : stroke.path.slice();
  const old = game.paths[stroke.c];
  if (old.length === path.length && old.every((cell, i) => cell === path[i])) return game;
  return { ...game, paths: withThread(game.paths, stroke.c, path), moves: [...game.moves, { c: stroke.c, path }] };
}

/** A level and its strokes, played from the start: how a saved game comes back. Strokes that don't apply are dropped. */
export function replay(level: number, moves: readonly Stroke[]): ThreadsGame {
  let game = newGame(level);
  for (const stroke of moves) game = play(game, stroke);
  return game;
}

/** Takes back the last stroke (by replaying the rest, since a stroke may have cut others). */
export function undo(game: ThreadsGame): ThreadsGame {
  if (game.moves.length === 0) return game;
  return replay(game.level, game.moves.slice(0, -1));
}

/** How many colours are joined. */
export function joinedCount(game: ThreadsGame) {
  return game.paths.filter((p, c) => isJoined(game.board, c, p)).length;
}

/**
 * A stroke that lays one more thread of the answer: the first colour whose thread isn't the
 * answer's, unjoined colours first. Answer threads never cross each other, so following hints
 * solves a level in at most one hint per colour. Null once solved.
 */
export function hint(game: ThreadsGame): Stroke | null {
  if (isSolved(game)) return null;
  const { board, paths } = game;
  const same = (c: number) => {
    const want = board.answer[c];
    const p = paths[c];
    return p.length === want.length && (p.every((cell, i) => cell === want[i]) || p.every((cell, i) => cell === want[want.length - 1 - i]));
  };
  const order = board.knots.map((_, c) => c);
  const c = order.find((c) => !isJoined(board, c, paths[c]) && !same(c)) ?? order.find((c) => !same(c));
  return c === undefined ? null : { c, path: board.answer[c].slice() };
}

// Drawing: the stroke under the finger, worked out here so the screen only passes squares.

/** The stroke a finger starts on `cell`: a knot starts its colour afresh, a square on a thread picks it up there. Null elsewhere. */
export function startStroke(game: ThreadsGame, cell: number): Stroke | null {
  const knot = knotAt(game.board, cell);
  if (knot >= 0) return { c: knot, path: [cell] };
  const c = game.paths.findIndex((p) => p.includes(cell));
  if (c < 0) return null;
  const p = game.paths[c];
  return { c, path: p.slice(0, p.indexOf(cell) + 1) };
}

/** The stroke after the finger moves onto `cell`: back over itself shortens it, on to a free square or across another thread grows it; another knot, a square not beside its end, or past its partner leaves it. */
export function stepStroke(board: Board, stroke: Stroke, cell: number): Stroke {
  const { c, path } = stroke;
  const end = path[path.length - 1];
  if (cell === end) return stroke;
  const back = path.indexOf(cell);
  if (back >= 0) return { c, path: path.slice(0, back + 1) };
  if (!isNext(board.size, end, cell) || isJoined(board, c, path)) return stroke;
  const knot = knotAt(board, cell);
  if (knot >= 0 && knot !== c) return stroke;
  return { c, path: [...path, cell] };
}

/** The squares from `from` towards `to`, one step at a time (across, then down), so a quick finger skips none. */
export function stepsBetween(size: number, from: number, to: number): number[] {
  const out: number[] = [];
  let x = from % size;
  let y = Math.floor(from / size);
  const tx = to % size;
  const ty = Math.floor(to / size);
  while (x !== tx || y !== ty) {
    if (x !== tx) x += x < tx ? 1 : -1;
    else y += y < ty ? 1 : -1;
    out.push(y * size + x);
  }
  return out;
}

/** The stroke after the finger reaches `cell`, however far it jumped: back onto the stroke shortens it, else it walks there square by square until something stops it. */
export function dragTo(board: Board, stroke: Stroke, cell: number): Stroke {
  if (stroke.path.includes(cell)) return stepStroke(board, stroke, cell);
  let s = stroke;
  for (const step of stepsBetween(board.size, s.path[s.path.length - 1], cell)) {
    if (s.path.includes(step)) break;
    const next = stepStroke(board, s, step);
    if (next === s) break;
    s = next;
  }
  return s;
}
