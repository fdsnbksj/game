import { createRandom, hashSeed } from '../../shared/random';

// Pig Lasso: two farmers face each other across a pen of pigs, each with a lasso swinging
// like a pendulum. A tap throws it along its swing; it brings back the first pig it touches,
// or comes back empty and costs points. Pink pigs amble, big sows are worth more but slow to
// reel in, black pigs dart about and are worth most. One minute; most points wins.
//
// The whole game is a function of the seed and the throws: a throw is only the tick it was
// made at, so every phone replays the same pen from the same throws, whatever order they
// arrive in (`simulate` sorts them). Pure TypeScript: no trig, no clock, no device randomness.

/** Bump when the same throws would play out differently: rooms on another version can't be joined. */
export const PIGS_VERSION = 1;

export const W = 360;
export const H = 560;
export const TICKS_PER_SECOND = 60;
/** One minute. */
export const GAME_TICKS = 60 * TICKS_PER_SECOND;
/** Throws more than this far behind the server's clock are refused by the rules (10 s). */
export const LATE_TICKS = 600;

/** Where each seat's lasso hangs from: seat 0 behind the bottom fence, seat 1 behind the top one. */
export const ANCHOR_Y = [H - 38, 38] as const;
export const ANCHOR_X = W / 2;
/** The pigs roam between the fences. */
export const PEN_TOP = 92;
export const PEN_BOTTOM = H - 92;

export type PigKind = 'pink' | 'sow' | 'black';

export const PIG_SPEC: Record<PigKind, { value: number; speed: number; radius: number; reel: number }> = {
  pink: { value: 100, speed: 0.75, radius: 17, reel: 5 },
  sow: { value: 200, speed: 0.45, radius: 25, reel: 2.6 },
  black: { value: 250, speed: 2.1, radius: 15, reel: 6.5 },
};
/** An empty lasso costs this. */
export const MISS_COST = 50;

const THROW_SPEED = 7;
const EMPTY_REEL = 9;
/** A lasso that reaches this far without a pig comes back empty. */
const REACH = H - 100;
const LOOP = 8;
/** The swing: ±70° either side of straight ahead, there and back in this many ticks. */
const SWING_TICKS = 150;
const SWING_MAX = 1.22;
/** How many pigs the pen holds at once. */
const PEN_SIZE = 7;

export interface Pig {
  id: number;
  kind: PigKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Ticks until a black pig changes its mind. */
  turn: number;
  /** The seat whose lasso holds it, or -1. */
  held: number;
}

export interface Lasso {
  mode: 'swing' | 'out' | 'back';
  /** The way it's flying (a unit vector), set when thrown. */
  dx: number;
  dy: number;
  len: number;
  /** The pig on the rope, by id. */
  pig: number | null;
}

export interface Catch {
  tick: number;
  seat: number;
  /** Points won (or lost, below zero). */
  points: number;
  kind: PigKind | null;
}

export interface PigState {
  seed: string;
  tick: number;
  pigs: Pig[];
  lassos: [Lasso, Lasso];
  scores: [number, number];
  catches: Catch[];
  nextPig: number;
  spawnIn: number;
}

export interface Throw {
  seat: number;
  tick: number;
}

const rand = (name: string) => createRandom(hashSeed(name));

// ---------- Angles without trig ----------

/** sin and cos by their series, plenty for |x| ≤ 1.3 and the same on every engine. */
function sinCos(x: number): [number, number] {
  const x2 = x * x;
  const sin = x * (1 - (x2 / 6) * (1 - (x2 / 20) * (1 - (x2 / 42) * (1 - x2 / 72))));
  const cos = 1 - (x2 / 2) * (1 - (x2 / 12) * (1 - (x2 / 30) * (1 - (x2 / 56) * (1 - x2 / 90))));
  return [sin, cos];
}

/** Where a seat's lasso points at a tick while swinging: a smooth pendulum, each seat on its own beat. */
export function swingAngle(seed: string, seat: number, tick: number): number {
  const offset = Math.floor(rand(`${seed}:swing:${seat}`)() * SWING_TICKS);
  const p = (((tick + offset) % SWING_TICKS) + SWING_TICKS) % SWING_TICKS / SWING_TICKS;
  const tri = p < 0.5 ? p * 4 - 1 : 3 - p * 4;
  // A cubic eases the ends, so it hangs at each side like a pendulum.
  return tri * (1.5 - 0.5 * tri * tri) * SWING_MAX;
}

/** The unit vector a seat's lasso points along at an angle: seat 0 throws up the screen, seat 1 down it. */
export function aim(seat: number, angle: number): [number, number] {
  const [s, c] = sinCos(angle);
  return seat === 0 ? [s, -c] : [-s, c];
}

/** Where the loop of a lasso is now. */
export function loopAt(state: PigState, seat: number): [number, number] {
  const lasso = state.lassos[seat];
  if (lasso.mode === 'swing') {
    const [dx, dy] = aim(seat, swingAngle(state.seed, seat, state.tick));
    return [ANCHOR_X + dx * 30, ANCHOR_Y[seat] + dy * 30];
  }
  return [ANCHOR_X + lasso.dx * lasso.len, ANCHOR_Y[seat] + lasso.dy * lasso.len];
}

// ---------- The pen ----------

function spawn(state: PigState) {
  const id = state.nextPig++;
  const r = rand(`${state.seed}:pig:${id}`);
  const roll = r();
  const kind: PigKind = roll < 0.55 ? 'pink' : roll < 0.72 ? 'sow' : 'black';
  const spec = PIG_SPEC[kind];
  const fromLeft = r() < 0.5;
  const y = PEN_TOP + spec.radius + r() * (PEN_BOTTOM - PEN_TOP - spec.radius * 2);
  const speed = spec.speed * (0.85 + r() * 0.3);
  state.pigs.push({
    id,
    kind,
    x: fromLeft ? -spec.radius : W + spec.radius,
    y,
    vx: fromLeft ? speed : -speed,
    vy: (r() - 0.5) * speed * 0.6,
    turn: kind === 'black' ? 30 + Math.floor(r() * 50) : 0,
    held: -1,
  });
  state.spawnIn = 20 + Math.floor(r() * 50);
}

function movePig(state: PigState, pig: Pig) {
  const spec = PIG_SPEC[pig.kind];
  if (pig.kind === 'black' && --pig.turn <= 0) {
    // A black pig dodges: a new heading, often doubling back.
    const r = rand(`${state.seed}:pig:${pig.id}:turn:${state.tick}`);
    const speed = spec.speed * (0.8 + r() * 0.5);
    const back = r() < 0.4;
    pig.vx = (pig.vx >= 0 !== back ? 1 : -1) * speed * (0.6 + r() * 0.4);
    pig.vy = (r() - 0.5) * speed * 1.4;
    pig.turn = 25 + Math.floor(r() * 55);
  }
  pig.x += pig.vx;
  pig.y += pig.vy;
  // Pigs stay between the fences.
  const top = PEN_TOP + spec.radius;
  const bottom = PEN_BOTTOM - spec.radius;
  if (pig.y < top) {
    pig.y = top;
    pig.vy = Math.abs(pig.vy);
  } else if (pig.y > bottom) {
    pig.y = bottom;
    pig.vy = -Math.abs(pig.vy);
  }
}

// ---------- Playing ----------

export function newGame(seed: string): PigState {
  const state: PigState = {
    seed,
    tick: 0,
    pigs: [],
    lassos: [swinging(), swinging()],
    scores: [0, 0],
    catches: [],
    nextPig: 0,
    spawnIn: 0,
  };
  // The pen starts with a few pigs already about.
  for (let i = 0; i < 4; i++) {
    spawn(state);
    const pig = state.pigs[i];
    const r = rand(`${seed}:start:${i}`);
    pig.x = 40 + r() * (W - 80);
  }
  state.spawnIn = 30;
  return state;
}

const swinging = (): Lasso => ({ mode: 'swing', dx: 0, dy: -1, len: 0, pig: null });

export const isOver = (state: PigState) => state.tick >= GAME_TICKS;

/** Throws a seat's lasso now, if it's swinging. */
function throwLasso(state: PigState, seat: number) {
  const lasso = state.lassos[seat];
  if (lasso.mode !== 'swing') return;
  const [dx, dy] = aim(seat, swingAngle(state.seed, seat, state.tick));
  state.lassos[seat] = { mode: 'out', dx, dy, len: 30, pig: null };
}

/** One tick: throws made at this tick, the pigs, then the lassos. */
export function step(state: PigState, throws: readonly Throw[] = []) {
  if (isOver(state)) return;
  for (const t of throws) if (t.tick === state.tick) throwLasso(state, t.seat);

  if (--state.spawnIn <= 0 && state.pigs.filter((p) => p.held < 0).length < PEN_SIZE) spawn(state);
  for (const pig of state.pigs) if (pig.held < 0) movePig(state, pig);
  // Pigs that have walked out of the pen are gone.
  state.pigs = state.pigs.filter((p) => p.held >= 0 || (p.x > -40 && p.x < W + 40));

  // Lassos fly out; a loop that meets a free pig takes it. If both loops meet the same pig
  // on the same tick, the nearer one has it (seat 0 on a dead heat).
  const hits: (Pig | null)[] = [null, null];
  const near: number[] = [Infinity, Infinity];
  for (const seat of [0, 1]) {
    const lasso = state.lassos[seat];
    if (lasso.mode !== 'out') continue;
    lasso.len += THROW_SPEED;
    const [lx, ly] = loopAt(state, seat);
    for (const pig of state.pigs) {
      if (pig.held >= 0) continue;
      const d = (pig.x - lx) ** 2 + (pig.y - ly) ** 2;
      const r = PIG_SPEC[pig.kind].radius + LOOP;
      if (d <= r * r && d < near[seat]) {
        near[seat] = d;
        hits[seat] = pig;
      }
    }
    if (!hits[seat] && (lasso.len >= REACH || lx < -10 || lx > W + 10)) lasso.mode = 'back';
  }
  if (hits[0] && hits[0] === hits[1]) hits[near[1] < near[0] ? 0 : 1] = null;
  for (const seat of [0, 1]) {
    const pig = hits[seat];
    if (!pig) continue;
    pig.held = seat;
    Object.assign(state.lassos[seat], { mode: 'back', pig: pig.id });
  }

  // Lassos coming back drag their pig with them.
  for (const seat of [0, 1]) {
    const lasso = state.lassos[seat];
    if (lasso.mode !== 'back') continue;
    const pig = lasso.pig === null ? null : state.pigs.find((p) => p.id === lasso.pig)!;
    lasso.len -= pig ? PIG_SPEC[pig.kind].reel : EMPTY_REEL;
    if (lasso.len > 24) {
      if (pig) [pig.x, pig.y] = loopAt(state, seat);
      continue;
    }
    const points = pig ? PIG_SPEC[pig.kind].value : -MISS_COST;
    state.scores[seat] += points;
    state.catches.push({ tick: state.tick, seat, points, kind: pig?.kind ?? null });
    if (pig) state.pigs = state.pigs.filter((p) => p !== pig);
    state.lassos[seat] = swinging();
  }
  state.tick++;
}

/** Throws in the order they happened (seat 0 first on the same tick), one per seat a tick. */
export function sortThrows(throws: readonly Throw[]): Throw[] {
  const seen = new Set<string>();
  return [...throws]
    .filter((t) => Number.isInteger(t.tick) && t.tick >= 0 && t.tick < GAME_TICKS && (t.seat === 0 || t.seat === 1))
    .sort((a, b) => a.tick - b.tick || a.seat - b.seat)
    .filter((t) => {
      const key = `${t.seat}:${t.tick}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Plays `state` on to `tick` with `throws` (sorted, from sortThrows). Only the throws from
 * `state.tick` on matter, so a phone can keep stepping one game as time passes.
 */
export function advance(state: PigState, throws: readonly Throw[], tick: number) {
  let i = 0;
  while (i < throws.length && throws[i].tick < state.tick) i++;
  const end = Math.min(tick, GAME_TICKS);
  while (state.tick < end) {
    const now: Throw[] = [];
    while (i < throws.length && throws[i].tick === state.tick) now.push(throws[i++]);
    step(state, now);
  }
}

/** The pen at `tick` from the seed and every throw, in any order. */
export function simulate(seed: string, throws: readonly Throw[], tick = GAME_TICKS): PigState {
  const state = newGame(seed);
  advance(state, sortThrows(throws), tick);
  return state;
}

/** Who won a finished game: the seat, or null on a draw. */
export function winner(state: PigState): number | null {
  const [a, b] = state.scores;
  return a === b ? null : a > b ? 0 : 1;
}
