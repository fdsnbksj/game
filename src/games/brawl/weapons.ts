/**
 * Everyone fights with the same body; what changes is the weapon in hand. Weapons appear
 * on the island, last 10 seconds once picked up, and each has two skills: a quick one
 * (Attack) and a strong one (Heavy). Our own plain weapons, from no published game.
 * Numbers are frames (60 a second), world pixels, and sub-units a frame for speeds.
 */
import { BODY_H } from './stage';

export type WeaponId = 'fists' | 'sword' | 'hammer' | 'spear' | 'axe' | 'gauntlets' | 'scythe' | 'bow' | 'bombs' | 'knives' | 'boomerang' | 'frost';
/** What can lie on the island to be picked up. */
export const PICKUPS: readonly WeaponId[] = ['sword', 'hammer', 'spear', 'axe', 'gauntlets', 'scythe', 'bow', 'bombs', 'knives', 'boomerang', 'frost'];
/** The ones that fight from a distance, for the bots. */
export const RANGED: readonly WeaponId[] = ['bow', 'bombs', 'knives', 'boomerang', 'frost'];

/** How long a picked-up weapon lasts. */
export const WEAPON_FRAMES = 600;

/** The one body: speeds and jumps. */
export const BODY = { run: 600, air: 520, jump: -1520, airJump: -1380, weight: 100 };

/**
 * Directions as unit vectors ×1000 (y negative is up), written out so nothing needs
 * trigonometry. Launch angles for hits, and the eight ways a skill can be aimed.
 */
export const ANGLES = {
  up: [0, -1000],
  steep: [500, -866],
  diagonal: [707, -707],
  rising: [866, -500],
  low: [966, -259],
  spike: [707, 707],
} as const;
export type Angle = keyof typeof ANGLES;

/** The eight aims in order around the circle, for fanning a throw out to either side. */
const AROUND: readonly [number, number][] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

/** The aim next to this one, one step round either way (-1 or 1). */
export function turnAim(ax: number, ay: number, steps: number): [number, number] {
  const i = AROUND.findIndex(([x, y]) => x === ax && y === ay);
  return AROUND[(i + steps + 8) % 8];
}

/** Unit vector ×1000 for an aim of (-1|0|1, -1|0|1). */
export function aimVector(ax: number, ay: number): [number, number] {
  if (ax !== 0 && ay !== 0) return [ax * 707, ay * 707];
  return [ax * 1000, ay * 1000];
}

/** A hitbox: x forward from the body's centre, y up from the feet (negative). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Aim = 'side' | 'up' | 'down';

export interface Melee {
  kind: 'melee';
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  /** Knockback: base + damage% × growth, in sub-units a frame. */
  base: number;
  growth: number;
  boxes: Record<Aim, Box>;
  angles: Record<Aim, Angle>;
  /** A push along the aim when the skill comes out. */
  lunge?: number;
  /** Hooks: sends a fighter toward you instead of away. */
  pull?: boolean;
  /** Extra frames a hit leaves its target helpless. */
  stun?: number;
}

export type ProjectileKind = 'arrow' | 'pierce' | 'bomb' | 'bigBomb' | 'knife' | 'boomerang' | 'bigBoomerang' | 'frost' | 'frostWave';

export interface Shot {
  kind: 'shot';
  startup: number;
  recovery: number;
  projectile: ProjectileKind;
  /** Three at once: the aim and the one either side of it. */
  spread?: boolean;
}

export type Skill = Melee | Shot;

export interface Weapon {
  id: WeaponId;
  name: string;
  skills: [Skill, Skill];
}

/** The side box turned to point up (above the head) and down (under the feet). */
function aimed(side: Box, both = false): Record<Aim, Box> {
  if (both) return { side, up: side, down: side };
  return {
    side,
    up: { x: -side.h / 2, y: -BODY_H + 24 - side.x - side.w, w: side.h, h: side.w },
    down: { x: -side.h / 2, y: -30 + side.x, w: side.h, h: side.w },
  };
}

function melee(m: Omit<Melee, 'kind' | 'boxes' | 'angles'> & { box: Box; angle: Angle; both?: boolean; upAngle?: Angle }): Melee {
  const { box, angle, both, upAngle, ...rest } = m;
  return {
    kind: 'melee',
    ...rest,
    boxes: aimed(box, both),
    angles: both ? { side: angle, up: angle, down: angle } : { side: angle, up: upAngle ?? 'up', down: 'spike' },
  };
}

export const WEAPONS: Record<WeaponId, Weapon> = {
  fists: {
    id: 'fists',
    name: 'Fists',
    skills: [
      melee({ startup: 4, active: 3, recovery: 10, damage: 4, base: 260, growth: 4, box: { x: 6, y: -52, w: 34, h: 24 }, angle: 'low' }),
      melee({ startup: 10, active: 4, recovery: 18, damage: 8, base: 460, growth: 8, box: { x: 6, y: -56, w: 42, h: 30 }, angle: 'rising', lunge: 500 }),
    ],
  },
  sword: {
    id: 'sword',
    name: 'Sword',
    skills: [
      melee({ startup: 5, active: 3, recovery: 12, damage: 7, base: 380, growth: 7, box: { x: 4, y: -58, w: 56, h: 34 }, angle: 'rising' }),
      melee({ startup: 12, active: 5, recovery: 20, damage: 14, base: 650, growth: 15, box: { x: 8, y: -60, w: 72, h: 40 }, angle: 'rising', lunge: 900 }),
    ],
  },
  hammer: {
    id: 'hammer',
    name: 'Hammer',
    skills: [
      melee({ startup: 9, active: 4, recovery: 16, damage: 11, base: 520, growth: 11, box: { x: 4, y: -70, w: 60, h: 54 }, angle: 'rising' }),
      melee({ startup: 18, active: 6, recovery: 26, damage: 18, base: 760, growth: 17, box: { x: -84, y: -36, w: 168, h: 36 }, angle: 'steep', both: true }),
    ],
  },
  spear: {
    id: 'spear',
    name: 'Spear',
    skills: [
      melee({ startup: 5, active: 3, recovery: 12, damage: 6, base: 360, growth: 6, box: { x: 10, y: -50, w: 84, h: 20 }, angle: 'low' }),
      melee({ startup: 10, active: 10, recovery: 18, damage: 12, base: 600, growth: 13, box: { x: 10, y: -54, w: 92, h: 26 }, angle: 'rising', lunge: 1300 }),
    ],
  },
  axe: {
    id: 'axe',
    name: 'Axe',
    skills: [
      melee({ startup: 7, active: 4, recovery: 14, damage: 10, base: 470, growth: 10, box: { x: 4, y: -66, w: 58, h: 48 }, angle: 'diagonal' }),
      // A full spin: hits both sides at once.
      melee({ startup: 14, active: 8, recovery: 22, damage: 15, base: 680, growth: 15, box: { x: -70, y: -64, w: 140, h: 56 }, angle: 'rising', both: true }),
    ],
  },
  gauntlets: {
    id: 'gauntlets',
    name: 'Gauntlets',
    skills: [
      melee({ startup: 3, active: 3, recovery: 7, damage: 5, base: 300, growth: 5, box: { x: 6, y: -54, w: 38, h: 26 }, angle: 'low' }),
      // An uppercut: straight up, whichever way it's thrown.
      melee({ startup: 8, active: 6, recovery: 18, damage: 12, base: 620, growth: 13, box: { x: 4, y: -78, w: 44, h: 56 }, angle: 'up', lunge: 600 }),
    ],
  },
  scythe: {
    id: 'scythe',
    name: 'Scythe',
    skills: [
      melee({ startup: 7, active: 4, recovery: 14, damage: 8, base: 420, growth: 8, box: { x: 12, y: -62, w: 90, h: 36 }, angle: 'rising' }),
      // A long hook that drags a fighter back in toward you.
      melee({ startup: 13, active: 6, recovery: 20, damage: 11, base: 520, growth: 8, box: { x: 20, y: -60, w: 110, h: 40 }, angle: 'low', pull: true, stun: 12 }),
    ],
  },
  bow: {
    id: 'bow',
    name: 'Bow',
    skills: [
      { kind: 'shot', startup: 5, recovery: 14, projectile: 'arrow' },
      { kind: 'shot', startup: 12, recovery: 20, projectile: 'pierce' },
    ],
  },
  bombs: {
    id: 'bombs',
    name: 'Bombs',
    skills: [
      { kind: 'shot', startup: 6, recovery: 16, projectile: 'bomb' },
      { kind: 'shot', startup: 12, recovery: 22, projectile: 'bigBomb' },
    ],
  },
  knives: {
    id: 'knives',
    name: 'Knives',
    skills: [
      { kind: 'shot', startup: 3, recovery: 9, projectile: 'knife' },
      { kind: 'shot', startup: 9, recovery: 18, projectile: 'knife', spread: true },
    ],
  },
  boomerang: {
    id: 'boomerang',
    name: 'Boomerang',
    skills: [
      { kind: 'shot', startup: 6, recovery: 14, projectile: 'boomerang' },
      { kind: 'shot', startup: 12, recovery: 20, projectile: 'bigBoomerang' },
    ],
  },
  frost: {
    id: 'frost',
    name: 'Frost staff',
    skills: [
      { kind: 'shot', startup: 7, recovery: 14, projectile: 'frost' },
      { kind: 'shot', startup: 14, recovery: 22, projectile: 'frostWave' },
    ],
  },
};

/** What each kind of projectile does. Arrows fly; bombs arc, bounce and blow up. */
export const PROJECTILES: Record<
  ProjectileKind,
  {
    speed: number;
    lob: number;
    gravity: number;
    life: number;
    damage: number;
    base: number;
    growth: number;
    pierce?: boolean;
    radius?: number;
    /** Turns round after this many frames and flies back to the thrower. */
    returns?: number;
    /** Extra frames a hit leaves its target helpless: frozen. */
    stun?: number;
    /** Half its size, for hitting: bigger shots are easier to land. */
    size?: number;
  }
> = {
  arrow: { speed: 1600, lob: 0, gravity: 8, life: 70, damage: 6, base: 340, growth: 6 },
  pierce: { speed: 2200, lob: 0, gravity: 4, life: 60, damage: 11, base: 560, growth: 12, pierce: true },
  bomb: { speed: 1100, lob: -500, gravity: 50, life: 70, damage: 12, base: 600, growth: 12, radius: 90 },
  bigBomb: { speed: 950, lob: -600, gravity: 50, life: 110, damage: 17, base: 780, growth: 16, radius: 140 },
  knife: { speed: 1900, lob: 0, gravity: 12, life: 45, damage: 4, base: 260, growth: 5 },
  boomerang: { speed: 1500, lob: 0, gravity: 0, life: 150, damage: 6, base: 340, growth: 6, pierce: true, returns: 24, size: 10 },
  bigBoomerang: { speed: 1800, lob: 0, gravity: 0, life: 170, damage: 10, base: 480, growth: 10, pierce: true, returns: 32, size: 16 },
  frost: { speed: 1300, lob: 0, gravity: 0, life: 70, damage: 5, base: 160, growth: 2, stun: 40, size: 9 },
  frostWave: { speed: 900, lob: 0, gravity: 0, life: 90, damage: 8, base: 240, growth: 3, pierce: true, stun: 60, size: 22 },
};

export const skillFrames = (s: Skill) => (s.kind === 'melee' ? s.startup + s.active + s.recovery : s.startup + s.recovery);
