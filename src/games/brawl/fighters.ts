/**
 * The three fighters and their moves. Our own characters and weapons: nothing here comes
 * from any published game. Numbers are frames (60 a second), world pixels, and sub-units
 * a frame for speeds.
 */
export type FighterId = 'knight' | 'smith' | 'lancer';

export type MoveId = 'nLight' | 'sLight' | 'dLight' | 'nAir' | 'sAir' | 'dAir' | 'nSig' | 'sSig' | 'dSig' | 'recovery' | 'pound';

/**
 * Launch directions as unit vectors ×1000, forward and up (y negative), written out so the
 * game needs no trigonometry.
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

/** A hitbox: x forward from the body's centre, y up from the feet (negative). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Move {
  startup: number;
  active: number;
  recovery: number;
  box: Box;
  damage: number;
  /** Knockback: base + damage% × growth, in sub-units a frame, before weight. */
  base: number;
  growth: number;
  angle: Angle;
  /** A push given when the move comes out: a lunge forward, or the leap of a recovery. */
  lunge?: number;
  leap?: number;
  /** An air move: landing ends it, with this many frames of lag. */
  land?: number;
  /** Signature moves, drawn bigger. */
  heavy?: boolean;
}

export interface Fighter {
  id: FighterId;
  name: string;
  weapon: 'sword' | 'hammer' | 'spear';
  blurb: string;
  /** 100 is average; heavier fighters fly less far. */
  weight: number;
  run: number;
  air: number;
  jump: number;
  airJump: number;
  moves: Record<MoveId, Move>;
}

/** The sword's moves: the baseline the other weapons are measured against. */
const BASE: Record<MoveId, Move> = {
  nLight: { startup: 5, active: 3, recovery: 12, box: { x: 4, y: -58, w: 44, h: 30 }, damage: 7, base: 380, growth: 6, angle: 'rising' },
  sLight: { startup: 6, active: 3, recovery: 14, box: { x: 8, y: -48, w: 54, h: 26 }, damage: 8, base: 420, growth: 7, angle: 'low', lunge: 500 },
  dLight: { startup: 5, active: 4, recovery: 14, box: { x: 4, y: -24, w: 58, h: 24 }, damage: 6, base: 360, growth: 5, angle: 'steep' },
  nAir: { startup: 5, active: 5, recovery: 12, box: { x: -34, y: -88, w: 68, h: 46 }, damage: 7, base: 380, growth: 6, angle: 'up', land: 6 },
  sAir: { startup: 6, active: 4, recovery: 14, box: { x: 6, y: -54, w: 56, h: 30 }, damage: 8, base: 420, growth: 7, angle: 'rising', land: 6 },
  dAir: { startup: 7, active: 5, recovery: 15, box: { x: -20, y: -8, w: 40, h: 34 }, damage: 8, base: 320, growth: 6, angle: 'spike', land: 8 },
  nSig: { startup: 14, active: 5, recovery: 22, box: { x: -12, y: -112, w: 62, h: 72 }, damage: 15, base: 650, growth: 15, angle: 'steep', heavy: true },
  sSig: { startup: 16, active: 5, recovery: 24, box: { x: 10, y: -56, w: 66, h: 42 }, damage: 17, base: 700, growth: 16, angle: 'rising', lunge: 700, heavy: true },
  dSig: { startup: 15, active: 6, recovery: 24, box: { x: -72, y: -30, w: 144, h: 30 }, damage: 14, base: 620, growth: 15, angle: 'diagonal', heavy: true },
  recovery: { startup: 3, active: 12, recovery: 14, box: { x: -24, y: -98, w: 60, h: 72 }, damage: 9, base: 520, growth: 8, angle: 'steep', leap: -1750, lunge: 250, land: 8, heavy: true },
  pound: { startup: 8, active: 30, recovery: 12, box: { x: -24, y: -10, w: 48, h: 26 }, damage: 12, base: 550, growth: 12, angle: 'spike', leap: 1700, land: 12, heavy: true },
};

const LIGHTS: MoveId[] = ['nLight', 'sLight', 'dLight', 'nAir', 'sAir', 'dAir'];
const REACHING: MoveId[] = ['nLight', 'sLight', 'dLight', 'sAir', 'sSig'];

/** A weapon's moves: the sword's, made slower and stronger, or quicker and longer. */
function weapon(change: { startup: number; damage: number; heavyDamage: number; base: number; growth: number; reach: number }) {
  const moves = {} as Record<MoveId, Move>;
  for (const id of Object.keys(BASE) as MoveId[]) {
    const m = BASE[id];
    const light = LIGHTS.includes(id);
    moves[id] = {
      ...m,
      startup: Math.max(3, m.startup + change.startup + (light ? 0 : change.startup)),
      damage: m.damage + (light ? change.damage : change.heavyDamage),
      base: m.base + change.base,
      growth: m.growth + change.growth,
      box: REACHING.includes(id) ? { ...m.box, w: m.box.w + change.reach } : m.box,
    };
  }
  return moves;
}

export const FIGHTERS: Record<FighterId, Fighter> = {
  knight: {
    id: 'knight',
    name: 'Knight',
    weapon: 'sword',
    blurb: 'Sword. Even in everything.',
    weight: 100,
    run: 600,
    air: 520,
    jump: -1520,
    airJump: -1380,
    moves: BASE,
  },
  smith: {
    id: 'smith',
    name: 'Smith',
    weapon: 'hammer',
    blurb: 'Hammer. Slow, heavy, hits hard.',
    weight: 115,
    run: 520,
    air: 460,
    jump: -1460,
    airJump: -1320,
    moves: weapon({ startup: 2, damage: 2, heavyDamage: 4, base: 90, growth: 2, reach: 0 }),
  },
  lancer: {
    id: 'lancer',
    name: 'Lancer',
    weapon: 'spear',
    blurb: 'Spear. Quick, light, long reach.',
    weight: 90,
    run: 660,
    air: 560,
    jump: -1580,
    airJump: -1440,
    moves: weapon({ startup: -1, damage: -1, heavyDamage: -1, base: -20, growth: 0, reach: 26 }),
  },
};

export const FIGHTER_IDS = Object.keys(FIGHTERS) as FighterId[];

export const totalFrames = (m: Move) => m.startup + m.active + m.recovery;
