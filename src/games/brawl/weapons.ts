/**
 * Everyone fights with the same body; what changes is the weapon in hand. Weapons appear
 * on the island, last 10 seconds once picked up, and each has two skills: a quick one
 * (double tap) and a strong one (hold). Our own plain weapons, from no published game.
 * Numbers are frames (60 a second), world pixels, and sub-units a frame for speeds.
 */
import { BODY_H } from './stage';

export type WeaponId = 'fists' | 'sword' | 'hammer' | 'spear' | 'bow' | 'bombs';
/** What can lie on the island to be picked up. */
export const PICKUPS: readonly WeaponId[] = ['sword', 'hammer', 'spear', 'bow', 'bombs'];

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
}

export type ProjectileKind = 'arrow' | 'pierce' | 'bomb' | 'bigBomb';

export interface Shot {
  kind: 'shot';
  startup: number;
  recovery: number;
  projectile: ProjectileKind;
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

function melee(m: Omit<Melee, 'kind' | 'boxes' | 'angles'> & { box: Box; angle: Angle; both?: boolean }): Melee {
  const { box, angle, both, ...rest } = m;
  return { kind: 'melee', ...rest, boxes: aimed(box, both), angles: both ? { side: angle, up: angle, down: angle } : { side: angle, up: 'up', down: 'spike' } };
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
};

/** What each kind of projectile does. Arrows fly; bombs arc, bounce and blow up. */
export const PROJECTILES: Record<
  ProjectileKind,
  { speed: number; lob: number; gravity: number; life: number; damage: number; base: number; growth: number; pierce?: boolean; radius?: number }
> = {
  arrow: { speed: 1600, lob: 0, gravity: 8, life: 70, damage: 6, base: 340, growth: 6 },
  pierce: { speed: 2200, lob: 0, gravity: 4, life: 60, damage: 11, base: 560, growth: 12, pierce: true },
  bomb: { speed: 1100, lob: -500, gravity: 50, life: 70, damage: 12, base: 600, growth: 12, radius: 90 },
  bigBomb: { speed: 950, lob: -600, gravity: 50, life: 110, damage: 17, base: 780, growth: 16, radius: 140 },
};

export const skillFrames = (s: Skill) => (s.kind === 'melee' ? s.startup + s.active + s.recovery : s.startup + s.recovery);
