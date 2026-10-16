import { createRandom, hashSeed } from '../../shared/random';

// Sky Ace, a 90s-style vertical shooter, as plain data and one step function. step() moves
// the world one tick (60 a second) for one tick of input, mutating the state in place so a
// phone can run it with hundreds of bullets. The state is plain JSON, so it saves and
// resumes anywhere. Every random choice is a named hash of the run's seed, so a run with
// the same inputs plays out the same on every device (and can be replayed to check a score).

/** Bump when a change would make saved runs play differently. */
export const SKY_VERSION = 1;

/** The playfield, in world units; the screen scales it to fit. */
export const W = 360;
export const H = 640;
export const STAGES = 3;
/** Ticks of waves before each stage's boss. */
export const STAGE_TICKS = 7800;
export const MAX_POWER = 4;
export const MAX_MISSILES = 3;
const START_LIVES = 3;
const START_BOMBS = 3;
const BOMB_TICKS = 90;
const INVULN_TICKS = 150;
const RESPAWN_TICKS = 70;
const CLEAR_TICKS = 240;
const QUICK_TICKS = 45;
const GROUND_SPEED = 1;

export type Weapon = 'vulcan' | 'laser';
export type ItemKind = 'red' | 'blue' | 'missile' | 'bomb' | 'medal';
export type EnemyKind = 'dart' | 'swoop' | 'tank' | 'turret' | 'gunship' | 'carrier' | 'core' | 'gun';
export type Phase = 'play' | 'warning' | 'boss' | 'clear' | 'over';

export interface Player {
  x: number;
  y: number;
  /** Ticks until the ship comes back after being hit; 0 while flying. */
  down: number;
  invuln: number;
  weapon: Weapon;
  power: number;
  missiles: number;
  lives: number;
  bombs: number;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  kind: 'vulcan' | 'laser' | 'missile';
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  age: number;
  ground: boolean;
  points: number;
  /** Ticks to its next shot. */
  fire: number;
  /** Ticks since it came fully on screen; -1 until then. */
  seen: number;
  /** A boss part rides on its core at this offset. */
  anchor?: number;
  ox?: number;
  oy?: number;
  /** Ticks the hit flash still shows. */
  flash: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export interface Item {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: ItemKind;
  age: number;
}

export interface Blast {
  x: number;
  y: number;
  size: number;
  age: number;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  age: number;
}

export interface SkyState {
  version: number;
  seed: string;
  /** Laps of all the stages; each lap is harder. */
  loop: number;
  stage: number;
  phase: Phase;
  /** Ticks into this stage. */
  tick: number;
  /** Ticks into this phase. */
  phaseTick: number;
  /** Ticks since the run began, for the scrolling ground. */
  clock: number;
  waveIndex: number;
  player: Player;
  shots: Shot[];
  enemies: Enemy[];
  bullets: Bullet[];
  items: Item[];
  blasts: Blast[];
  popups: Popup[];
  /** Ticks of the bomb still going. */
  bomb: number;
  score: number;
  /** What the next medal is worth; missing one resets it. */
  medal: number;
  continues: number;
  nextId: number;
}

/** One tick of input: how far the finger moved (in world units) and whether a bomb was asked for. */
export interface Input {
  dx: number;
  dy: number;
  bomb: boolean;
}

export const NO_INPUT: Input = { dx: 0, dy: 0, bomb: false };

export function newRun(seed: string): SkyState {
  return {
    version: SKY_VERSION,
    seed,
    loop: 0,
    stage: 0,
    phase: 'play',
    tick: 0,
    phaseTick: 0,
    clock: 0,
    waveIndex: 0,
    player: freshPlayer(),
    shots: [],
    enemies: [],
    bullets: [],
    items: [],
    blasts: [],
    popups: [],
    bomb: 0,
    score: 0,
    medal: 100,
    continues: 0,
    nextId: 1,
  };
}

function freshPlayer(): Player {
  return { x: W / 2, y: H - 90, down: 0, invuln: INVULN_TICKS, weapon: 'vulcan', power: 1, missiles: 0, lives: START_LIVES, bombs: START_BOMBS };
}

/** Out of lives: carry on where you are, for half the score. */
export function continueRun(s: SkyState) {
  if (s.phase !== 'over') return;
  s.score = Math.floor(s.score / 20) * 10 + Math.min(9, s.continues + 1);
  s.continues++;
  const p = s.player;
  p.lives = START_LIVES;
  p.bombs = START_BOMBS;
  p.down = 0;
  p.invuln = INVULN_TICKS;
  p.x = W / 2;
  p.y = H - 90;
  s.bullets.length = 0;
  // Back to where it stopped; a warning starts again, so the boss comes once.
  s.phase = s.enemies.some((e) => e.kind === 'core') ? 'boss' : s.tick >= STAGE_TICKS ? 'warning' : 'play';
  s.phaseTick = 0;
}

// ---------- Deterministic helpers ----------

/** An integer in [0, n) from the run's seed and a name: the same everywhere. */
function roll(seed: string, name: string, n: number): number {
  return Math.floor(createRandom(hashSeed(`${seed}:${name}`))() * n);
}

/** 64 compass directions, made by turning a unit vector (trig is banned here for determinism). */
const DIRS: readonly (readonly [number, number])[] = (() => {
  const C = 0.9951847266721969; // cos(2π/64)
  const S = 0.0980171403295606; // sin(2π/64)
  const out: [number, number][] = [];
  let x = 1;
  let y = 0;
  for (let i = 0; i < 64; i++) {
    out.push([x, y]);
    [x, y] = [x * C - y * S, x * S + y * C];
  }
  return out;
})();

/** Direction i of 64: 0 is right, 16 is down (the screen's y grows downward). */
export function dir(i: number): readonly [number, number] {
  return DIRS[((Math.round(i) % 64) + 64) % 64];
}

/** A triangle wave from -1 to 1 with the given period, for swaying without trig. */
function sway(t: number, period: number): number {
  const p = (((t % period) + period) % period) / period;
  return p < 0.5 ? p * 4 - 1 : 3 - p * 4;
}

function toward(fromX: number, fromY: number, toX: number, toY: number, speed: number): [number, number] {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return [0, speed];
  return [(dx / len) * speed, (dy / len) * speed];
}

// ---------- Waves ----------

type WaveKind = 'line' | 'vee' | 'swoopL' | 'swoopR' | 'tanks' | 'turrets' | 'carrier' | 'gunship';

export interface Wave {
  at: number;
  kind: WaveKind;
  x: number;
}

const waveCache = new Map<string, Wave[]>();

/** A stage's waves, from the seed: the same list every time it's asked for. */
export function wavesFor(seed: string, loop: number, stage: number): Wave[] {
  const key = `${seed}:${loop}:${stage}`;
  const cached = waveCache.get(key);
  if (cached) return cached;
  const rng = createRandom(hashSeed(`${key}:waves`));
  const pick = (n: number) => Math.floor(rng() * n);
  const waves: Wave[] = [];
  // Each stage leans on different enemies: a city (tanks), the sea (planes), a base (turrets).
  const mixes: WaveKind[][] = [
    ['line', 'vee', 'tanks', 'tanks', 'swoopL', 'swoopR', 'carrier'],
    ['line', 'vee', 'vee', 'swoopL', 'swoopR', 'swoopL', 'swoopR', 'carrier'],
    ['line', 'turrets', 'turrets', 'tanks', 'swoopL', 'swoopR', 'vee', 'carrier'],
  ];
  const mix = mixes[stage % mixes.length];
  const gap = Math.max(45, 80 - loop * 12 - stage * 6);
  let at = 120;
  let sinceGunship = 0;
  while (at < STAGE_TICKS - 300) {
    let kind: WaveKind = mix[pick(mix.length)];
    if (sinceGunship > 1300 && at > 900) {
      kind = 'gunship';
      sinceGunship = 0;
    }
    waves.push({ at, kind, x: 50 + pick(W - 100) });
    const step = gap + pick(gap);
    at += kind === 'gunship' ? step + 180 : step;
    sinceGunship += step;
  }
  waveCache.set(key, waves);
  return waves;
}

// ---------- Spawning ----------

interface Spec {
  kind: EnemyKind;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fire?: number;
}

const BODY: Record<EnemyKind, { r: number; hp: number; points: number; ground: boolean }> = {
  dart: { r: 12, hp: 2, points: 100, ground: false },
  swoop: { r: 12, hp: 3, points: 150, ground: false },
  tank: { r: 14, hp: 6, points: 300, ground: true },
  turret: { r: 16, hp: 12, points: 500, ground: true },
  gunship: { r: 30, hp: 55, points: 3000, ground: false },
  carrier: { r: 18, hp: 10, points: 800, ground: false },
  core: { r: 44, hp: 340, points: 30000, ground: false },
  gun: { r: 18, hp: 70, points: 5000, ground: false },
};

function spawn(s: SkyState, spec: Spec): Enemy {
  const body = BODY[spec.kind];
  const tough = 1 + s.loop * 0.4;
  const hp = Math.round(body.hp * (spec.kind === 'core' || spec.kind === 'gun' ? tough * (1 + s.stage * 0.2) : tough));
  const e: Enemy = {
    id: s.nextId++,
    kind: spec.kind,
    x: spec.x,
    y: spec.y,
    vx: spec.vx ?? 0,
    vy: spec.vy ?? 0,
    r: body.r,
    hp,
    maxHp: hp,
    age: 0,
    ground: body.ground,
    points: body.points,
    fire: spec.fire ?? 60,
    seen: -1,
    flash: 0,
  };
  s.enemies.push(e);
  return e;
}

function spawnWave(s: SkyState, wave: Wave, index: number) {
  const r = (name: string, n: number) => roll(s.seed, `${s.loop}:${s.stage}:${index}:${name}`, n);
  const speed = 2.6 + s.loop * 0.3;
  switch (wave.kind) {
    case 'line':
      for (let i = 0; i < 5; i++) spawn(s, { kind: 'dart', x: wave.x, y: -20 - i * 34, vy: speed, fire: 40 + r(`f${i}`, 80) });
      break;
    case 'vee':
      for (let i = 0; i < 5; i++) {
        const off = i - 2;
        const x = Math.min(W - 30, Math.max(30, wave.x + off * 30));
        spawn(s, { kind: 'dart', x, y: -20 - Math.abs(off) * 26, vy: speed, fire: 50 + r(`f${i}`, 70) });
      }
      break;
    case 'swoopL':
    case 'swoopR': {
      const left = wave.kind === 'swoopL';
      for (let i = 0; i < 4; i++)
        spawn(s, { kind: 'swoop', x: left ? -20 - i * 30 : W + 20 + i * 30, y: 60 + i * 18, vx: left ? 4.2 : -4.2, vy: 1.6, fire: 30 + r(`f${i}`, 60) });
      break;
    }
    case 'tanks': {
      const n = 2 + r('n', 2);
      for (let i = 0; i < n; i++) spawn(s, { kind: 'tank', x: wave.x, y: -20 - i * 40, vx: 0, vy: GROUND_SPEED + 0.4, fire: 60 + r(`f${i}`, 60) });
      break;
    }
    case 'turrets':
      spawn(s, { kind: 'turret', x: Math.max(40, wave.x - 60), y: -24, vy: GROUND_SPEED, fire: 60 });
      spawn(s, { kind: 'turret', x: Math.min(W - 40, wave.x + 60), y: -24, vy: GROUND_SPEED, fire: 90 });
      break;
    case 'carrier':
      spawn(s, { kind: 'carrier', x: wave.x, y: -24, vy: 1.3, fire: 999999 });
      break;
    case 'gunship':
      spawn(s, { kind: 'gunship', x: W / 2 + (r('x', 120) - 60), y: -40, vy: 1.6, fire: 90 });
      break;
  }
}

function spawnBoss(s: SkyState) {
  const core = spawn(s, { kind: 'core', x: W / 2, y: -80, vy: 1.2, fire: 120 });
  const guns = s.stage === 0 ? [[-74, 10], [74, 10]] : s.stage === 1 ? [[-80, -10], [80, -10], [0, 52]] : [[-90, 0], [90, 0], [-46, 46], [46, 46]];
  guns.forEach(([ox, oy], i) => {
    const gun = spawn(s, { kind: 'gun', x: core.x + ox, y: core.y + oy, fire: 60 + i * 20 });
    gun.anchor = core.id;
    gun.ox = ox;
    gun.oy = oy;
  });
}

// ---------- Firing ----------

function bulletSpeed(s: SkyState) {
  return 2.5 + s.loop * 0.5 + s.stage * 0.15;
}

function fireAimed(s: SkyState, e: Enemy, count: number, spread: number, speed = bulletSpeed(s)) {
  const p = s.player;
  if (p.down > 0) return;
  const [ax, ay] = toward(e.x, e.y, p.x, p.y, 1);
  // The aim's index among the 64 directions, by checking which is closest (no atan2 here).
  let best = 16;
  let bestDot = -2;
  for (let i = 0; i < 64; i++) {
    const [dx, dy] = DIRS[i];
    const dot = dx * ax + dy * ay;
    if (dot > bestDot) {
      bestDot = dot;
      best = i;
    }
  }
  for (let k = 0; k < count; k++) {
    const [dx, dy] = dir(best + (k - (count - 1) / 2) * spread);
    s.bullets.push({ x: e.x, y: e.y, vx: dx * speed, vy: dy * speed, r: 4 });
  }
}

function fireRing(s: SkyState, e: Enemy, count: number, offset: number, speed = bulletSpeed(s) * 0.85) {
  for (let k = 0; k < count; k++) {
    const [dx, dy] = dir(offset + (k * 64) / count);
    s.bullets.push({ x: e.x, y: e.y, vx: dx * speed, vy: dy * speed, r: 5 });
  }
}

function enemyThink(s: SkyState, e: Enemy) {
  const fireRate = 1 + s.loop * 0.35;
  const onScreen = e.y > 10 && e.y < H - 120;
  switch (e.kind) {
    case 'dart':
      if (--e.fire <= 0 && onScreen) {
        fireAimed(s, e, 1, 0);
        e.fire = Math.round(160 / fireRate);
      }
      break;
    case 'swoop':
      // Curve back the way it came.
      e.vx -= Math.sign(e.vx) * 0.045;
      e.vy += 0.02;
      if (--e.fire <= 0 && onScreen) {
        fireAimed(s, e, 1, 0);
        e.fire = Math.round(200 / fireRate);
      }
      break;
    case 'tank':
    case 'turret':
      if (--e.fire <= 0 && onScreen) {
        fireAimed(s, e, e.kind === 'turret' ? 3 : 1, 3);
        e.fire = Math.round((e.kind === 'turret' ? 110 : 120) / fireRate);
      }
      break;
    case 'carrier':
      break;
    case 'gunship':
      if (e.age < 70) e.vy = 1.6;
      else if (e.age < 420) e.vy = 0;
      else e.vy = -1.2;
      e.vx = sway(e.age, 360) * 0.6;
      if (e.age >= 70 && e.age < 420 && --e.fire <= 0) {
        fireAimed(s, e, 5, 3);
        e.fire = Math.round(75 / fireRate);
      }
      break;
    case 'core': {
      if (e.y < 150) e.vy = 1.2;
      else {
        e.vy = 0;
        e.vx = sway(e.age, 480) * 0.9;
      }
      if (e.y < 120) break;
      const guarded = s.enemies.some((g) => g.anchor === e.id);
      if (--e.fire <= 0) {
        if (s.stage === 0) {
          fireRing(s, e, guarded ? 12 : 18, e.age / 7);
          e.fire = Math.round((guarded ? 110 : 70) / fireRate);
        } else if (s.stage === 1) {
          // A turning spray: short bursts that walk round.
          fireRing(s, e, 3, e.age / 3);
          e.fire = Math.round((guarded ? 14 : 8) / fireRate);
        } else {
          fireRing(s, e, guarded ? 14 : 20, e.age / 5);
          if (!guarded) fireAimed(s, e, 5, 2);
          e.fire = Math.round((guarded ? 100 : 65) / fireRate);
        }
      }
      break;
    }
    case 'gun':
      if (e.y > 60 && --e.fire <= 0) {
        fireAimed(s, e, s.stage === 2 ? 2 : 3, 4);
        e.fire = Math.round(85 / fireRate);
      }
      break;
  }
}

function playerFire(s: SkyState) {
  const p = s.player;
  const t = s.clock;
  if (p.weapon === 'vulcan') {
    if (t % 5 === 0) {
      const n = 1 + p.power * 2;
      const spread = 0.6 + p.power * 0.15;
      for (let k = 0; k < n; k++) {
        const [dx, dy] = dir(48 + (k - (n - 1) / 2) * spread);
        s.shots.push({ x: p.x, y: p.y - 14, vx: dx * 13, vy: dy * 13, r: 4, dmg: 1, kind: 'vulcan' });
      }
    }
  } else if (t % 3 === 0) {
    s.shots.push({ x: p.x, y: p.y - 18, vx: 0, vy: -20, r: 3 + p.power * 2.5, dmg: 0.45 + p.power * 0.25, kind: 'laser' });
  }
  if (p.missiles > 0 && t % 24 === 0) {
    for (let k = 0; k < p.missiles; k++) {
      const side = k % 2 === 0 ? -1 : 1;
      s.shots.push({ x: p.x + side * (12 + k * 4), y: p.y, vx: side * 2, vy: -5, r: 4, dmg: 2.5, kind: 'missile' });
    }
  }
}

function steerMissile(s: SkyState, m: Shot) {
  let target: Enemy | null = null;
  let bestD = Infinity;
  for (const e of s.enemies) {
    if (e.y < -10 || e.y > H) continue;
    const d = (e.x - m.x) ** 2 + (e.y - m.y) ** 2;
    if (d < bestD) {
      bestD = d;
      target = e;
    }
  }
  if (!target) {
    m.vy -= 0.4;
    return;
  }
  const [ax, ay] = toward(m.x, m.y, target.x, target.y, 1.1);
  const [vx, vy] = toward(0, 0, m.vx + ax, m.vy + ay, 8);
  m.vx = vx;
  m.vy = vy;
}

// ---------- Hits ----------

function hurt(s: SkyState, e: Enemy, dmg: number) {
  if (e.hp <= 0) return;
  // A boss core's shield holds while any of its guns stand.
  if (e.kind === 'core' && s.enemies.some((g) => g.anchor === e.id && g.hp > 0)) {
    e.flash = 2;
    return;
  }
  e.hp -= dmg;
  e.flash = 3;
  if (e.hp <= 0) kill(s, e);
}

function kill(s: SkyState, e: Enemy) {
  let points = e.points * (1 + s.loop);
  if (e.seen >= 0 && e.seen <= QUICK_TICKS && !e.anchor && e.kind !== 'core') {
    points *= 2;
    s.popups.push({ x: e.x, y: e.y - 16, text: 'QUICK SHOT!', age: 0 });
  }
  s.score += points;
  s.blasts.push({ x: e.x, y: e.y, size: e.r * (e.kind === 'core' ? 3 : 1.6), age: 0 });
  const drop = (kind: ItemKind) => s.items.push({ x: e.x, y: e.y, vx: roll(s.seed, `drift:${e.id}`, 2) ? 0.9 : -0.9, vy: 0.9, kind, age: 0 });
  if (e.ground) drop('medal');
  if (e.kind === 'carrier' || e.kind === 'gunship') {
    const n = roll(s.seed, `drop:${e.id}`, 10);
    drop(n < 4 ? 'red' : n < 7 ? 'blue' : n < 9 ? 'missile' : 'bomb');
  }
  if (e.kind === 'gun') s.popups.push({ x: e.x, y: e.y, text: 'PART DOWN', age: 0 });
  if (e.kind === 'core') {
    for (let k = 0; k < 6; k++) s.blasts.push({ x: e.x + (k - 2.5) * 22, y: e.y + ((k * 17) % 40) - 20, size: 40, age: -k * 6 });
    s.bullets.length = 0;
    s.score += 20000 * (1 + s.loop);
    s.popups.push({ x: W / 2, y: H / 2 - 40, text: 'STAGE CLEAR', age: 0 });
    s.phase = 'clear';
    s.phaseTick = 0;
  }
}

function playerHit(s: SkyState) {
  const p = s.player;
  s.blasts.push({ x: p.x, y: p.y, size: 46, age: 0 });
  p.down = RESPAWN_TICKS;
  p.lives--;
  p.power = Math.max(1, p.power - 1);
  p.missiles = Math.max(0, p.missiles - 1);
  p.bombs = Math.max(p.bombs, START_BOMBS);
  s.bullets.length = 0;
}

function collect(s: SkyState, item: Item) {
  const p = s.player;
  switch (item.kind) {
    case 'red':
    case 'blue': {
      const weapon: Weapon = item.kind === 'red' ? 'vulcan' : 'laser';
      if (p.weapon === weapon) {
        if (p.power < MAX_POWER) p.power++;
        else s.score += 5000;
      }
      p.weapon = weapon;
      s.popups.push({ x: p.x, y: p.y - 30, text: p.power === MAX_POWER ? 'FULL POWER' : 'POWER UP', age: 0 });
      break;
    }
    case 'missile':
      if (p.missiles < MAX_MISSILES) p.missiles++;
      else s.score += 5000;
      s.popups.push({ x: p.x, y: p.y - 30, text: 'MISSILE', age: 0 });
      break;
    case 'bomb':
      p.bombs = Math.min(7, p.bombs + 1);
      s.popups.push({ x: p.x, y: p.y - 30, text: 'BOMB', age: 0 });
      break;
    case 'medal':
      s.score += s.medal;
      s.popups.push({ x: item.x, y: item.y - 10, text: String(s.medal), age: 0 });
      s.medal = Math.min(10000, s.medal < 1000 ? s.medal + 100 : s.medal + 1000);
      break;
  }
}

// ---------- The step ----------

/** Filters a list in place, keeping what `keep` says: no new arrays each tick. */
function prune<T>(list: T[], keep: (item: T) => boolean) {
  let w = 0;
  for (let i = 0; i < list.length; i++) if (keep(list[i])) list[w++] = list[i];
  list.length = w;
}

/** Moves the world one tick. Does nothing while waiting for a continue. */
export function step(s: SkyState, input: Input) {
  if (s.phase === 'over') return;
  s.clock++;
  s.tick++;
  s.phaseTick++;
  const p = s.player;

  // The ship follows the finger; nothing can push it off the field.
  if (p.down > 0) {
    if (--p.down === 0) {
      if (p.lives <= 0) {
        s.phase = 'over';
        s.phaseTick = 0;
        return;
      }
      p.x = W / 2;
      p.y = H - 90;
      p.invuln = INVULN_TICKS;
    }
  } else {
    const cap = 28;
    p.x = Math.min(W - 14, Math.max(14, p.x + Math.max(-cap, Math.min(cap, input.dx))));
    p.y = Math.min(H - 24, Math.max(40, p.y + Math.max(-cap, Math.min(cap, input.dy))));
    if (p.invuln > 0) p.invuln--;
    if (input.bomb && p.bombs > 0 && s.bomb === 0) {
      p.bombs--;
      s.bomb = BOMB_TICKS;
    }
    if (s.phase !== 'clear') playerFire(s);
  }

  // Waves, then the boss.
  if (s.phase === 'play') {
    const waves = wavesFor(s.seed, s.loop, s.stage);
    while (s.waveIndex < waves.length && waves[s.waveIndex].at <= s.tick) {
      spawnWave(s, waves[s.waveIndex], s.waveIndex);
      s.waveIndex++;
    }
    if (s.tick >= STAGE_TICKS) {
      s.phase = 'warning';
      s.phaseTick = 0;
    }
  } else if (s.phase === 'warning' && s.phaseTick >= 150) {
    spawnBoss(s);
    s.phase = 'boss';
    s.phaseTick = 0;
  } else if (s.phase === 'clear' && s.phaseTick >= CLEAR_TICKS) {
    nextStage(s);
  }

  // Enemies.
  for (const e of s.enemies) {
    e.age++;
    if (e.flash > 0) e.flash--;
    if (e.anchor !== undefined) {
      const core = s.enemies.find((c) => c.id === e.anchor);
      if (core) {
        e.x = core.x + (e.ox ?? 0);
        e.y = core.y + (e.oy ?? 0);
      }
    } else {
      e.x += e.vx;
      e.y += e.vy;
    }
    if (e.seen < 0 && e.y - e.r > 0 && e.y + e.r < H) e.seen = 0;
    else if (e.seen >= 0) e.seen++;
    if (s.phase !== 'clear') enemyThink(s, e);
  }

  // The bomb: no bullets, and steady damage to all on screen.
  if (s.bomb > 0) {
    s.bomb--;
    s.bullets.length = 0;
    for (const e of s.enemies) if (e.y > -e.r && e.y < H + e.r) hurt(s, e, 0.6);
  }

  // Our shots.
  for (const shot of s.shots) {
    if (shot.kind === 'missile') steerMissile(s, shot);
    shot.x += shot.vx;
    shot.y += shot.vy;
    for (const e of s.enemies) {
      if (e.hp <= 0 || e.y < -e.r) continue;
      const reach = e.r + shot.r;
      const dx = e.x - shot.x;
      const dy = e.y - shot.y;
      if (dx * dx + dy * dy < reach * reach) {
        hurt(s, e, shot.dmg);
        shot.dmg = 0;
        break;
      }
    }
  }
  prune(s.shots, (shot) => shot.dmg > 0 && shot.y > -30 && shot.y < H + 30 && shot.x > -30 && shot.x < W + 30);
  // A part's death is final; a core falling takes its parts with it.
  const coreGone = s.enemies.some((e) => e.kind === 'core' && e.hp <= 0);
  prune(s.enemies, (e) => e.hp > 0 && !(coreGone && e.anchor !== undefined) && e.y < H + 60 && e.y > -400 && e.x > -200 && e.x < W + 200 && !(e.age > 60 && e.kind === 'swoop' && (e.x < -40 || e.x > W + 40)) && !(e.kind === 'gunship' && e.age > 420 && e.y < -60));

  // Their bullets.
  const vulnerable = p.down === 0 && p.invuln === 0 && s.bomb === 0 && s.phase !== 'clear';
  let hit = false;
  for (const b of s.bullets) {
    b.x += b.vx;
    b.y += b.vy;
    if (vulnerable && !hit) {
      const reach = b.r + 3;
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      if (dx * dx + dy * dy < reach * reach) hit = true;
    }
  }
  if (vulnerable && !hit) {
    for (const e of s.enemies) {
      if (e.ground) continue;
      const reach = e.r * 0.7 + 4;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy < reach * reach) {
        hit = true;
        if (e.kind !== 'core' && e.kind !== 'gun') hurt(s, e, 999);
        break;
      }
    }
  }
  if (hit) playerHit(s);
  prune(s.bullets, (b) => b.y > -20 && b.y < H + 20 && b.x > -20 && b.x < W + 20);

  // Pickups drift down and bounce off the sides.
  for (const item of s.items) {
    item.age++;
    item.x += item.vx;
    item.y += item.kind === 'medal' ? GROUND_SPEED : item.vy;
    if (item.kind !== 'medal' && (item.x < 16 || item.x > W - 16)) item.vx = -item.vx;
    if (item.kind !== 'medal' && item.age > 600) item.vy = 2.4;
  }
  prune(s.items, (item) => {
    if (p.down === 0) {
      const dx = item.x - p.x;
      const dy = item.y - p.y;
      if (dx * dx + dy * dy < 26 * 26) {
        collect(s, item);
        return false;
      }
    }
    if (item.y > H + 16) {
      if (item.kind === 'medal') s.medal = 100;
      return false;
    }
    return true;
  });

  for (const blast of s.blasts) blast.age++;
  prune(s.blasts, (blast) => blast.age < 30);
  for (const popup of s.popups) popup.age++;
  prune(s.popups, (popup) => popup.age < 60);
}

function nextStage(s: SkyState) {
  s.stage++;
  if (s.stage >= STAGES) {
    s.stage = 0;
    s.loop++;
  }
  s.phase = 'play';
  s.tick = 0;
  s.phaseTick = 0;
  s.waveIndex = 0;
  s.enemies.length = 0;
  s.bullets.length = 0;
  s.items.length = 0;
  s.popups.push({ x: W / 2, y: H / 2 - 40, text: `STAGE ${s.loop * STAGES + s.stage + 1}`, age: 0 });
}

/** The stage as a player counts it: 1, 2, 3, then 4 on the harder lap. */
export function stageNumber(s: SkyState) {
  return s.loop * STAGES + s.stage + 1;
}
