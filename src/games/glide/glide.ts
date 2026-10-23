import { createRandom, hashSeed } from '../../shared/random';

// Glide: blocks on an icy floor. Swipe a block and it slides until something stops it (a wall,
// the edge, another block). Bring every block to rest on the pad of its colour within the
// level's moves. Pure and deterministic: a level is made from its number alone, so it's the
// same puzzle on every phone, and a game in progress is just its level and its moves, replayed.

/** Bump when a level or a move would come out differently; it restarts saved games. */
export const GLIDE_VERSION = 1;

/** The most blocks a level uses (and so the number of `--glide-N` colours). */
export const MAX_BLOCKS = 3;

export type Dir = 'up' | 'right' | 'down' | 'left';
export const DIRS: readonly Dir[] = ['up', 'right', 'down', 'left'];
const STEP: Record<Dir, readonly [number, number]> = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };

/** A level's board. Cells are numbered row by row, `y * size + x`. */
export interface Board {
  size: number;
  /** One per cell: a wall nothing slides into. */
  walls: boolean[];
  /** Where each block starts. */
  starts: number[];
  /** Where each block must end: block `i` belongs on `pads[i]`. */
  pads: number[];
  /** The moves allowed, exactly the fewest it can be done in. */
  par: number;
}

/** Slide block `block` towards `dir`. */
export interface Move {
  block: number;
  dir: Dir;
}

export interface GlideGame {
  level: number;
  board: Board;
  /** Each block's cell now. */
  blocks: number[];
  moves: Move[];
}

/** A level's size, blocks and moves: one block on 5×5 to start, three on 7×7 later, and longer puzzles as it goes. */
export function settingsFor(level: number) {
  const l = Math.max(1, level);
  return {
    size: l <= 4 ? 5 : l <= 14 ? 6 : 7,
    blocks: l <= 3 ? 1 : l <= 12 ? 2 : 3,
    par: Math.min(12, 2 + Math.ceil(l / 2)),
  };
}

/** Where block `block` would come to rest sliding towards `dir` (its own cell if it can't move). */
export function slide(board: Board, blocks: readonly number[], block: number, dir: Dir): number {
  const { size, walls } = board;
  const [dx, dy] = STEP[dir];
  let x = blocks[block] % size;
  let y = (blocks[block] - x) / size;
  for (;;) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= size || ny >= size) break;
    const cell = ny * size + nx;
    if (walls[cell] || blocks.includes(cell)) break;
    x = nx;
    y = ny;
  }
  return y * size + x;
}

function moved(blocks: readonly number[], block: number, to: number) {
  const next = blocks.slice();
  next[block] = to;
  return next;
}

/** Every block on its own pad. */
export function isSolved(board: Board, blocks: readonly number[]) {
  return blocks.every((cell, i) => cell === board.pads[i]);
}

/** A position as one number (cells are below 64), so the search doesn't visit one twice. */
function key(blocks: readonly number[]) {
  let k = 0;
  for (let i = blocks.length - 1; i >= 0; i--) k = k * 64 + blocks[i];
  return k;
}

/**
 * Breadth-first over positions from `start`, up to `maxDepth` moves, stopping early at the
 * first one `goal` accepts. Returns each depth's positions and how each was first reached.
 */
function explore(board: Board, start: readonly number[], maxDepth: number, goal?: (blocks: readonly number[]) => boolean) {
  const parents = new Map<number, { from: number; move: Move } | null>([[key(start), null]]);
  const layers: number[][][] = [[start.slice()]];
  if (goal?.(start)) return { layers, parents, found: start.slice() };
  for (let depth = 0; depth < maxDepth; depth++) {
    const next: number[][] = [];
    for (const blocks of layers[depth]) {
      const from = key(blocks);
      for (let block = 0; block < blocks.length; block++) {
        for (const dir of DIRS) {
          const to = slide(board, blocks, block, dir);
          if (to === blocks[block]) continue;
          const after = moved(blocks, block, to);
          const k = key(after);
          if (parents.has(k)) continue;
          parents.set(k, { from, move: { block, dir } });
          next.push(after);
          if (goal?.(after)) return { layers: [...layers, next], parents, found: after };
        }
      }
    }
    if (next.length === 0) break;
    layers.push(next);
  }
  return { layers, parents, found: null };
}

/** The fewest moves from `blocks` to every block on its pad, if it takes at most `maxMoves`; else null. */
export function solve(board: Board, blocks: readonly number[], maxMoves: number): Move[] | null {
  const { parents, found } = explore(board, blocks, maxMoves, (b) => isSolved(board, b));
  if (!found) return null;
  const path: Move[] = [];
  for (let step = parents.get(key(found)); step; step = parents.get(step.from)) path.unshift(step.move);
  return path;
}

/**
 * The level's board: seeded walls and starts, then the pads go where the blocks can be, at
 * exactly the level's number of moves and no fewer, so the move limit is always enough and
 * never slack. Tried again, with a fresh seed, until such a place exists and every block has
 * to move; after many tries it takes the longest puzzle it found, so it always ends.
 */
export function makeLevel(level: number): Board {
  const { size, blocks: count, par } = settingsFor(level);
  let fallback: Board | null = null;
  for (let attempt = 0; ; attempt++) {
    const random = createRandom(hashSeed(`glide:${GLIDE_VERSION}:level:${level}:try:${attempt}`));
    const walls = Array.from({ length: size * size }, () => random() < 0.18);
    const open = walls.flatMap((wall, cell) => (wall ? [] : [cell]));
    if (open.length < count + 4) continue;
    const starts: number[] = [];
    while (starts.length < count) {
      const cell = open[Math.floor(random() * open.length)];
      if (!starts.includes(cell)) starts.push(cell);
    }
    const board: Board = { size, walls, starts, pads: starts, par: 0 };
    const { layers } = explore(board, starts, par);
    for (let depth = layers.length - 1; depth >= 1; depth--) {
      const ends = layers[depth].filter((b) => b.every((cell, i) => cell !== starts[i]));
      if (ends.length === 0) continue;
      const pads = ends[Math.floor(random() * ends.length)];
      if (depth === par) return { size, walls, starts, pads, par };
      if (!fallback || depth > fallback.par) fallback = { size, walls, starts, pads, par: depth };
      break;
    }
    if (attempt >= 60 && fallback) return fallback;
  }
}

// The last level made, so an undo (which replays from the start) doesn't make it again.
let made: { level: number; board: Board } | null = null;

export function newGame(level: number): GlideGame {
  if (made?.level !== level) made = { level, board: makeLevel(level) };
  return { level, board: made.board, blocks: made.board.starts.slice(), moves: [] };
}

/** Moves still allowed. */
export function movesLeft(game: GlideGame) {
  return game.board.par - game.moves.length;
}

/** All moves used without every block home: only undo or restart helps. */
export function isOut(game: GlideGame) {
  return movesLeft(game) <= 0 && !isSolved(game.board, game.blocks);
}

/** Plays a move; returns the game unchanged if it isn't allowed (solved, no moves left, or the block can't move that way). */
export function play(game: GlideGame, move: Move): GlideGame {
  if (isSolved(game.board, game.blocks) || movesLeft(game) <= 0) return game;
  if (move.block < 0 || move.block >= game.blocks.length || !DIRS.includes(move.dir)) return game;
  const to = slide(game.board, game.blocks, move.block, move.dir);
  if (to === game.blocks[move.block]) return game;
  return { ...game, blocks: moved(game.blocks, move.block, to), moves: [...game.moves, { block: move.block, dir: move.dir }] };
}

/** Takes back the last move. */
export function undo(game: GlideGame): GlideGame {
  if (game.moves.length === 0) return game;
  return replay(game.level, game.moves.slice(0, -1));
}

/** A level and its moves, played from the start: how a saved game comes back. Moves that don't apply are dropped. */
export function replay(level: number, moves: readonly Move[]): GlideGame {
  let game = newGame(level);
  for (const move of moves) game = play(game, move);
  return game;
}

/** The next move towards every block home within the moves left, or null when there's no way (time to undo). */
export function hint(game: GlideGame): Move | null {
  const path = solve(game.board, game.blocks, movesLeft(game));
  return path && path.length > 0 ? path[0] : null;
}
