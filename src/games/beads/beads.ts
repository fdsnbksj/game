import { createRandom, hashSeed } from '../../shared/random';

// Bead Sort: tubes of coloured beads, sorted by sliding the top beads from tube to tube.
// Pure and deterministic: a level is made from its number alone, so it's the same puzzle on
// every phone, and a game in progress is just its level and its moves, replayed.

/** Bump when a level or a move would come out differently; it restarts saved games. */
export const BEADS_VERSION = 1;

/** Beads a tube holds. */
export const CAPACITY = 4;
/** The most colours a level uses (and so the number of `--beads-N` colours). */
export const MAX_COLOURS = 9;
/** Empty tubes every level starts with. */
export const SPARE_TUBES = 2;

/** A tube's beads as colour numbers 0…, bottom first. */
export type Tube = number[];
/** Slide the top beads of `from` onto `to`. */
export interface Move {
  from: number;
  to: number;
}

export interface BeadsGame {
  level: number;
  tubes: Tube[];
  moves: Move[];
}

/** Colours on a level: three to start, one more every third level, up to nine. */
export function coloursFor(level: number) {
  return Math.min(MAX_COLOURS, 3 + Math.floor((Math.max(1, level) - 1) / 3));
}

/** The beads at the top of a tube that share its top colour. */
export function topRun(tube: Tube) {
  if (tube.length === 0) return 0;
  const colour = tube[tube.length - 1];
  let n = 1;
  while (n < tube.length && tube[tube.length - 1 - n] === colour) n++;
  return n;
}

/** A tube that's full of one colour: done, and nothing comes out of it. */
export function isComplete(tube: Tube) {
  return tube.length === CAPACITY && topRun(tube) === CAPACITY;
}

/** How many beads a move would slide (0 if it isn't allowed). */
export function pourCount(tubes: readonly Tube[], from: number, to: number) {
  if (from === to) return 0;
  const a = tubes[from];
  const b = tubes[to];
  if (!a || !b || a.length === 0 || isComplete(a)) return 0;
  const room = CAPACITY - b.length;
  if (room === 0) return 0;
  if (b.length > 0 && b[b.length - 1] !== a[a.length - 1]) return 0;
  return Math.min(room, topRun(a));
}

/** Every tube is empty or complete. */
export function isSolved(tubes: readonly Tube[]) {
  return tubes.every((tube) => tube.length === 0 || isComplete(tube));
}

/** Every allowed move, without pointless ones (a uniform tube into an empty one, or to a second empty tube). */
export function legalMoves(tubes: readonly Tube[]): Move[] {
  const moves: Move[] = [];
  const firstEmpty = tubes.findIndex((t) => t.length === 0);
  for (let from = 0; from < tubes.length; from++) {
    const a = tubes[from];
    if (a.length === 0 || isComplete(a)) continue;
    for (let to = 0; to < tubes.length; to++) {
      const b = tubes[to];
      if (b.length === 0 && (to !== firstEmpty || topRun(a) === a.length)) continue;
      if (pourCount(tubes, from, to) > 0) moves.push({ from, to });
    }
  }
  return moves;
}

function pour(tubes: readonly Tube[], from: number, to: number, n: number): Tube[] {
  const next = tubes.slice();
  next[from] = tubes[from].slice(0, tubes[from].length - n);
  next[to] = tubes[to].concat(tubes[from].slice(tubes[from].length - n));
  return next;
}

/** A position as text, tubes in any order, so the solver doesn't search the same one twice. */
function key(tubes: readonly Tube[]) {
  return tubes
    .map((t) => t.join(','))
    .sort()
    .join('|');
}

/** The solver's limit on positions tried: enough for any level, quick on a phone. */
export const SOLVE_LIMIT = 60_000;

/**
 * A way from here to sorted, by depth-first search over positions not seen before.
 * Returns the moves, or null if there is none (or none found within `limit` positions).
 */
export function solve(tubes: readonly Tube[], limit = SOLVE_LIMIT): Move[] | null {
  const seen = new Set<string>();
  const path: Move[] = [];
  let tried = 0;
  const search = (state: readonly Tube[]): boolean => {
    if (isSolved(state)) return true;
    const k = key(state);
    if (seen.has(k) || ++tried > limit) return false;
    seen.add(k);
    // Moves that finish or extend a tube first: it finds a way much sooner.
    const moves = legalMoves(state).sort((x, y) => score(state, y) - score(state, x));
    for (const move of moves) {
      path.push(move);
      if (search(pour(state, move.from, move.to, pourCount(state, move.from, move.to)))) return true;
      path.pop();
      if (tried > limit) return false;
    }
    return false;
  };
  return search(tubes) ? path : null;
}

function score(tubes: readonly Tube[], { from, to }: Move) {
  const target = tubes[to];
  const run = topRun(tubes[from]);
  let s = 0;
  if (target.length > 0) s += 10 + target.length; // onto its own colour
  if (run === tubes[from].length) s += 5; // empties a tube
  if (target.length > 0 && target.length + run === CAPACITY && topRun(target) === target.length) s += 20; // completes one
  return s;
}

/** The level's starting tubes: a seeded deal, dealt again until it isn't half done and the solver can finish it. */
export function makeLevel(level: number): Tube[] {
  const colours = coloursFor(level);
  for (let attempt = 0; ; attempt++) {
    const random = createRandom(hashSeed(`beads:${BEADS_VERSION}:level:${level}:try:${attempt}`));
    const beads: number[] = [];
    for (let c = 0; c < colours; c++) for (let i = 0; i < CAPACITY; i++) beads.push(c);
    for (let i = beads.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [beads[i], beads[j]] = [beads[j], beads[i]];
    }
    const tubes: Tube[] = [];
    for (let c = 0; c < colours; c++) tubes.push(beads.slice(c * CAPACITY, (c + 1) * CAPACITY));
    for (let s = 0; s < SPARE_TUBES; s++) tubes.push([]);
    // A tube that starts with three or more of one colour on top gives too much away.
    if (tubes.some((t) => t.length > 0 && topRun(t) >= CAPACITY - 1)) continue;
    if (solve(tubes)) return tubes;
  }
}

// The last level made, so an undo (which replays from the start) doesn't deal it again.
let made: { level: number; tubes: Tube[] } | null = null;

export function newGame(level: number): BeadsGame {
  if (made?.level !== level) made = { level, tubes: makeLevel(level) };
  return { level, tubes: made.tubes, moves: [] };
}

/** Plays a move; returns the game unchanged if it isn't allowed. */
export function play(game: BeadsGame, move: Move): BeadsGame {
  const n = pourCount(game.tubes, move.from, move.to);
  if (n === 0) return game;
  return { level: game.level, tubes: pour(game.tubes, move.from, move.to, n), moves: [...game.moves, { from: move.from, to: move.to }] };
}

/** Takes back the last move. */
export function undo(game: BeadsGame): BeadsGame {
  if (game.moves.length === 0) return game;
  return replay(game.level, game.moves.slice(0, -1));
}

/** A level and its moves, played from the start: how a saved game comes back. Moves that don't apply are dropped. */
export function replay(level: number, moves: readonly Move[]): BeadsGame {
  let game = newGame(level);
  for (const move of moves) game = play(game, move);
  return game;
}

/** No move left that changes anything: only undo or restart helps. */
export function isStuck(tubes: readonly Tube[]) {
  return !isSolved(tubes) && legalMoves(tubes).length === 0;
}

/** The next move towards sorted, or null when there's no way on from here (time to undo). */
export function hint(tubes: readonly Tube[]): Move | null {
  const path = solve(tubes);
  return path && path.length > 0 ? path[0] : null;
}
