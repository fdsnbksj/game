/**
 * Everyone fights with the same stick body; what changes is what's in hand. Weapons drop
 * onto the stage, and each has one attack (the Attack button) and a limited supply: shots
 * for a gun, swings for a blade. Empty, the next Attack throws it. The Heavy button is the
 * same for everyone: a charged kick, or a throw of whatever you're holding.
 * Our own plain weapons, from no published game. Numbers are frames (60 a second), world
 * pixels, HP, and sub-units a frame for speeds.
 */
import { BODY_H } from './stages';

export type WeaponId =
  | 'fists'
  | 'sword'
  | 'hammer'
  | 'spear'
  | 'axe'
  | 'scythe'
  | 'pistol'
  | 'rifle'
  | 'shotgun'
  | 'sniper'
  | 'rocket'
  | 'bow'
  | 'grenades'
  | 'knives'
  | 'boomerang'
  | 'frost'
  | 'chicken'
  | 'baguette'
  | 'banana'
  | 'bubbles'
  | 'blower';

/** What can drop onto the stage to be picked up. */
export const PICKUPS: readonly WeaponId[] = [
  'sword',
  'hammer',
  'spear',
  'axe',
  'scythe',
  'pistol',
  'rifle',
  'shotgun',
  'sniper',
  'rocket',
  'bow',
  'grenades',
  'knives',
  'boomerang',
  'frost',
  'chicken',
  'baguette',
  'banana',
  'bubbles',
  'blower',
];
/** The ones that fight from a distance, for the bots. */
export const RANGED: readonly WeaponId[] = ['pistol', 'rifle', 'shotgun', 'sniper', 'rocket', 'bow', 'grenades', 'knives', 'boomerang', 'frost', 'banana', 'bubbles', 'blower'];

export const MAX_HP = 100;

/** The one body: speeds and jumps. */
export const BODY = { run: 600, air: 520, jump: -1520, airJump: -1380 };

/**
 * Directions as unit vectors ×1000 (y negative is up), written out so nothing needs
 * trigonometry. Push directions for hits, and the eight ways an attack can be aimed.
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
export interface HitBox {
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
  /** HP taken. */
  damage: number;
  /** How hard a hit pushes, in sub-units a frame. */
  push: number;
  boxes: Record<Aim, HitBox>;
  angles: Record<Aim, Angle>;
  /** A push along the aim when the swing comes out. */
  lunge?: number;
  /** Hooks: sends a fighter toward you instead of away. */
  pull?: boolean;
  /** Extra frames a hit leaves its target helpless. */
  stun?: number;
}

export type ProjectileKind = 'bullet' | 'slug' | 'pellet' | 'rocket' | 'arrow' | 'grenade' | 'knife' | 'boomerang' | 'frost' | 'thrown' | 'peel' | 'bubble' | 'puff';

export interface Shot {
  kind: 'shot';
  startup: number;
  recovery: number;
  projectile: ProjectileKind;
  /** Several at once, fanned across the aim (a shotgun's pellets), each a thousandth-of-a-turn apart. */
  fan?: number[];
  /** Several in a line along the aim (a burst), this many pixels apart. */
  burst?: { count: number; gap: number };
}

export type Attack = Melee | Shot;

export interface Weapon {
  id: WeaponId;
  name: string;
  attack: Attack;
  /** Shots or swings before it's empty; 0 for bare hands, which never run out. */
  ammo: number;
  /** How much a throw of it hurts, before the charge. */
  heft: number;
}

/** The side box turned to point up (above the head) and down (under the feet). */
function aimed(side: HitBox, both = false): Record<Aim, HitBox> {
  if (both) return { side, up: side, down: side };
  return {
    side,
    up: { x: -side.h / 2, y: -BODY_H + 24 - side.x - side.w, w: side.h, h: side.w },
    down: { x: -side.h / 2, y: -30 + side.x, w: side.h, h: side.w },
  };
}

function melee(m: Omit<Melee, 'kind' | 'boxes' | 'angles'> & { box: HitBox; angle: Angle; both?: boolean }): Melee {
  const { box, angle, both, ...rest } = m;
  return { kind: 'melee', ...rest, boxes: aimed(box, both), angles: both ? { side: angle, up: angle, down: angle } : { side: angle, up: 'up', down: 'spike' } };
}

/** The Heavy button bare-handed or aimed nowhere: a kick, harder the longer it was held. */
export const KICK: Melee = melee({ startup: 8, active: 4, recovery: 16, damage: 8, push: 760, box: { x: 4, y: -40, w: 46, h: 28 }, angle: 'rising', lunge: 300 });

export const WEAPONS: Record<WeaponId, Weapon> = {
  fists: { id: 'fists', name: 'Fists', ammo: 0, heft: 0, attack: melee({ startup: 4, active: 3, recovery: 9, damage: 6, push: 320, box: { x: 6, y: -52, w: 34, h: 24 }, angle: 'low' }) },
  sword: { id: 'sword', name: 'Sword', ammo: 16, heft: 16, attack: melee({ startup: 5, active: 3, recovery: 12, damage: 18, push: 520, box: { x: 4, y: -58, w: 58, h: 34 }, angle: 'rising' }) },
  hammer: { id: 'hammer', name: 'Hammer', ammo: 10, heft: 22, attack: melee({ startup: 12, active: 5, recovery: 20, damage: 30, push: 900, box: { x: 4, y: -70, w: 62, h: 56 }, angle: 'rising' }) },
  spear: { id: 'spear', name: 'Spear', ammo: 16, heft: 18, attack: melee({ startup: 6, active: 4, recovery: 12, damage: 15, push: 460, box: { x: 10, y: -50, w: 88, h: 20 }, angle: 'low', lunge: 500 }) },
  axe: { id: 'axe', name: 'Axe', ammo: 12, heft: 20, attack: melee({ startup: 8, active: 4, recovery: 15, damage: 24, push: 660, box: { x: 4, y: -66, w: 58, h: 48 }, angle: 'diagonal' }) },
  scythe: { id: 'scythe', name: 'Scythe', ammo: 14, heft: 16, attack: melee({ startup: 8, active: 5, recovery: 15, damage: 16, push: 520, box: { x: 16, y: -60, w: 100, h: 38 }, angle: 'low', pull: true, stun: 10 }) },
  pistol: { id: 'pistol', name: 'Pistol', ammo: 12, heft: 10, attack: { kind: 'shot', startup: 2, recovery: 10, projectile: 'bullet' } },
  rifle: { id: 'rifle', name: 'Burst rifle', ammo: 10, heft: 14, attack: { kind: 'shot', startup: 2, recovery: 16, projectile: 'bullet', burst: { count: 3, gap: 34 } } },
  shotgun: { id: 'shotgun', name: 'Shotgun', ammo: 5, heft: 14, attack: { kind: 'shot', startup: 4, recovery: 24, projectile: 'pellet', fan: [-260, -130, 0, 130, 260] } },
  sniper: { id: 'sniper', name: 'Sniper', ammo: 3, heft: 16, attack: { kind: 'shot', startup: 10, recovery: 32, projectile: 'slug' } },
  rocket: { id: 'rocket', name: 'Rocket launcher', ammo: 2, heft: 20, attack: { kind: 'shot', startup: 10, recovery: 30, projectile: 'rocket' } },
  bow: { id: 'bow', name: 'Bow', ammo: 8, heft: 10, attack: { kind: 'shot', startup: 6, recovery: 14, projectile: 'arrow' } },
  grenades: { id: 'grenades', name: 'Grenades', ammo: 4, heft: 8, attack: { kind: 'shot', startup: 6, recovery: 16, projectile: 'grenade' } },
  knives: { id: 'knives', name: 'Knives', ammo: 10, heft: 8, attack: { kind: 'shot', startup: 3, recovery: 9, projectile: 'knife' } },
  boomerang: { id: 'boomerang', name: 'Boomerang', ammo: 6, heft: 10, attack: { kind: 'shot', startup: 6, recovery: 14, projectile: 'boomerang' } },
  frost: { id: 'frost', name: 'Frost staff', ammo: 6, heft: 12, attack: { kind: 'shot', startup: 7, recovery: 14, projectile: 'frost' } },
  // The silly ones.
  chicken: {
    id: 'chicken',
    name: 'Rubber chicken',
    ammo: 12,
    heft: 4,
    // Barely hurts; sends them flying anyway.
    attack: melee({ startup: 6, active: 4, recovery: 14, damage: 4, push: 1500, box: { x: 4, y: -60, w: 52, h: 40 }, angle: 'rising' }),
  },
  baguette: {
    id: 'baguette',
    name: 'Baguette',
    ammo: 20,
    heft: 6,
    attack: melee({ startup: 6, active: 4, recovery: 12, damage: 9, push: 420, box: { x: 8, y: -54, w: 104, h: 22 }, angle: 'low' }),
  },
  banana: { id: 'banana', name: 'Bananas', ammo: 5, heft: 4, attack: { kind: 'shot', startup: 5, recovery: 12, projectile: 'peel' } },
  bubbles: { id: 'bubbles', name: 'Bubble gun', ammo: 10, heft: 6, attack: { kind: 'shot', startup: 4, recovery: 12, projectile: 'bubble' } },
  blower: { id: 'blower', name: 'Leaf blower', ammo: 14, heft: 12, attack: { kind: 'shot', startup: 3, recovery: 10, projectile: 'puff', fan: [-180, 0, 180] } },
};

export interface ProjectileSpec {
  speed: number;
  /** Extra upward speed at launch: a lob. */
  lob: number;
  gravity: number;
  /** Frames before it's gone (an arrow's flight, a grenade's fuse). */
  life: number;
  damage: number;
  push: number;
  /** Flies on through fighters, hitting each once. */
  pierce?: boolean;
  /** Blows up, hurting everyone within this many pixels (the thrower too). */
  radius?: number;
  /** Bounces off the ground instead of stopping. */
  bounces?: boolean;
  /** Turns round after this many frames and flies back to the thrower. */
  returns?: number;
  /** Extra frames a hit leaves its target helpless: frozen. */
  stun?: number;
  /** Half its size, for hitting. */
  size?: number;
  /** Always pushes this way, whichever way it was going (a bubble lifts, a peel trips). */
  angle?: Angle;
  /** Lies where it lands until someone steps on it, the thrower too once it's settled. */
  trap?: boolean;
}

export const PROJECTILES: Record<ProjectileKind, ProjectileSpec> = {
  bullet: { speed: 4200, lob: 0, gravity: 0, life: 40, damage: 12, push: 360 },
  slug: { speed: 6500, lob: 0, gravity: 0, life: 30, damage: 60, push: 900, pierce: true },
  pellet: { speed: 3400, lob: 0, gravity: 0, life: 11, damage: 9, push: 300 },
  rocket: { speed: 1500, lob: 0, gravity: 0, life: 90, damage: 40, push: 1150, radius: 110, size: 8 },
  arrow: { speed: 2100, lob: 0, gravity: 8, life: 70, damage: 20, push: 460 },
  grenade: { speed: 1100, lob: -500, gravity: 50, life: 90, damage: 35, push: 1000, radius: 100, bounces: true },
  knife: { speed: 2300, lob: 0, gravity: 12, life: 45, damage: 10, push: 280 },
  boomerang: { speed: 1500, lob: 0, gravity: 0, life: 150, damage: 14, push: 380, pierce: true, returns: 24, size: 10 },
  frost: { speed: 1300, lob: 0, gravity: 0, life: 70, damage: 8, push: 140, stun: 45, size: 9 },
  thrown: { speed: 1900, lob: -200, gravity: 30, life: 80, damage: 0, push: 700, size: 10 },
  peel: { speed: 900, lob: -400, gravity: 50, life: 900, damage: 3, push: 700, bounces: true, trap: true, stun: 50, angle: 'steep', size: 12 },
  bubble: { speed: 650, lob: 0, gravity: -4, life: 150, damage: 3, push: 1400, stun: 20, angle: 'up', size: 14 },
  puff: { speed: 2000, lob: 0, gravity: 0, life: 9, damage: 0, push: 1050, pierce: true, size: 18 },
};

export const attackFrames = (a: Attack) => (a.kind === 'melee' ? a.startup + a.active + a.recovery : a.startup + a.recovery);
