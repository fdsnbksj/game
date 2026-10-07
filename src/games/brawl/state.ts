import { stream } from '../../nonogram/rng';
import { hashSeed } from '../../shared/random';
import { ACTIONS, DIRS, DODGE, DOWN, JUMP, SKILL1, SKILL2, dirX, dirY, type Input } from './input';
import { BLAST, BODY_H, BODY_W, PLATFORMS, RESPAWN, SPAWNS, SUB } from './stage';
import {
  ANGLES,
  aimVector,
  BODY,
  PICKUPS,
  PROJECTILES,
  skillFrames,
  WEAPON_FRAMES,
  WEAPONS,
  type Aim,
  type Angle,
  type Melee,
  type ProjectileKind,
  type Skill,
  type WeaponId,
} from './weapons';

/**
 * Sky Brawl, frame by frame. `step(match, inputs)` moves the fight on by one 60th of a
 * second and is the whole game: no clock, no randomness beyond the match's seed, whole
 * numbers only, so the same inputs make the same fight on every device. That is what lets
 * a fight be saved and resumed, and two phones run the same fight from each other's inputs.
 *
 * Everyone starts with bare hands. Weapons drop onto the island now and then (where and
 * which come from the seed); an unarmed fighter who touches one picks it up, and it lasts
 * 10 seconds. Dodging rolls on the ground; in the air it lays a short-lived floor of ice
 * under your feet (once per trip into the air) to stand, fight and jump from.
 */

/** Bump when a change would make old saved matches play differently. */
export const BRAWL_VERSION = 3;

export const STOCKS = 3;

/** 0 is a person; 1–3 are bots, easy to hard. */
export type BotLevel = 0 | 1 | 2 | 3;

export interface Seat {
  bot: BotLevel;
}

export interface FighterState {
  /** Feet, in sub-units. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  damage: number;
  stocks: number;
  /** What's stood on: a platform's index, ICE_BASE + an ice floor's id, or -1 in the air. */
  platform: number;
  airJumps: number;
  /** The upward strong skill's leap, once per trip into the air. */
  recoveryUsed: boolean;
  /** The air dodge's ice floor, once per trip into the air. */
  iceUsed: boolean;
  /** Frames left of a roll, and before the next one. */
  dodge: number;
  dodgeCooldown: number;
  weapon: WeaponId;
  /** Frames left with the weapon in hand. */
  weaponLeft: number;
  /** The skill in progress (1 or 2), or 0. */
  skill: 0 | 1 | 2;
  skillFrame: number;
  /** Where it's aimed: each -1, 0 or 1. */
  aimX: number;
  aimY: number;
  /** Started in the air: landing ends it. */
  skillAir: boolean;
  /** Seats this swing has already hit, as bits. */
  skillHits: number;
  hitstun: number;
  /** Frames of landing lag after an air skill. */
  lag: number;
  invulnerable: number;
  /** The hit-pause: a few frames frozen when a hit lands, so it reads. */
  freeze: number;
  /** Frames left out of the fight after a KO; while 0, in play. */
  respawn: number;
  dropThrough: number;
  downHeld: number;
  prevInput: Input;
  /** A press made while busy, kept a few frames with its aim. */
  buffer: Input;
  bufferAge: number;
  lastHitBy: number;
  kos: number;
  falls: number;
  /** Damage dealt, for the summary at the end. */
  dealt: number;
}

/** A weapon lying on the island. */
export interface Item {
  weapon: WeaponId;
  x: number;
  y: number;
  age: number;
}

export interface Projectile {
  kind: ProjectileKind;
  owner: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Frames left: an arrow's flight, a bomb's fuse. */
  life: number;
  age: number;
  /** Seats already hit, as bits (a piercing arrow hits each once). */
  hits: number;
}

/** A floor of ice laid by an air dodge: anyone can stand on it until it melts. */
export interface Ice {
  id: number;
  owner: number;
  /** Centre of its top, in sub-units. */
  x: number;
  y: number;
  life: number;
}

/** A bomb going off, kept a few frames to be drawn. */
export interface Blast {
  x: number;
  y: number;
  radius: number;
  age: number;
}

export interface Match {
  v: number;
  seed: string;
  frame: number;
  seats: Seat[];
  fighters: FighterState[];
  items: Item[];
  projectiles: Projectile[];
  blasts: Blast[];
  ice: Ice[];
  /** Ice floors laid so far, for their ids. */
  iced: number;
  /** The frame the next weapon drops, and how many have dropped. */
  nextItem: number;
  dropped: number;
  /** The seat left standing, once there is one. */
  winner: number | null;
}

const GRAVITY = 50;
const MAX_FALL = 1100;
const FAST_FALL = 1600;
const MAX_LAUNCH_FALL = 2600;
const GROUND_ACCEL = 160;
const AIR_ACCEL = 70;
const FRICTION = 120;
const LAUNCH_DRAG = 30;
const BUFFER_FRAMES = 8;
const RESPAWN_FRAMES = 75;
const RESPAWN_INVULNERABLE = 120;
const DROP_HOLD = 10;
const RECOVERY_LEAP = -1700;
const LAND_LAG = 6;
const HALF_W = (BODY_W / 2) * SUB;

/** Weapons: the first drop, then one every 4–6 seconds, at most two lying about. */
const FIRST_ITEM = 90;
const ITEM_GAP = 240;
const ITEM_GAP_SPREAD = 121;
const MAX_ITEMS = 2;
export const ITEM_LIFE = 720;
const PICK_RANGE = 32;
const BLAST_FRAMES = 18;

const ROLL_FRAMES = 18;
const ROLL_SPEED = 900;
const ROLL_COOLDOWN = 40;
export const ICE_BASE = 1000;
export const ICE_HALF = 50;
export const ICE_LIFE = 120;

export function newMatch(seed: string, seats: Seat[]): Match {
  return {
    v: BRAWL_VERSION,
    seed,
    frame: 0,
    seats,
    fighters: seats.map((_, i) => {
      const spawn = SPAWNS[i % SPAWNS.length];
      return {
        x: spawn.x * SUB,
        y: spawn.y * SUB,
        vx: 0,
        vy: 0,
        facing: spawn.x > 0 ? -1 : 1,
        damage: 0,
        stocks: STOCKS,
        platform: 0,
        airJumps: 1,
        recoveryUsed: false,
        iceUsed: false,
        dodge: 0,
        dodgeCooldown: 0,
        weapon: 'fists',
        weaponLeft: 0,
        skill: 0,
        skillFrame: 0,
        aimX: 0,
        aimY: 0,
        skillAir: false,
        skillHits: 0,
        hitstun: 0,
        lag: 0,
        invulnerable: 0,
        freeze: 0,
        respawn: 0,
        dropThrough: 0,
        downHeld: 0,
        prevInput: 0,
        buffer: 0,
        bufferAge: 0,
        lastHitBy: -1,
        kos: 0,
        falls: 0,
        dealt: 0,
      };
    }),
    items: [],
    projectiles: [],
    blasts: [],
    ice: [],
    iced: 0,
    nextItem: FIRST_ITEM,
    dropped: 0,
    winner: null,
  };
}

export const inPlay = (f: FighterState) => f.stocks > 0 && f.respawn === 0;

/** What a fighter can stand on, by its `platform` value: the stage's, or an ice floor. Null once melted. */
export function surface(m: Match, index: number): { left: number; right: number; top: number; soft: boolean; ice: boolean } | null {
  if (index < 0) return null;
  if (index < ICE_BASE) {
    const p = PLATFORMS[index];
    return { left: p.left * SUB, right: p.right * SUB, top: p.top * SUB, soft: p.soft, ice: false };
  }
  const ice = m.ice.find((i) => i.id === index - ICE_BASE);
  return ice ? { left: ice.x - ICE_HALF * SUB, right: ice.x + ICE_HALF * SUB, top: ice.y, soft: true, ice: true } : null;
}

/** Moves a value toward a target by at most `by`. */
const approach = (value: number, target: number, by: number) => (value < target ? Math.min(target, value + by) : Math.max(target, value - by));

export function skillOf(f: FighterState): Skill | null {
  return f.skill ? WEAPONS[f.weapon].skills[f.skill - 1] : null;
}

/** Side, up or down: which version of a swing an aim picks. */
export const aimClass = (f: { aimX: number; aimY: number }): Aim => (f.aimX === 0 && f.aimY < 0 ? 'up' : f.aimX === 0 && f.aimY > 0 ? 'down' : 'side');

/** Whether a swing's hitbox is out this frame. */
export function isActive(f: FighterState, skill: Skill | null): skill is Melee {
  return skill !== null && skill.kind === 'melee' && f.skillFrame > skill.startup && f.skillFrame <= skill.startup + skill.active;
}

/** The nearest fighter in play, or -1. */
export function nearest(m: Match, seat: number, fighters = m.fighters): number {
  const me = fighters[seat];
  let best = -1;
  let bestD = Infinity;
  fighters.forEach((f, i) => {
    if (i === seat || !inPlay(f)) return;
    const d = Math.abs(f.x - me.x) + Math.abs(f.y - me.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/**
 * A skill's aim: the swipe's direction, or with no swipe, toward the nearest opponent
 * (one of eight ways), or straight ahead if there's no one.
 */
function aimAt(m: Match, seat: number, fighters: FighterState[], action: Input): [number, number] {
  const ax = dirX(action);
  const ay = dirY(action);
  if (ax !== 0 || ay !== 0) return [ax, ay];
  const me = fighters[seat];
  const t = nearest(m, seat, fighters);
  if (t < 0) return [me.facing, 0];
  const dx = fighters[t].x - me.x;
  // Aim at their middle, not their feet.
  const dy = fighters[t].y - me.y;
  const sx = dx > 0 ? 1 : dx < 0 ? -1 : me.facing;
  const sy = dy > 0 ? 1 : -1;
  if (Math.abs(dy) * 2 <= Math.abs(dx)) return [sx, 0];
  if (Math.abs(dx) * 2 <= Math.abs(dy)) return [0, sy];
  return [sx, sy];
}

function startSkill(m: Match, seat: number, fighters: FighterState[], slot: 1 | 2, action: Input) {
  const f = fighters[seat];
  const [ax, ay] = aimAt(m, seat, fighters, action);
  f.aimX = ax;
  f.aimY = ay;
  if (ax !== 0) f.facing = ax as 1 | -1;
  f.skill = slot;
  f.skillFrame = 0;
  f.skillHits = 0;
  f.skillAir = f.platform < 0;
  // The strong skill aimed straight up is a leap back toward safety, once per trip into the air.
  if (slot === 2 && ax === 0 && ay < 0 && !f.recoveryUsed) {
    f.recoveryUsed = true;
    f.vy = RECOVERY_LEAP;
    f.platform = -1;
    f.skillAir = true;
  }
}

function jump(f: FighterState) {
  if (f.platform >= 0) {
    f.vy = BODY.jump;
    f.platform = -1;
  } else if (f.airJumps > 0) {
    f.airJumps--;
    f.vy = BODY.airJump;
  }
}

function land(f: FighterState, index: number, top: number) {
  f.platform = index;
  f.y = top;
  f.vy = 0;
  f.airJumps = 1;
  // Only real ground gives back the leap and the ice: standing on ice doesn't make more.
  if (index < ICE_BASE) {
    f.recoveryUsed = false;
    f.iceUsed = false;
  }
  if (f.skill && f.skillAir) {
    f.skill = 0;
    f.lag = LAND_LAG;
  }
  if (f.hitstun > 0) f.hitstun = Math.trunc(f.hitstun / 2);
}

function launch(m: Match, x: number, y: number, kind: ProjectileKind, owner: number, ax: number, ay: number) {
  const spec = PROJECTILES[kind];
  const [ux, uy] = aimVector(ax, ay);
  m.projectiles.push({
    kind,
    owner,
    x,
    y,
    vx: Math.trunc((ux * spec.speed) / 1000),
    vy: Math.trunc((uy * spec.speed) / 1000) + spec.lob,
    life: spec.life,
    age: 0,
    hits: 0,
  });
}

/** Dodge: a roll on the ground, or in the air a floor of ice to stand on. */
function dodge(m: Match, seat: number, action: Input) {
  const f = m.fighters[seat];
  if (f.platform >= 0) {
    if (f.dodgeCooldown > 0) return;
    const dx = dirX(action);
    f.dodge = ROLL_FRAMES;
    f.invulnerable = Math.max(f.invulnerable, ROLL_FRAMES);
    f.vx = dx * ROLL_SPEED;
    if (dx !== 0) f.facing = dx as 1 | -1;
    f.dodgeCooldown = ROLL_COOLDOWN;
    return;
  }
  if (f.iceUsed) return;
  const id = m.iced++;
  m.ice.push({ id, owner: seat, x: f.x, y: f.y, life: ICE_LIFE });
  f.iceUsed = true;
  land(f, ICE_BASE + id, f.y);
  f.vx = Math.trunc(f.vx / 2);
}

/** One fighter's frame: its input, its movement, and the stage. */
function updateFighter(m: Match, seat: number, input: Input) {
  const f = m.fighters[seat];
  const pressed = input & ~f.prevInput & ACTIONS;
  f.prevInput = input;

  if (pressed) {
    f.buffer = pressed | (input & DIRS);
    f.bufferAge = BUFFER_FRAMES;
  } else if (f.bufferAge > 0 && --f.bufferAge === 0) {
    f.buffer = 0;
  }

  if (f.freeze > 0) {
    f.freeze--;
    return;
  }
  if (f.invulnerable > 0) f.invulnerable--;
  if (f.dropThrough > 0) f.dropThrough--;
  if (f.dodgeCooldown > 0 && f.dodge === 0) f.dodgeCooldown--;

  // A weapon runs out; a swing already under way finishes first.
  if (f.weapon !== 'fists' && f.skill === 0 && f.weaponLeft <= 0) f.weapon = 'fists';
  if (f.weaponLeft > 0) f.weaponLeft--;

  const busy = f.hitstun > 0 || f.skill !== 0 || f.lag > 0 || f.dodge > 0;
  if (f.hitstun > 0) f.hitstun--;
  else if (f.lag > 0) f.lag--;

  if (!busy && f.buffer) {
    const action = f.buffer;
    f.buffer = 0;
    f.bufferAge = 0;
    if (action & DODGE) dodge(m, seat, action);
    else if (action & SKILL2) startSkill(m, seat, m.fighters, 2, action);
    else if (action & SKILL1) startSkill(m, seat, m.fighters, 1, action);
    else if (action & JUMP) jump(f);
  }

  const dx = dirX(input);

  // Dropping through a soft ledge takes a moment of holding down.
  f.downHeld = input & DOWN ? f.downHeld + 1 : 0;
  if (f.platform >= 0 && surface(m, f.platform)?.soft && f.downHeld >= DROP_HOLD && !f.skill && f.hitstun === 0 && f.dodge === 0) {
    f.platform = -1;
    f.dropThrough = 14;
  }

  const skill = skillOf(f);
  if (skill) {
    if (f.skillFrame === skill.startup) {
      if (skill.kind === 'melee' && skill.lunge) {
        const [ux, uy] = aimVector(f.aimX, f.aimY);
        f.vx = Math.trunc((ux * skill.lunge) / 1000);
        if (uy < 0 && f.platform < 0) f.vy = Math.min(f.vy, Math.trunc((uy * skill.lunge) / 1000));
      }
      if (skill.kind === 'shot') launch(m, f.x + f.facing * 20 * SUB, f.y - 40 * SUB, skill.projectile, seat, f.aimX, f.aimY);
    }
    f.skillFrame++;
    if (f.skillFrame >= skillFrames(skill)) f.skill = 0;
  }

  // Run on the ground, drift in the air; a swing on the ground plants the feet; a roll carries on.
  if (f.dodge > 0) {
    f.dodge--;
    f.vx = approach(f.vx, 0, 40);
  }
  const control = f.hitstun === 0 && f.lag === 0 && f.dodge === 0 && (!f.skill || f.platform < 0);
  if (control) {
    const ground = f.platform >= 0;
    const target = dx * (ground ? BODY.run : BODY.air);
    f.vx = approach(f.vx, target, ground ? GROUND_ACCEL : dx === 0 ? 20 : AIR_ACCEL);
    if (ground && dx !== 0 && !f.skill) f.facing = dx as 1 | -1;
  } else if (f.dodge > 0) {
    // The roll keeps its own pace.
  } else if (f.platform >= 0) {
    f.vx = approach(f.vx, 0, f.hitstun > 0 ? 50 : FRICTION / 2);
  } else {
    f.vx = approach(f.vx, 0, f.hitstun > 0 ? LAUNCH_DRAG : 20);
  }

  if (f.platform < 0) {
    const cap = f.hitstun > 0 ? MAX_LAUNCH_FALL : input & DOWN && f.vy > 0 ? FAST_FALL : MAX_FALL;
    f.vy = Math.min(f.vy + GRAVITY, Math.max(cap, f.vy));
  }

  // Move, then meet the stage.
  const prevY = f.y;
  const prevTop = f.y - BODY_H * SUB;
  f.x += f.vx;
  f.y += f.vy;

  if (f.platform >= 0) {
    const p = surface(m, f.platform);
    if (!p || f.x < p.left || f.x > p.right) f.platform = -1;
    else {
      f.y = p.top;
      f.vy = 0;
    }
  }

  if (f.platform < 0) {
    if (f.vy >= 0) {
      for (let i = 0; i < PLATFORMS.length; i++) {
        const p = PLATFORMS[i];
        if (p.soft && f.dropThrough > 0) continue;
        const top = p.top * SUB;
        if (prevY <= top && f.y >= top && f.x >= p.left * SUB && f.x <= p.right * SUB) {
          land(f, i, top);
          break;
        }
      }
      for (const ice of m.ice) {
        if (f.platform >= 0 || f.dropThrough > 0) break;
        if (prevY <= ice.y && f.y >= ice.y && Math.abs(f.x - ice.x) <= ICE_HALF * SUB) land(f, ICE_BASE + ice.id, ice.y);
      }
    }
    // The island itself is solid: no passing through its sides or underside.
    const ground = PLATFORMS[0];
    const left = ground.left * SUB - HALF_W;
    const right = ground.right * SUB + HALF_W;
    if (f.platform < 0 && f.x > left && f.x < right && f.y > ground.top * SUB && f.y - BODY_H * SUB < ground.bottom * SUB) {
      if (prevTop >= ground.bottom * SUB) {
        f.y = ground.bottom * SUB + BODY_H * SUB;
        f.vy = Math.max(f.vy, 0);
      } else if (f.x < 0) {
        f.x = left;
        f.vx = Math.min(f.vx, 0);
      } else {
        f.x = right;
        f.vx = Math.max(f.vx, 0);
      }
    }
  }
}

/** A swing's hitbox in world sub-units. */
export function hitbox(f: FighterState, skill: Melee) {
  const { x, y, w, h } = skill.boxes[aimClass(f)];
  const near = f.x + x * SUB * f.facing;
  const far = f.x + (x + w) * SUB * f.facing;
  return { left: Math.min(near, far), right: Math.max(near, far), top: f.y + y * SUB, bottom: f.y + (y + h) * SUB };
}

function overlaps(box: { left: number; right: number; top: number; bottom: number }, f: FighterState) {
  return box.left < f.x + HALF_W && box.right > f.x - HALF_W && box.top < f.y && box.bottom > f.y - BODY_H * SUB;
}

/** Knockback speed for a hit at the target's damage (after the hit), in sub-units a frame. */
export function knockback(base: number, growth: number, damage: number) {
  return Math.trunc(((base + damage * growth) * 100) / BODY.weight);
}

interface Hit {
  by: number;
  target: number;
  damage: number;
  base: number;
  growth: number;
  angle: Angle;
  /** Which way along x the launch goes. */
  side: number;
}

function applyHit(m: Match, h: Hit) {
  const attacker = m.fighters[h.by];
  const target = m.fighters[h.target];
  target.damage = Math.min(999, target.damage + h.damage);
  if (h.by !== h.target) attacker.dealt += h.damage;
  const speed = knockback(h.base, h.growth, target.damage);
  const [ax, ay] = ANGLES[h.angle];
  target.vx = Math.trunc((ax * speed) / 1000) * h.side;
  target.vy = Math.trunc((ay * speed) / 1000);
  if (target.platform >= 0) {
    // A downward hit on someone standing bounces them up instead.
    if (target.vy > 0) target.vy = -Math.trunc(target.vy / 2);
    if (target.vy < 0) target.platform = -1;
  }
  target.hitstun = 8 + Math.trunc(speed / 60);
  target.skill = 0;
  target.dodge = 0;
  target.iceUsed = false;
  target.lag = 0;
  target.buffer = 0;
  target.bufferAge = 0;
  target.airJumps = 1;
  target.recoveryUsed = false;
  if (h.by !== h.target) target.lastHitBy = h.by;
  const pause = 3 + Math.trunc(h.damage / 3);
  attacker.freeze = Math.max(attacker.freeze, pause);
  target.freeze = pause;
}

/** A blast's push: away from its centre, one of a few written-out angles. */
function blastHit(by: number, target: number, f: FighterState, bx: number, by2: number, spec: { damage: number; base: number; growth: number }): Hit {
  const dx = f.x - bx;
  const dy = f.y - (BODY_H * SUB) / 2 - by2;
  const side = dx > 0 ? 1 : dx < 0 ? -1 : f.facing;
  const angle: Angle = dy > Math.abs(dx) ? 'spike' : Math.abs(dx) * 2 < Math.abs(dy) ? 'up' : 'diagonal';
  return { by, target, damage: spec.damage, base: spec.base, growth: spec.growth, angle, side };
}

function explode(m: Match, p: Projectile, hits: Hit[]) {
  const spec = PROJECTILES[p.kind];
  const r = (spec.radius ?? 0) * SUB;
  m.blasts.push({ x: p.x, y: p.y, radius: spec.radius ?? 0, age: 0 });
  m.fighters.forEach((f, t) => {
    if (!inPlay(f) || f.invulnerable > 0) return;
    const cx = f.x;
    const cy = f.y - (BODY_H * SUB) / 2;
    // A box test against the blast's reach: close enough, and simple.
    if (Math.abs(cx - p.x) <= r + HALF_W && Math.abs(cy - p.y) <= r + (BODY_H * SUB) / 2) hits.push(blastHit(p.owner, t, f, p.x, p.y, spec));
  });
}

/** Arrows fly and bombs arc; each meets the island, the fighters, or its end. */
function moveProjectiles(m: Match, hits: Hit[]) {
  const kept: Projectile[] = [];
  for (const p of m.projectiles) {
    const spec = PROJECTILES[p.kind];
    const bomb = spec.radius !== undefined;
    const prevY = p.y;
    p.vy += spec.gravity;
    p.x += p.vx;
    p.y += p.vy;
    p.age++;
    p.life--;
    let done = false;

    // The island stops arrows; bombs bounce off it and off the ledges.
    for (let i = 0; i < PLATFORMS.length && !done; i++) {
      const pl = PLATFORMS[i];
      const inside = p.x >= pl.left * SUB && p.x <= pl.right * SUB;
      if (!inside) continue;
      const top = pl.top * SUB;
      if (prevY <= top && p.y >= top && p.vy > 0) {
        if (bomb) {
          p.y = top;
          p.vy = -Math.trunc((p.vy * 55) / 100);
          p.vx = Math.trunc((p.vx * 80) / 100);
        } else if (!pl.soft) done = true;
      } else if (!pl.soft && p.y > top && p.y < pl.bottom * SUB) {
        if (bomb) {
          p.vx = -p.vx;
          p.x += p.vx;
        } else done = true;
      }
    }

    if (!done) {
      m.fighters.forEach((f, t) => {
        if (done || t === p.owner || !inPlay(f) || f.invulnerable > 0 || p.hits & (1 << t)) return;
        const box = { left: p.x - 6 * SUB, right: p.x + 6 * SUB, top: p.y - 6 * SUB, bottom: p.y + 6 * SUB };
        if (!overlaps(box, f)) return;
        if (bomb) {
          // A bomb thrown a moment ago doesn't go off in the thrower's own face.
          if (p.age > 6) {
            explode(m, p, hits);
            done = true;
          }
          return;
        }
        p.hits |= 1 << t;
        const side = p.vx > 0 ? 1 : p.vx < 0 ? -1 : f.facing;
        const angle: Angle = Math.abs(p.vx) * 2 < Math.abs(p.vy) ? (p.vy < 0 ? 'up' : 'spike') : 'rising';
        hits.push({ by: p.owner, target: t, damage: spec.damage, base: spec.base, growth: spec.growth, angle, side });
        if (!spec.pierce) done = true;
      });
    }

    if (!done && p.life <= 0) {
      if (bomb) explode(m, p, hits);
      done = true;
    }
    const x = p.x / SUB;
    const y = p.y / SUB;
    if (x < BLAST.left || x > BLAST.right || y < BLAST.top || y > BLAST.bottom) done = true;
    if (!done) kept.push(p);
  }
  m.projectiles = kept;
}

/** Weapons drop onto the island now and then, from the match's seed: the same on every phone. */
function dropWeapons(m: Match) {
  m.items = m.items.map((it) => ({ ...it, age: it.age + 1 })).filter((it) => it.age < ITEM_LIFE);
  if (m.frame < m.nextItem) return;
  const roll = stream(`${m.seed}:item:${m.dropped}`);
  m.dropped++;
  m.nextItem = m.frame + ITEM_GAP + roll(ITEM_GAP_SPREAD);
  if (m.items.length >= MAX_ITEMS) return;
  const weapon = PICKUPS[roll(PICKUPS.length)];
  // The island twice as often as each ledge: it's where the fighting is.
  const spots = [0, 0, 1, 2, 3];
  const p = PLATFORMS[spots[roll(spots.length)]];
  const width = p.right - p.left - 40;
  m.items.push({ weapon, x: (p.left + 20 + roll(width + 1)) * SUB, y: p.top * SUB, age: 0 });
}

function pickUp(m: Match) {
  m.fighters.forEach((f) => {
    if (!inPlay(f) || f.weapon !== 'fists' || f.skill) return;
    const i = m.items.findIndex((it) => Math.abs(it.x - f.x) <= PICK_RANGE * SUB && it.y <= f.y + 10 * SUB && it.y >= f.y - BODY_H * SUB);
    if (i < 0) return;
    f.weapon = m.items[i].weapon;
    f.weaponLeft = WEAPON_FRAMES;
    m.items.splice(i, 1);
  });
}

function knockOut(m: Match, f: FighterState) {
  f.stocks--;
  f.falls++;
  if (f.lastHitBy >= 0) m.fighters[f.lastHitBy].kos++;
  f.respawn = f.stocks > 0 ? RESPAWN_FRAMES : -1;
  f.x = RESPAWN.x * SUB;
  f.y = RESPAWN.y * SUB;
  f.vx = 0;
  f.vy = 0;
  f.platform = -1;
  f.damage = 0;
  f.weapon = 'fists';
  f.weaponLeft = 0;
  f.skill = 0;
  f.dodge = 0;
  f.hitstun = 0;
  f.lag = 0;
  f.freeze = 0;
  f.buffer = 0;
  f.bufferAge = 0;
  f.lastHitBy = -1;
}

function comeBack(f: FighterState) {
  f.respawn = 0;
  f.invulnerable = RESPAWN_INVULNERABLE;
  f.airJumps = 1;
  f.recoveryUsed = false;
  f.iceUsed = false;
  f.dodgeCooldown = 0;
}

/** One frame of the fight, from every seat's input. Returns a new match; the old one is untouched. */
export function step(match: Match, inputs: readonly Input[]): Match {
  if (match.winner !== null) return match;
  const m: Match = {
    ...match,
    frame: match.frame + 1,
    fighters: match.fighters.map((f) => ({ ...f })),
    items: match.items,
    projectiles: match.projectiles.map((p) => ({ ...p })),
    blasts: match.blasts.map((b) => ({ ...b, age: b.age + 1 })).filter((b) => b.age < BLAST_FRAMES),
    // Ice melts; anyone on a floor that's gone simply falls.
    ice: match.ice.map((i) => ({ ...i, life: i.life - 1 })).filter((i) => i.life > 0),
  };

  m.fighters.forEach((f, i) => {
    if (f.stocks <= 0) return;
    if (f.respawn > 0) {
      f.prevInput = inputs[i] ?? 0;
      if (--f.respawn === 0) comeBack(f);
      return;
    }
    updateFighter(m, i, inputs[i] ?? 0);
  });

  dropWeapons(m);
  pickUp(m);

  // Every hit is found before any lands, so two swings that meet both connect.
  const hits: Hit[] = [];
  m.fighters.forEach((attacker, a) => {
    if (!inPlay(attacker) || attacker.freeze > 0) return;
    const skill = skillOf(attacker);
    if (!isActive(attacker, skill)) return;
    const box = hitbox(attacker, skill);
    const aim = aimClass(attacker);
    const reachesBack = skill.boxes[aim].x < 0;
    m.fighters.forEach((target, t) => {
      if (t === a || !inPlay(target) || target.invulnerable > 0) return;
      if (attacker.skillHits & (1 << t)) return;
      if (!overlaps(box, target)) return;
      attacker.skillHits |= 1 << t;
      // Swings reaching behind the body send a fighter the way they were from you.
      const side = !reachesBack || target.x === attacker.x ? attacker.facing : target.x > attacker.x ? 1 : -1;
      hits.push({ by: a, target: t, damage: skill.damage, base: skill.base, growth: skill.growth, angle: skill.angles[aim], side });
    });
  });
  moveProjectiles(m, hits);
  for (const h of hits) applyHit(m, h);

  let lastOut = -1;
  m.fighters.forEach((f, i) => {
    if (!inPlay(f)) return;
    const x = f.x / SUB;
    const y = f.y / SUB;
    if (x < BLAST.left || x > BLAST.right || y < BLAST.top || y > BLAST.bottom) {
      knockOut(m, f);
      if (f.stocks === 0) lastOut = i;
    }
  });

  const standing = m.fighters.flatMap((f, i) => (f.stocks > 0 ? [i] : []));
  if (standing.length === 1) m.winner = standing[0];
  else if (standing.length === 0) m.winner = lastOut;
  return m;
}

/** A fingerprint of the whole match, to check two runs (or two phones) agree. */
export const hashState = (m: Match) => hashSeed(JSON.stringify(m)).toString(16);
