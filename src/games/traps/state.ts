import { stream } from '../../nonogram/rng';
import { decodeLog, simulate, type Cause, type Status } from './sim';
import { buildWorld, canPlace, explode, ITEM_KINDS, ITEMS, TOWERS, type ItemKind, type Placed } from './world';

// Trap Tower: 2–4 players climb the same tower, and each round everyone adds one item to it.
// A round: a box of items opens (one more than there are players) and everyone picks one,
// first come first served; everyone places theirs; then everyone runs, on their own phone,
// from the start to the flag. A run is sent as its inputs and every phone replays it, so
// the result is the same everywhere. Reaching the flag scores, but only if someone else
// didn't: if everyone makes it, the tower was too easy and nobody scores. A trap that gets
// someone scores for whoever placed it. First to TARGET wins.
//
// A reducer like the other games: apply(state, move, seat) gives the next state, or null
// when the move isn't allowed, and replay() runs a room's moves from its seed, skipping
// refused ones. Players act at the same time, so a refused move is normal (two picked the
// same item; two placed on the same cell): that phone just picks or places again.

export const MIN_SEATS = 2;
export const MAX_SEATS = 4;
export const TARGET = 15;
export const MAX_ROUNDS = 20;
export const POINTS = { flag: 3, first: 1, trap: 1 } as const;

export type Phase = 'pick' | 'place' | 'run';

export interface Run {
  log: string;
  status: Exclude<Status, 'run'>;
  ticks: number;
  cause: Cause | null;
  killer: number | null;
}

/** A finished round, for the screens to show. */
export interface RoundResult {
  round: number;
  /** The tower as it was run. */
  items: Placed[];
  runs: Run[];
  /** Points each seat got this round. */
  points: number[];
  /** Everyone made it, nobody did, or some did and scored. */
  verdict: 'easy' | 'none' | 'scored';
}

export interface TrapsState {
  seed: string;
  seats: number;
  tower: number;
  /** Items in the tower, in the order they went in. */
  items: Placed[];
  round: number;
  phase: Phase;
  /** This round's box. */
  box: ItemKind[];
  /** Which box item each seat took, by index. */
  picks: (number | null)[];
  /** Whether each seat has placed (or set off) theirs. */
  placed: boolean[];
  runs: (Run | null)[];
  scores: number[];
  results: RoundResult[];
  /** The seats on top at the end; null while the game is on. */
  winners: number[] | null;
  count: number;
}

export type Move = { type: 'pick'; round: number; index: number } | { type: 'place'; round: number; x: number; y: number; rot: number } | { type: 'run'; round: number; log: string };

export interface Recorded {
  by: string;
  move: Move;
}

function drawBox(seed: string, round: number, size: number): ItemKind[] {
  const rng = stream(`${seed}:box:${round}`);
  const total = ITEM_KINDS.reduce((sum, k) => sum + ITEMS[k].weight, 0);
  const box: ItemKind[] = [];
  for (let i = 0; i < size; i++) {
    let roll = rng(total);
    const kind = ITEM_KINDS.find((k) => (roll -= ITEMS[k].weight) < 0)!;
    box.push(kind);
  }
  return box;
}

function newRound(s: TrapsState, round: number): TrapsState {
  return { ...s, round, phase: 'pick', box: drawBox(s.seed, round, s.seats + 1), picks: Array(s.seats).fill(null), placed: Array(s.seats).fill(false), runs: Array(s.seats).fill(null) };
}

export function start(seed: string, seats: number): TrapsState {
  const tower = stream(`${seed}:tower`)(TOWERS.length);
  return newRound({ seed, seats, tower, items: [], round: 0, phase: 'pick', box: [], picks: [], placed: [], runs: [], scores: Array(seats).fill(0), results: [], winners: null, count: 0 }, 0);
}

/** The item a seat took this round. */
export const pickedItem = (s: TrapsState, seat: number): ItemKind | null => (s.picks[seat] === null ? null : s.box[s.picks[seat]!]);

/** Points for a round's runs: see the top of this file. */
export function score(runs: readonly Run[]): { points: number[]; verdict: RoundResult['verdict'] } {
  const made = runs.filter((r) => r.status === 'flag');
  const points = runs.map(() => 0);
  if (made.length === 0) return { points, verdict: 'none' };
  if (made.length === runs.length) return { points, verdict: 'easy' };
  const best = Math.min(...made.map((r) => r.ticks));
  runs.forEach((r, i) => {
    if (r.status === 'flag') points[i] += POINTS.flag + (r.ticks === best ? POINTS.first : 0);
    if (r.status === 'dead' && r.killer !== null && r.killer !== i) points[r.killer] += POINTS.trap;
  });
  return { points, verdict: 'scored' };
}

export function apply(s: TrapsState, move: Move, seat: number): TrapsState | null {
  if (s.winners || seat < 0 || seat >= s.seats || !move || move.round !== s.round) return null;

  if (move.type === 'pick') {
    const { index } = move;
    if (s.phase !== 'pick' || s.picks[seat] !== null || !Number.isInteger(index) || index < 0 || index >= s.box.length || s.picks.includes(index)) return null;
    const picks = s.picks.map((p, i) => (i === seat ? index : p));
    return { ...s, picks, phase: picks.every((p) => p !== null) ? 'place' : 'pick', count: s.count + 1 };
  }

  if (move.type === 'place') {
    const item = pickedItem(s, seat);
    if (s.phase !== 'place' || s.placed[seat] || !item) return null;
    const p: Placed = { item, x: move.x, y: move.y, rot: ITEMS[item].turns ? move.rot : 0, by: seat };
    if (!canPlace(TOWERS[s.tower], s.items, p)) return null;
    const items = item === 'bomb' ? explode(s.items, p) : [...s.items, p];
    const placed = s.placed.map((d, i) => d || i === seat);
    return { ...s, items, placed, phase: placed.every(Boolean) ? 'run' : 'place', count: s.count + 1 };
  }

  if (move.type === 'run') {
    if (s.phase !== 'run' || s.runs[seat]) return null;
    const inputs = decodeLog(move.log);
    if (!inputs) return null;
    const end = simulate(buildWorld(TOWERS[s.tower], s.items), inputs);
    const run: Run = { log: move.log, status: end.status as Run['status'], ticks: end.tick, cause: end.cause, killer: end.killer };
    const runs = s.runs.map((r, i) => (i === seat ? run : r));
    const after = { ...s, runs, count: s.count + 1 };
    if (runs.some((r) => !r)) return after;
    return endRound(after, runs as Run[]);
  }

  return null;
}

function endRound(s: TrapsState, runs: Run[]): TrapsState {
  const { points, verdict } = score(runs);
  const scores = s.scores.map((v, i) => v + points[i]);
  const results = [...s.results, { round: s.round, items: s.items, runs, points, verdict }];
  const top = Math.max(...scores);
  const over = top >= TARGET || s.round + 1 >= MAX_ROUNDS;
  const after = { ...s, scores, results };
  if (over) return { ...after, winners: scores.flatMap((v, i) => (v === top ? [i] : [])) };
  return newRound(after, s.round + 1);
}

/** Seats still to act in this phase. */
export function waitingOn(s: TrapsState): number[] {
  if (s.winners) return [];
  const done = s.phase === 'pick' ? s.picks.map((p) => p !== null) : s.phase === 'place' ? s.placed : s.runs.map(Boolean);
  return done.flatMap((d, i) => (d ? [] : [i]));
}

export function replay(seed: string, seats: readonly string[], moves: readonly Recorded[]): TrapsState {
  let state = start(seed, seats.length);
  for (const m of moves) {
    const seat = seats.indexOf(m.by);
    if (seat >= 0) state = apply(state, m.move, seat) ?? state;
  }
  return state;
}
