import { createRandom, hashSeed } from '../../shared/random';

// Waterworks: a grid of pipe tiles, each turned the wrong way. Tap a tile to turn it a quarter
// clockwise; bring water from the spring to every tile, with no pipe left open. Pure and
// deterministic: a level is made from its number alone (a seeded tree of pipes, every tile then
// turned), so it's the same puzzle on every phone, and a game in progress is its level and taps.

/** Bump when a level or a tap would come out differently; it restarts saved games. */
export const PIPES_VERSION = 1;

/** A tile's open sides, one bit each. */
export const UP = 1;
export const RIGHT = 2;
export const DOWN = 4;
export const LEFT = 8;
const SIDES = [UP, RIGHT, DOWN, LEFT] as const;
const OPPOSITE: Record<number, number> = { [UP]: DOWN, [RIGHT]: LEFT, [DOWN]: UP, [LEFT]: RIGHT };

/** A level's board. Cells are numbered row by row, `y * size + x`. */
export interface Board {
  size: number;
  /** The cell the water starts from. */
  source: number;
  /** The pipes as laid: one way every tile fits. */
  answer: number[];
  /** The pipes as dealt, each turned away from the answer. */
  start: number[];
}

export interface PipesGame {
  level: number;
  board: Board;
  /** Quarter turns given to each tile so far. */
  turns: number[];
  /** The cells tapped, in order. */
  moves: number[];
}

/** A level's grid: 4×4 to start, up to 7×7. */
export function sizeFor(level: number) {
  const l = Math.max(1, level);
  return l <= 3 ? 4 : l <= 8 ? 5 : l <= 15 ? 6 : 7;
}

/** A tile turned a quarter clockwise, `times` times. */
export function rotate(mask: number, times = 1): number {
  let m = mask;
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 15;
  return m;
}

/** The cell next to `cell` on `side`, or -1 past the edge. */
export function neighbour(size: number, cell: number, side: number): number {
  const x = cell % size;
  const y = (cell - x) / size;
  if (side === UP) return y > 0 ? cell - size : -1;
  if (side === DOWN) return y < size - 1 ? cell + size : -1;
  if (side === LEFT) return x > 0 ? cell - 1 : -1;
  return x < size - 1 ? cell + 1 : -1;
}

/** Makes a level: a random tree of pipes grown from the middle, then every tile turned 1–3 quarters. */
export function makeLevel(level: number): Board {
  const size = sizeFor(level);
  const random = createRandom(hashSeed(`pipes:${PIPES_VERSION}:level:${level}`));
  const cells = size * size;
  const source = Math.floor(size / 2) * size + Math.floor((size - 1) / 2);
  const answer = new Array<number>(cells).fill(0);
  const inTree = new Array<boolean>(cells).fill(false);
  inTree[source] = true;
  // Grow the tree one random edge at a time from any cell already in it (Prim's, randomised).
  // A tile takes a fourth arm only when nothing else can grow, so crosses (which never need turning) are rare.
  let frontier: [number, number][] = SIDES.map((side) => [source, side] as [number, number]);
  for (let added = 1; added < cells; ) {
    frontier = frontier.filter(([cell, side]) => {
      const next = neighbour(size, cell, side);
      return next >= 0 && !inTree[next];
    });
    const roomy = frontier.filter(([cell]) => countArms(answer[cell]) < 3);
    const pick = roomy.length > 0 ? roomy : frontier;
    const [cell, side] = pick[Math.floor(random() * pick.length)];
    const next = neighbour(size, cell, side);
    answer[cell] |= side;
    answer[next] |= OPPOSITE[side];
    inTree[next] = true;
    added++;
    for (const s of SIDES) frontier.push([next, s]);
  }
  // Turn every tile 1–3 quarters. A dead end always ends up wrong, so it never starts solved.
  const start = answer.map((mask) => rotate(mask, 1 + Math.floor(random() * 3)));
  return { size, source, answer, start };
}

function countArms(mask: number) {
  return (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1) + ((mask >> 3) & 1);
}

/** Each tile's open sides now. */
export function masks(game: PipesGame): number[] {
  return game.board.start.map((mask, cell) => rotate(mask, game.turns[cell]));
}

/** The tiles water reaches from the spring, through pipes that meet. */
export function watered(board: Board, now: readonly number[]): boolean[] {
  const wet = new Array<boolean>(now.length).fill(false);
  wet[board.source] = true;
  const queue = [board.source];
  while (queue.length > 0) {
    const cell = queue.pop()!;
    for (const side of SIDES) {
      if (!(now[cell] & side)) continue;
      const next = neighbour(board.size, cell, side);
      if (next < 0 || wet[next] || !(now[next] & OPPOSITE[side])) continue;
      wet[next] = true;
      queue.push(next);
    }
  }
  return wet;
}

/** Tiles with a pipe that leads nowhere: off the edge, or into a tile not open back. */
export function leaks(board: Board, now: readonly number[]): boolean[] {
  return now.map((mask, cell) =>
    SIDES.some((side) => {
      if (!(mask & side)) return false;
      const next = neighbour(board.size, cell, side);
      return next < 0 || !(now[next] & OPPOSITE[side]);
    }),
  );
}

/** Water reaches every tile and no pipe is open. Checked against the pipes, not the answer, so any way that fits counts. */
export function isSolved(game: PipesGame) {
  const now = masks(game);
  return watered(game.board, now).every(Boolean) && !leaks(game.board, now).some(Boolean);
}

// The last level made, so a replay doesn't make it again.
let made: { level: number; board: Board } | null = null;

export function newGame(level: number): PipesGame {
  if (made?.level !== level) made = { level, board: makeLevel(level) };
  const cells = made.board.size * made.board.size;
  return { level, board: made.board, turns: new Array<number>(cells).fill(0), moves: [] };
}

/** Turns one tile a quarter clockwise; returns the game unchanged once solved, or for a cell that isn't there. */
export function play(game: PipesGame, cell: number): PipesGame {
  if (!Number.isInteger(cell) || cell < 0 || cell >= game.turns.length || isSolved(game)) return game;
  const turns = game.turns.slice();
  turns[cell]++;
  return { ...game, turns, moves: [...game.moves, cell] };
}

/** Takes back the last tap. */
export function undo(game: PipesGame): PipesGame {
  if (game.moves.length === 0) return game;
  const cell = game.moves[game.moves.length - 1];
  const turns = game.turns.slice();
  turns[cell]--;
  return { ...game, turns, moves: game.moves.slice(0, -1) };
}

/** A level and its taps, played from the start: how a saved game comes back. Taps that don't apply are dropped. */
export function replay(level: number, moves: readonly number[]): PipesGame {
  let game = newGame(level);
  for (const cell of moves) game = play(game, cell);
  return game;
}

/** The fewest taps from the dealt tiles to the answer. */
export function fewestTaps(board: Board): number {
  return board.start.reduce((sum, mask, cell) => sum + tapsTo(mask, board.answer[cell]), 0);
}

function tapsTo(from: number, to: number) {
  for (let k = 0; k < 4; k++) if (rotate(from, k) === to) return k;
  return 0;
}

/**
 * A tile that's wrong and how many taps put it right, next to the water if there is one (so
 * the hints grow the stream), or null once solved.
 */
export function hint(game: PipesGame): { cell: number; taps: number } | null {
  if (isSolved(game)) return null;
  const now = masks(game);
  const wet = watered(game.board, now);
  const wrong = now.map((mask, cell) => mask !== game.board.answer[cell]);
  const nearWater = (cell: number) => wet[cell] || SIDES.some((side) => wet[neighbour(game.board.size, cell, side)] === true);
  const cell = wrong.findIndex((w, c) => w && nearWater(c));
  const pick = cell >= 0 ? cell : wrong.indexOf(true);
  if (pick < 0) return null;
  return { cell: pick, taps: tapsTo(now[pick], game.board.answer[pick]) };
}
