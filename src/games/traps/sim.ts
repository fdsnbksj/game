import { groundAt, TILE, type Bow, type Ground, type Saw, type World } from './world';

// Trap Tower's runner: a stick figure climbing the tower, moved one tick (60 a second) at a
// time by one tick of input. Whole numbers only, no trig, nothing from the device, so a run
// is its inputs: every phone replays a player's log and gets the same climb, the same
// death and the same finish. step() mutates the runner so a screen can play it live.

/** Bump when a change would make runs play differently: phones on different versions can't share a room. */
export const TRAPS_VERSION = 1;

/** The longest a run lasts: 30 seconds. */
export const RUN_TICKS = 1800;

/** One tick of input, as bits. */
export const LEFT = 1;
export const RIGHT = 2;
export const JUMP = 4;

/** The runner's box, in world units (a cell is 256). */
export const BOX_W = 160;
export const BOX_H = 224;

const RUN_MAX = 40;
const RUN_ACCEL = 12;
const AIR_ACCEL = 8;
const FRICTION = 16;
const AIR_FRICTION = 4;
const ICE_MAX = 52;
const ICE_ACCEL = 3;
const ICE_FRICTION = 1;
const HONEY_MAX = 14;
const HONEY_ACCEL = 6;
const GRAVITY = 8;
const FALL_MAX = 96;
const JUMP_V = 120;
const HONEY_JUMP_V = 72;
/** Letting go of jump while rising cuts the climb short, for small hops. */
const JUMP_CUT = 40;
const SPRING_V = 170;
/** Ticks after leaving a ledge that a jump still works, and that an early press is kept. */
const COYOTE = 6;
const BUFFER = 6;

export const SAW_PERIOD = 150;
export const SAW_R = 80;
export const BOW_FIRST = 45;
export const BOW_EVERY = 90;
export const ARROW_SPEED = 48;
export const ARROW_LEN = 128;

export type Status = 'run' | 'flag' | 'dead' | 'time';
export type Cause = 'spikes' | 'saw' | 'arrow';

export interface Runner {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** What it stands on, or null in the air. */
  on: Ground | null;
  coyote: number;
  buffer: number;
  held: boolean;
  /** Rising from a jump (not a spring), so letting go cuts it short. */
  jumped: boolean;
  /** Which way it last ran: 1 right, -1 left. */
  face: number;
  tick: number;
  status: Status;
  cause: Cause | null;
  /** The seat whose item ended the run, if one did. */
  killer: number | null;
}

export function spawn(world: World): Runner {
  const { start } = world;
  return { x: start.x * TILE + (TILE - BOX_W) / 2, y: (start.y + 1) * TILE - BOX_H, vx: 0, vy: 0, on: null, coyote: 0, buffer: 0, held: false, jumped: false, face: 1, tick: 0, status: 'run', cause: null, killer: null };
}

const solid = (world: World, cx: number, cy: number) => groundAt(world, cx, cy) !== null;
const cell = (v: number) => Math.floor(v / TILE);

/** Where a saw's blade is at a tick: it swings to the end of its three-cell track and back. */
export function sawAt(saw: Saw, tick: number) {
  const half = SAW_PERIOD / 2;
  const phase = tick % SAW_PERIOD;
  const along = Math.trunc(((phase < half ? phase : SAW_PERIOD - phase) * 2 * TILE) / half);
  const x = saw.x * TILE + TILE / 2 + (saw.flat ? along : 0);
  const y = saw.y * TILE + TILE / 2 + (saw.flat ? 0 : along);
  return { x, y };
}

/** A crossbow's arrow in flight at a tick: its tip, or null between shots. */
export function arrowAt(bow: Bow, tick: number) {
  if (tick < BOW_FIRST) return null;
  const flown = ((tick - BOW_FIRST) % BOW_EVERY) * ARROW_SPEED;
  if (flown > bow.range) return null;
  const muzzle = TILE / 2 + flown;
  return { x: bow.x * TILE + TILE / 2 + bow.dx * muzzle, y: bow.y * TILE + TILE / 2 + bow.dy * muzzle };
}

const overlaps = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) => ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;

/** What hits the runner where it stands now, if anything. */
function hazard(world: World, r: Runner): { cause: Cause; owner: number } | null {
  for (const s of world.spikes) {
    if (overlaps(r.x, r.y, BOX_W, BOX_H, s.x * TILE + 32, s.y * TILE + 80, TILE - 64, TILE - 80)) return { cause: 'spikes', owner: s.owner };
  }
  for (const saw of world.saws) {
    const c = sawAt(saw, r.tick);
    const dx = c.x - Math.max(r.x, Math.min(c.x, r.x + BOX_W));
    const dy = c.y - Math.max(r.y, Math.min(c.y, r.y + BOX_H));
    if (dx * dx + dy * dy < SAW_R * SAW_R) return { cause: 'saw', owner: saw.owner };
  }
  for (const bow of world.bows) {
    const tip = arrowAt(bow, r.tick);
    if (!tip) continue;
    // The shaft trails behind the tip, 32 units thick.
    const x = bow.dx > 0 ? tip.x - ARROW_LEN : bow.dx < 0 ? tip.x : tip.x - 16;
    const y = bow.dy > 0 ? tip.y - ARROW_LEN : bow.dy < 0 ? tip.y : tip.y - 16;
    const w = bow.dx ? ARROW_LEN : 32;
    const h = bow.dy ? ARROW_LEN : 32;
    if (overlaps(r.x, r.y, BOX_W, BOX_H, x, y, w, h)) return { cause: 'arrow', owner: bow.owner };
  }
  return null;
}

const toward = (v: number, target: number, by: number) => (v < target ? Math.min(target, v + by) : Math.max(target, v - by));

/** One tick: run, jump, fall, bump into cells, then see what it touches. Does nothing once the run is over. */
export function step(world: World, r: Runner, input: number) {
  if (r.status !== 'run') return;
  const dir = (input & RIGHT ? 1 : 0) - (input & LEFT ? 1 : 0);
  const jump = (input & JUMP) !== 0;

  // Running: ice slides, honey drags.
  const max = r.on === 'ice' ? ICE_MAX : r.on === 'honey' ? HONEY_MAX : RUN_MAX;
  if (dir !== 0) {
    r.face = dir;
    const accel = r.on === 'ice' ? ICE_ACCEL : r.on === 'honey' ? HONEY_ACCEL : r.on ? RUN_ACCEL : AIR_ACCEL;
    r.vx = Math.abs(r.vx) > max && Math.sign(r.vx) === dir ? toward(r.vx, dir * max, accel) : Math.max(-max, Math.min(max, r.vx + dir * accel));
  } else {
    r.vx = toward(r.vx, 0, r.on === 'ice' ? ICE_FRICTION : r.on ? FRICTION : AIR_FRICTION);
  }

  // Jumping: a press is kept a few ticks, and works a few ticks after stepping off a ledge.
  r.coyote = r.on ? COYOTE : Math.max(0, r.coyote - 1);
  r.buffer = jump && !r.held ? BUFFER : Math.max(0, r.buffer - 1);
  r.held = jump;
  if (r.buffer > 0 && r.coyote > 0) {
    r.vy = -(r.on === 'honey' ? HONEY_JUMP_V : JUMP_V);
    r.buffer = 0;
    r.coyote = 0;
    r.jumped = true;
  }
  if (r.vy >= 0) r.jumped = false;
  if (r.jumped && !jump && r.vy < -JUMP_CUT) r.vy = -JUMP_CUT;
  r.vy = Math.min(FALL_MAX, r.vy + GRAVITY);

  // Across, then up or down, stopping at the first solid cell.
  if (r.vx !== 0) {
    const nx = r.x + r.vx;
    const edge = r.vx > 0 ? cell(nx + BOX_W - 1) : cell(nx);
    let blocked = false;
    for (let cy = cell(r.y); cy <= cell(r.y + BOX_H - 1); cy++) if (solid(world, edge, cy)) blocked = true;
    if (blocked) {
      r.x = r.vx > 0 ? edge * TILE - BOX_W : (edge + 1) * TILE;
      r.vx = 0;
    } else r.x = nx;
  }
  const falling = r.vy > 0;
  const ny = r.y + r.vy;
  const edge = falling ? cell(ny + BOX_H - 1) : cell(ny);
  let landed: Ground | null = null;
  for (let cx = cell(r.x); cx <= cell(r.x + BOX_W - 1); cx++) {
    const g = groundAt(world, cx, edge);
    // Standing across two cells, the one under the middle counts.
    if (g && (!landed || cx === cell(r.x + BOX_W / 2))) landed = g;
  }
  if (landed) {
    r.y = falling ? edge * TILE - BOX_H : (edge + 1) * TILE;
    r.vy = 0;
    r.on = falling ? landed : null;
  } else {
    r.y = ny;
    r.on = null;
  }
  if (r.on === 'spring') {
    r.vy = -SPRING_V;
    r.on = null;
  }

  r.tick++;
  const hit = hazard(world, r);
  if (hit) {
    r.status = 'dead';
    r.cause = hit.cause;
    r.killer = hit.owner;
  } else if (overlaps(r.x, r.y, BOX_W, BOX_H, world.flag.x * TILE + 48, world.flag.y * TILE + 32, TILE - 96, TILE - 32)) {
    r.status = 'flag';
  } else if (r.tick >= RUN_TICKS) {
    r.status = 'time';
  }
}

/** A run's inputs as a short string: each stretch of one input as its bits and its length in base 36, comma separated. */
export function encodeLog(inputs: readonly number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < inputs.length; ) {
    let j = i;
    while (j < inputs.length && inputs[j] === inputs[i]) j++;
    parts.push(`${inputs[i]}${(j - i).toString(36)}`);
    i = j;
  }
  return parts.join(',');
}

/** The inputs back from a log, or null if it isn't one (or runs past RUN_TICKS). */
export function decodeLog(log: string): number[] | null {
  if (typeof log !== 'string') return null;
  if (log === '') return [];
  const out: number[] = [];
  for (const part of log.split(',')) {
    if (!/^[0-7][0-9a-z]{1,3}$/.test(part)) return null;
    const n = parseInt(part.slice(1), 36);
    if (n < 1 || out.length + n > RUN_TICKS) return null;
    for (let k = 0; k < n; k++) out.push(Number(part[0]));
  }
  return out;
}

/** Plays a run out to its end: its inputs, then standing still if they stop early. */
export function simulate(world: World, inputs: readonly number[]): Runner {
  const r = spawn(world);
  while (r.status === 'run') step(world, r, inputs[r.tick] ?? 0);
  return r;
}

/** How far up the tower a runner got, 0 at the start to 1 at the flag: for the screens. */
export function height(world: World, r: Runner) {
  const from = (world.start.y + 1) * TILE;
  const to = world.flag.y * TILE;
  return Math.max(0, Math.min(1, (from - (r.y + BOX_H)) / (from - to)));
}
