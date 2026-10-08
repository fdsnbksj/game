import { stream } from '../../nonogram/rng';
import { hashSeed } from '../../shared/random';
import { ACTIONS, DIRS, DODGE, DOWN, JUMP, SKILL1, SKILL2, dirX, dirY, type Input } from './input';
import { beamAt, BODY_H, BODY_W, moverAt, sawAt, STAGES, SUB, WIND, type Platform, type Stage } from './stages';
import {
  ANGLES,
  aimVector,
  attackFrames,
  BODY,
  KICK,
  MAX_HP,
  PICKUPS,
  PROJECTILES,
  WEAPONS,
  type Aim,
  type Angle,
  type Attack,
  type Melee,
  type ProjectileKind,
  type WeaponId,
} from './weapons';

/**
 * Stick Brawl, frame by frame. `step(match, inputs)` moves the fight on by one 60th of a
 * second and is the whole game: no clock, no randomness beyond the match's seed, whole
 * numbers only, so the same inputs make the same fight on every device. That is what lets
 * a fight be saved and resumed, and two phones run the same fight from each other's inputs.
 *
 * A match is rounds. Everyone starts a round with 100 HP and bare hands, on one of six
 * stages; a fighter at 0 HP, or off the edge of the world, is out. The last one standing
 * takes the round, and the first to three takes the match. Weapons drop in now and then
 * (which and where from the seed); touch one bare-handed to pick it up. It has so many
 * shots or swings; empty, the next Attack throws it. Heavy is held: a charged kick, or a
 * throw of what you hold if the stick is pushed. Dodge rolls on the ground and, in the air,
 * lays a short-lived floor of ice to stand on.
 */

/** Bump when a change would make old saved matches play differently. */
export const BRAWL_VERSION = 8;

export const ROUNDS_TO_WIN = 3;
/** The pause between rounds, with the round's winner shown. */
export const ROUND_BREAK = 120;

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
  hp: number;
  alive: boolean;
  /** Frames since going down, for the fall and fade. */
  deadFor: number;
  /** What's stood on: a stage platform's index, then the moving ones, ICE_BASE + an ice floor's id, or -1 in the air. */
  platform: number;
  airJumps: number;
  /** The upward heavy's leap, once per trip into the air. */
  recoveryUsed: boolean;
  /** The air dodge's ice floor, once per trip into the air. */
  iceUsed: boolean;
  /** Frames left of a roll, and before the next one. */
  dodge: number;
  dodgeCooldown: number;
  weapon: WeaponId;
  /** Shots or swings left. */
  ammo: number;
  /** Frames the heavy has been held down for, while charging; 0 when not. */
  charge: number;
  /** How charged the kick in progress was when let go, 0 to MAX_CHARGE. */
  power: number;
  /** The move in progress: 1 the weapon's attack, 2 the kick, 0 nothing. */
  move: 0 | 1 | 2;
  moveFrame: number;
  /** Where it's aimed: each -1, 0 or 1. */
  aimX: number;
  aimY: number;
  /** Started in the air: landing ends it. */
  moveAir: boolean;
  /** Seats this swing has already hit, as bits. */
  moveHits: number;
  hitstun: number;
  /** Frames of lag after landing from an air move, or after a throw. */
  lag: number;
  invulnerable: number;
  /** The hit-pause: a few frames frozen when a hit lands, so it reads. */
  freeze: number;
  dropThrough: number;
  downHeld: number;
  /** Frames before lava or spikes can hurt again. */
  hazardCooldown: number;
  prevInput: Input;
  /** A press made while busy, kept a few frames with its aim. */
  buffer: Input;
  bufferAge: number;
  lastHitBy: number;
  /** Over the whole match: knockouts made, times out, HP dealt. */
  kos: number;
  falls: number;
  dealt: number;
}

/** A weapon lying on the stage. */
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
  /** Frames left: a shot's flight, a grenade's fuse. */
  life: number;
  age: number;
  /** Seats already hit, as bits. */
  hits: number;
  /** A thrown weapon: which, and how much it hurts. */
  weapon: WeaponId | null;
  damage: number;
  /** Times it has bounced off a wall (a ray gun's shot ricochets). */
  bounced: number;
}

/** An explosion, kept a few frames to be drawn. */
export interface Blast {
  x: number;
  y: number;
  radius: number;
  age: number;
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

export interface Match {
  v: number;
  seed: string;
  frame: number;
  seats: Seat[];
  fighters: FighterState[];
  /** The stages in the order this match plays them. */
  order: number[];
  round: number;
  /** Index into STAGES. */
  stage: number;
  /** Rounds won, per seat. */
  wins: number[];
  /** Frames left of the break between rounds; 0 while a round is on. */
  between: number;
  /** Who took the round just ended (-1 for nobody: all out at once). */
  roundWinner: number | null;
  /** Per stage platform: 0 whole, then frames since it began to crack. */
  crumble: number[];
  /** Per mine: 0 armed, or frames until it re-arms. */
  mines: number[];
  items: Item[];
  projectiles: Projectile[];
  blasts: Blast[];
  ice: Ice[];
  /** Ice floors laid so far, for their ids. */
  iced: number;
  /** The frame the next weapon drops, and how many have dropped. */
  nextItem: number;
  dropped: number;
  /** The seat that won the match, once there is one. */
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
const DROP_HOLD = 10;
const RECOVERY_LEAP = -1700;
const LAND_LAG = 6;
const THROW_LAG = 10;
const BOUNCE_SPEED = -2300;
const HALF_W = (BODY_W / 2) * SUB;

/** Weapons: the first drop soon after a round starts, then one every 3–5 seconds, at most three lying about. */
const FIRST_ITEM = 60;
const ITEM_GAP = 180;
const ITEM_GAP_SPREAD = 121;
const MAX_ITEMS = 3;
export const ITEM_LIFE = 900;
const PICK_RANGE = 32;
const BLAST_FRAMES = 18;

const ROLL_FRAMES = 18;
const ROLL_SPEED = 900;
const ROLL_COOLDOWN = 40;
export const ICE_BASE = 1000;
export const ICE_HALF = 50;
export const ICE_LIFE = 120;

/** A held heavy is fully charged after this long: twice the kick, twice the throw. */
export const MAX_CHARGE = 60;
/** How fast you can walk while charging, as a share of a run. */
const CHARGE_WALK = 3;
/** Scales a value by a charge: ×1 at none, up to ×(1 + share%) at full. */
export const charged = (value: number, power: number, share: number) => Math.trunc((value * (MAX_CHARGE + Math.trunc((power * share) / 100))) / MAX_CHARGE);

/** Crumbling blocks: cracking this long, then gone this long, then back. */
export const CRACK = 60;
export const GONE = 300;

const LAVA_DAMAGE = 15;
const LAVA_BOUNCE = -2200;
const SPIKE_DAMAGE = 20;
const SAW_DAMAGE = 25;
const LASER_DAMAGE = 30;
/** A mine re-arms this long after it goes off. */
export const MINE_REARM = 300;
/** How fast a black hole drags fighters in: about half a run. */
const VORTEX_PULL = 280;
/** On ice: slow to get going, slow to stop. */
const ICE_ACCEL = 45;
const ICE_FRICTION = 8;
/** A banana peel the thrower can slip on too, once it's had a moment to land. */
const TRAP_SETTLE = 40;
const HAZARD_COOLDOWN = 30;

export const stageOf = (m: Match): Stage => STAGES[m.stage];

function freshFighter(spawn: { x: number; y: number }): FighterState {
  return {
    x: spawn.x * SUB,
    y: spawn.y * SUB,
    vx: 0,
    vy: 0,
    facing: spawn.x > 0 ? -1 : 1,
    hp: MAX_HP,
    alive: true,
    deadFor: 0,
    platform: -1,
    airJumps: 1,
    recoveryUsed: false,
    iceUsed: false,
    dodge: 0,
    dodgeCooldown: 0,
    weapon: 'fists',
    ammo: 0,
    charge: 0,
    power: 0,
    move: 0,
    moveFrame: 0,
    aimX: 0,
    aimY: 0,
    moveAir: false,
    moveHits: 0,
    hitstun: 0,
    lag: 0,
    invulnerable: 0,
    freeze: 0,
    dropThrough: 0,
    downHeld: 0,
    hazardCooldown: 0,
    prevInput: 0,
    buffer: 0,
    bufferAge: 0,
    lastHitBy: -1,
    kos: 0,
    falls: 0,
    dealt: 0,
  };
}

/** Everyone starts standing on the ground beneath their spawn. */
function settle(m: Match) {
  const plats = stageOf(m).platforms;
  for (const f of m.fighters) {
    plats.forEach((p, i) => {
      if (f.platform < 0 && f.x >= p.left * SUB && f.x <= p.right * SUB && f.y === p.top * SUB) f.platform = i;
    });
  }
}

/** Sets up round `r`: its stage, everyone back at the start, the stage cleared. */
function startRound(m: Match, r: number) {
  m.round = r;
  m.stage = m.order[r % m.order.length];
  const stage = STAGES[m.stage];
  m.fighters = m.fighters.map((f, i) => {
    const fresh = freshFighter(stage.spawns[i % stage.spawns.length]);
    return { ...fresh, kos: f.kos, falls: f.falls, dealt: f.dealt };
  });
  m.crumble = stage.platforms.map(() => 0);
  m.mines = stage.hazard.kind === 'mines' ? stage.hazard.xs.map(() => 0) : [];
  m.items = [];
  m.projectiles = [];
  m.blasts = [];
  m.ice = [];
  m.between = 0;
  m.roundWinner = null;
  m.nextItem = m.frame + FIRST_ITEM;
  settle(m);
}

export function newMatch(seed: string, seats: Seat[]): Match {
  // The stage order: every stage once, shuffled by the seed, then round again.
  const roll = stream(`${seed}:stages`);
  const order = STAGES.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = roll(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const m: Match = {
    v: BRAWL_VERSION,
    seed,
    frame: 0,
    seats,
    fighters: seats.map(() => freshFighter({ x: 0, y: 0 })),
    order,
    round: 0,
    stage: order[0],
    wins: seats.map(() => 0),
    between: 0,
    roundWinner: null,
    crumble: [],
    mines: [],
    items: [],
    projectiles: [],
    blasts: [],
    ice: [],
    iced: 0,
    nextItem: FIRST_ITEM,
    dropped: 0,
    winner: null,
  };
  startRound(m, 0);
  return m;
}

export const inPlay = (f: FighterState) => f.alive;

/** Moves a value toward a target by at most `by`. */
const approach = (value: number, target: number, by: number) => (value < target ? Math.min(target, value + by) : Math.max(target, value - by));

export interface Surface {
  left: number;
  right: number;
  top: number;
  bottom: number;
  soft: boolean;
  bounce: boolean;
  crumbles: boolean;
  slippery: boolean;
  belt: number;
}

const toSurface = (p: Platform): Surface => ({
  left: p.left * SUB,
  right: p.right * SUB,
  top: p.top * SUB,
  bottom: p.bottom * SUB,
  soft: p.soft,
  bounce: !!p.bounce,
  crumbles: !!p.crumbles,
  slippery: !!p.slippery,
  belt: p.belt ?? 0,
});

/** Whether a crumbling block is down (fallen, not yet back). */
export const isGone = (m: Match, i: number) => (m.crumble[i] ?? 0) >= CRACK;

/** What a fighter can stand on, by its `platform` value, where it is this frame. Null once gone or melted. */
export function surface(m: Match, index: number): Surface | null {
  if (index < 0) return null;
  const stage = stageOf(m);
  if (index < stage.platforms.length) return isGone(m, index) ? null : toSurface(stage.platforms[index]);
  if (index < ICE_BASE) {
    const mover = stage.movers[index - stage.platforms.length];
    return mover ? toSurface(moverAt(mover, m.frame)) : null;
  }
  const ice = m.ice.find((i) => i.id === index - ICE_BASE);
  return ice ? { left: ice.x - ICE_HALF * SUB, right: ice.x + ICE_HALF * SUB, top: ice.y, bottom: ice.y, soft: true, bounce: false, crumbles: false, slippery: false, belt: 0 } : null;
}

/** Every surface there is this frame, with its index. */
function surfaces(m: Match): [number, Surface][] {
  const stage = stageOf(m);
  const out: [number, Surface][] = [];
  const count = stage.platforms.length + stage.movers.length;
  for (let i = 0; i < count; i++) {
    const s = surface(m, i);
    if (s) out.push([i, s]);
  }
  for (const ice of m.ice) out.push([ICE_BASE + ice.id, surface(m, ICE_BASE + ice.id)!]);
  return out;
}

/** The gust now: which way it blows (0 when calm), and whether it's only a warning. */
export function windAt(m: Match): { dir: number; warning: boolean } {
  if (stageOf(m).hazard.kind !== 'wind') return { dir: 0, warning: false };
  const cycle = Math.floor(m.frame / WIND.cycle);
  const t = m.frame % WIND.cycle;
  if (t < WIND.warn) return { dir: 0, warning: false };
  const dir = stream(`${m.seed}:wind:${cycle}`)(2) === 0 ? -1 : 1;
  return { dir, warning: t < WIND.blow };
}

export function attackOf(f: FighterState): Attack | null {
  if (f.move === 1) return WEAPONS[f.weapon].attack;
  if (f.move === 2) return KICK;
  return null;
}

/** Side, up or down: which version of a swing an aim picks. */
export const aimClass = (f: { aimX: number; aimY: number }): Aim => (f.aimX === 0 && f.aimY < 0 ? 'up' : f.aimX === 0 && f.aimY > 0 ? 'down' : 'side');

/** Whether a swing's hitbox is out this frame. */
export function isActive(f: FighterState, a: Attack | null): a is Melee {
  return a !== null && a.kind === 'melee' && f.moveFrame > a.startup && f.moveFrame <= a.startup + a.active;
}

/** The nearest fighter in play, or -1. */
export function nearest(m: Match, seat: number): number {
  const me = m.fighters[seat];
  let best = -1;
  let bestD = Infinity;
  m.fighters.forEach((f, i) => {
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
 * An attack's aim: the stick's direction, or with it centred, toward the nearest opponent
 * (one of eight ways), or straight ahead if there's no one.
 */
function aimAt(m: Match, seat: number, action: Input): [number, number] {
  const ax = dirX(action);
  const ay = dirY(action);
  if (ax !== 0 || ay !== 0) return [ax, ay];
  const me = m.fighters[seat];
  const t = nearest(m, seat);
  if (t < 0) return [me.facing, 0];
  const dx = m.fighters[t].x - me.x;
  const dy = m.fighters[t].y - me.y;
  const sx = dx > 0 ? 1 : dx < 0 ? -1 : me.facing;
  const sy = dy > 0 ? 1 : -1;
  if (Math.abs(dy) * 2 <= Math.abs(dx)) return [sx, 0];
  if (Math.abs(dx) * 2 <= Math.abs(dy)) return [0, sy];
  return [sx, sy];
}

function startMove(m: Match, seat: number, move: 1 | 2, ax: number, ay: number) {
  const f = m.fighters[seat];
  f.aimX = ax;
  f.aimY = ay;
  if (ax !== 0) f.facing = ax as 1 | -1;
  f.move = move;
  f.moveFrame = 0;
  f.moveHits = 0;
  f.moveAir = f.platform < 0;
}

/** Throws what's in hand along the aim, harder with a charge, and leaves you bare-handed. */
function throwWeapon(m: Match, seat: number, ax: number, ay: number, power: number) {
  const f = m.fighters[seat];
  const weapon = f.weapon;
  const spec = PROJECTILES.thrown;
  const [ux, uy] = aimVector(ax, ay);
  if (ax !== 0) f.facing = ax as 1 | -1;
  m.projectiles.push({
    kind: 'thrown',
    owner: seat,
    x: f.x + f.facing * 16 * SUB,
    y: f.y - 44 * SUB,
    vx: Math.trunc((ux * spec.speed) / 1000),
    vy: Math.trunc((uy * spec.speed) / 1000) + spec.lob,
    life: spec.life,
    age: 0,
    hits: 0,
    weapon,
    damage: charged(WEAPONS[weapon].heft, power, 100),
    bounced: 0,
  });
  f.weapon = 'fists';
  f.ammo = 0;
  f.lag = THROW_LAG;
}

/** The Attack button: the weapon's attack, or a throw once it's empty. */
function attack(m: Match, seat: number, action: Input) {
  const f = m.fighters[seat];
  const [ax, ay] = aimAt(m, seat, action);
  if (f.weapon !== 'fists' && f.ammo <= 0) return throwWeapon(m, seat, ax, ay, 0);
  startMove(m, seat, 1, ax, ay);
}

/** The heavy, let go: a leap up, a throw (stick pushed, something in hand), or a kick. */
function releaseHeavy(m: Match, seat: number, input: Input, power: number) {
  const f = m.fighters[seat];
  const ax = dirX(input);
  const ay = dirY(input);
  f.power = power;
  if (f.platform < 0 && ax === 0 && ay < 0 && !f.recoveryUsed) {
    f.recoveryUsed = true;
    f.vy = RECOVERY_LEAP;
    startMove(m, seat, 2, 0, -1);
    return;
  }
  if (f.weapon !== 'fists' && (ax !== 0 || ay !== 0)) return throwWeapon(m, seat, ax, ay, power);
  const [kx, ky] = aimAt(m, seat, input);
  startMove(m, seat, 2, kx, ky);
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

function land(m: Match, f: FighterState, index: number, s: Surface) {
  // A bounce pad throws you up instead of letting you stand.
  if (s.bounce) {
    f.y = s.top;
    f.vy = BOUNCE_SPEED;
    f.airJumps = 1;
    f.recoveryUsed = false;
    return;
  }
  f.platform = index;
  f.y = s.top;
  f.vy = 0;
  f.airJumps = 1;
  // Only real ground gives back the leap and the ice: standing on ice doesn't make more.
  if (index < ICE_BASE) {
    f.recoveryUsed = false;
    f.iceUsed = false;
    if (s.crumbles && m.crumble[index] === 0) m.crumble[index] = 1;
  }
  if (f.move && f.moveAir) {
    f.move = 0;
    f.lag = LAND_LAG;
  }
  if (f.hitstun > 0) f.hitstun = Math.trunc(f.hitstun / 2);
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
  f.platform = ICE_BASE + id;
  f.vy = 0;
  f.airJumps = 1;
  f.vx = Math.trunc(f.vx / 2);
}

/** Fires a gun's shots: one, a fan, or a burst along the aim. */
function fire(m: Match, seat: number, shot: Extract<Attack, { kind: 'shot' }>) {
  const f = m.fighters[seat];
  const spec = PROJECTILES[shot.projectile];
  const [ux, uy] = aimVector(f.aimX, f.aimY);
  const x = f.x + f.facing * 22 * SUB;
  const y = f.y - 44 * SUB;
  const add = (vx: number, vy: number, back: number) =>
    m.projectiles.push({
      kind: shot.projectile,
      owner: seat,
      x: x - Math.trunc((ux * back * SUB) / 1000),
      y: y - Math.trunc((uy * back * SUB) / 1000),
      vx,
      vy,
      life: spec.life,
      age: 0,
      hits: 0,
      weapon: null,
      damage: spec.damage,
      bounced: 0,
    });
  const vx = Math.trunc((ux * spec.speed) / 1000);
  const vy = Math.trunc((uy * spec.speed) / 1000) + spec.lob;
  if (shot.fan) {
    // Fanned across the aim: pushed sideways along the line at right angles to it.
    for (const k of shot.fan) add(vx + Math.trunc((-uy * k * spec.speed) / 1000000), vy + Math.trunc((ux * k * spec.speed) / 1000000), 0);
  } else if (shot.burst) {
    for (let i = 0; i < shot.burst.count; i++) add(vx, vy, i * shot.burst.gap);
  } else add(vx, vy, 0);
}

/** One fighter's frame: its input, its movement, and the stage. */
function updateFighter(m: Match, seat: number, input: Input) {
  const f = m.fighters[seat];
  const gravity = stageOf(m).gravity ?? GRAVITY;
  if (!f.alive) {
    // Down: limp, falling, gone from the fight.
    f.deadFor++;
    f.vy = Math.min(f.vy + gravity, MAX_LAUNCH_FALL);
    f.vx = approach(f.vx, 0, 10);
    f.x += f.vx;
    f.y += f.vy;
    return;
  }
  const stage = stageOf(m);
  const pressed = input & ~f.prevInput & ACTIONS;
  const holding = (input & SKILL2) !== 0;
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
  if (f.hazardCooldown > 0) f.hazardCooldown--;
  if (f.dodgeCooldown > 0 && f.dodge === 0) f.dodgeCooldown--;

  // Riding a moving platform: carried along with it.
  if (f.platform >= stage.platforms.length && f.platform < ICE_BASE) {
    const mover = stage.movers[f.platform - stage.platforms.length];
    f.x += (moverAt(mover, m.frame).left - moverAt(mover, m.frame - 1).left) * SUB;
  }

  const busy = f.hitstun > 0 || f.move !== 0 || f.lag > 0 || f.dodge > 0;
  if (f.hitstun > 0) f.hitstun--;
  else if (f.lag > 0) f.lag--;

  // The heavy: held, it charges; let go, it kicks or throws, aimed where the stick points then.
  if (!busy) {
    if (holding) f.charge = Math.min(f.charge + 1, MAX_CHARGE + 1);
    else if (f.charge > 0) {
      const power = Math.min(f.charge - 1, MAX_CHARGE);
      f.charge = 0;
      releaseHeavy(m, seat, input, power);
    }
  }

  if (!busy && f.move === 0 && f.lag === 0 && f.buffer) {
    const action = f.buffer;
    if (action & DODGE) {
      // A dodge drops a charge.
      f.charge = 0;
      dodge(m, seat, action);
    } else if (f.charge > 0) {
      // While charging, other buttons wait (until they go stale).
    } else if (action & SKILL1) attack(m, seat, action);
    else if (action & JUMP) jump(f);
    if (f.charge === 0 || action & DODGE) {
      f.buffer = 0;
      f.bufferAge = 0;
    }
  }

  const dx = dirX(input);

  // Dropping through a soft ledge takes a moment of holding down.
  f.downHeld = input & DOWN ? f.downHeld + 1 : 0;
  if (f.platform >= 0 && surface(m, f.platform)?.soft && f.downHeld >= DROP_HOLD && !f.move && f.hitstun === 0 && f.dodge === 0) {
    f.platform = -1;
    f.dropThrough = 14;
  }

  const move = attackOf(f);
  if (move) {
    if (f.moveFrame === move.startup) {
      if (move.kind === 'melee' && move.lunge) {
        const [ux, uy] = aimVector(f.aimX, f.aimY);
        f.vx = Math.trunc((ux * move.lunge) / 1000);
        if (uy < 0 && f.platform < 0) f.vy = Math.min(f.vy, Math.trunc((uy * move.lunge) / 1000));
      }
      if (f.move === 1) {
        if (move.kind === 'shot') fire(m, seat, move);
        if (f.weapon !== 'fists') f.ammo = Math.max(0, f.ammo - 1);
      }
    }
    f.moveFrame++;
    if (f.moveFrame >= attackFrames(move)) f.move = 0;
  }

  // Run on the ground, drift in the air; a swing on the ground plants the feet; a roll carries on.
  if (f.dodge > 0) {
    f.dodge--;
    f.vx = approach(f.vx, 0, 40);
  }
  const control = f.hitstun === 0 && f.lag === 0 && f.dodge === 0 && (!f.move || f.platform < 0);
  const underfoot = f.platform >= 0 ? surface(m, f.platform) : null;
  const icy = underfoot?.slippery ?? false;
  if (control) {
    const ground = f.platform >= 0;
    // Charging, you can only shuffle along on the ground.
    const target = dx * (ground ? (f.charge > 0 ? Math.trunc(BODY.run / CHARGE_WALK) : BODY.run) : BODY.air);
    f.vx = approach(f.vx, target, ground ? (icy ? ICE_ACCEL : GROUND_ACCEL) : dx === 0 ? 20 : AIR_ACCEL);
    if (ground && dx !== 0 && !f.move) f.facing = dx as 1 | -1;
  } else if (f.dodge > 0) {
    // The roll keeps its own pace.
  } else if (f.platform >= 0) {
    f.vx = approach(f.vx, 0, icy ? ICE_FRICTION : f.hitstun > 0 ? 50 : FRICTION / 2);
  } else {
    f.vx = approach(f.vx, 0, f.hitstun > 0 ? LAUNCH_DRAG : 20);
  }

  // A gust pushes everyone, less so with their feet on the ground.
  const wind = windAt(m);
  if (wind.dir !== 0 && !wind.warning) f.vx += wind.dir * (f.platform >= 0 ? WIND.push / 2 : WIND.push);

  if (f.platform < 0) {
    const cap = f.hitstun > 0 ? MAX_LAUNCH_FALL : input & DOWN && f.vy > 0 ? FAST_FALL : MAX_FALL;
    f.vy = Math.min(f.vy + gravity, Math.max(cap, f.vy));
  }

  // A conveyor carries whoever's on it.
  if (underfoot?.belt) f.x += underfoot.belt;

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
    const all = surfaces(m);
    if (f.vy >= 0) {
      for (const [i, s] of all) {
        if (s.soft && f.dropThrough > 0) continue;
        if (prevY <= s.top && f.y >= s.top && f.x >= s.left && f.x <= s.right) {
          land(m, f, i, s);
          break;
        }
      }
    }
    // Solid ground can't be passed through from the side or below.
    for (const [, s] of all) {
      if (s.soft || f.platform >= 0) continue;
      const left = s.left - HALF_W;
      const right = s.right + HALF_W;
      if (f.x > left && f.x < right && f.y > s.top && f.y - BODY_H * SUB < s.bottom) {
        if (prevTop >= s.bottom) {
          f.y = s.bottom + BODY_H * SUB;
          f.vy = Math.max(f.vy, 0);
        } else if (f.x < (s.left + s.right) / 2) {
          f.x = left;
          f.vx = Math.min(f.vx, 0);
        } else {
          f.x = right;
          f.vx = Math.max(f.vx, 0);
        }
      }
    }
  }
}

/** A swing's hitbox in world sub-units. */
export function hitbox(f: FighterState, a: Melee) {
  const { x, y, w, h } = a.boxes[aimClass(f)];
  const near = f.x + x * SUB * f.facing;
  const far = f.x + (x + w) * SUB * f.facing;
  return { left: Math.min(near, far), right: Math.max(near, far), top: f.y + y * SUB, bottom: f.y + (y + h) * SUB };
}

function overlaps(box: { left: number; right: number; top: number; bottom: number }, f: FighterState) {
  return box.left < f.x + HALF_W && box.right > f.x - HALF_W && box.top < f.y && box.bottom > f.y - BODY_H * SUB;
}

interface Hit {
  by: number;
  target: number;
  damage: number;
  /** Push, in sub-units a frame. */
  push: number;
  angle: Angle;
  /** Which way along x the push goes. */
  side: number;
  /** Extra frames helpless (frozen, or hooked). */
  stun?: number;
}

/** HP off a fighter; at 0 they're out, and whoever hit them last gets the knockout. */
function hurt(m: Match, target: number, damage: number, by: number) {
  const f = m.fighters[target];
  if (!f.alive) return;
  f.hp = Math.max(0, f.hp - damage);
  if (by >= 0 && by !== target) {
    m.fighters[by].dealt += damage;
    f.lastHitBy = by;
  }
  if (f.hp === 0) knockOut(m, f);
}

function applyHit(m: Match, h: Hit) {
  const attacker = m.fighters[h.by];
  const target = m.fighters[h.target];
  if (!target.alive) return;
  const [ax, ay] = ANGLES[h.angle];
  target.vx = Math.trunc((ax * h.push) / 1000) * h.side;
  target.vy = Math.trunc((ay * h.push) / 1000);
  if (target.platform >= 0) {
    // A downward hit on someone standing bounces them up instead.
    if (target.vy > 0) target.vy = -Math.trunc(target.vy / 2);
    if (target.vy < 0) target.platform = -1;
  }
  target.hitstun = 8 + Math.trunc(h.push / 80) + (h.stun ?? 0);
  target.move = 0;
  // A hit knocks the charge out of a held heavy.
  target.charge = 0;
  target.dodge = 0;
  target.iceUsed = false;
  target.lag = 0;
  target.buffer = 0;
  target.bufferAge = 0;
  target.airJumps = 1;
  target.recoveryUsed = false;
  const pause = 2 + Math.trunc(h.damage / 8);
  // The stage's own hazards (a mine, an anvil) have no one to freeze.
  if (attacker) attacker.freeze = Math.max(attacker.freeze, pause);
  target.freeze = pause;
  hurt(m, h.target, h.damage, h.by);
}

/** An explosion: everyone within reach is hurt and thrown away from it, the thrower too. */
function explode(m: Match, p: Projectile, hits: Hit[]) {
  const spec = PROJECTILES[p.kind];
  const radius = spec.radius ?? 0;
  const r = radius * SUB;
  m.blasts.push({ x: p.x, y: p.y, radius, age: 0 });
  m.fighters.forEach((f, t) => {
    if (!inPlay(f) || f.invulnerable > 0) return;
    const cx = f.x;
    const cy = f.y - (BODY_H * SUB) / 2;
    if (Math.abs(cx - p.x) > r + HALF_W || Math.abs(cy - p.y) > r + (BODY_H * SUB) / 2) return;
    const dx = cx - p.x;
    const dy = cy - p.y;
    const side = dx > 0 ? 1 : dx < 0 ? -1 : f.facing;
    const angle: Angle = dy > Math.abs(dx) ? 'spike' : Math.abs(dx) * 2 < Math.abs(dy) ? 'up' : 'diagonal';
    hits.push({ by: p.owner, target: t, damage: spec.damage, push: spec.push, angle, side });
  });
}

/** Whether a point is inside solid ground. */
function inSolid(all: [number, Surface][], x: number, y: number): Surface | null {
  for (const [, s] of all) if (!s.soft && x >= s.left && x <= s.right && y >= s.top && y <= s.bottom) return s;
  return null;
}

/** Shots fly, grenades arc and bounce; each meets the ground, the fighters, or its end. */
function moveProjectiles(m: Match, hits: Hit[]) {
  const all = surfaces(m);
  const wind = windAt(m);
  const stage = stageOf(m);
  const kept: Projectile[] = [];
  for (const p of m.projectiles) {
    const spec = PROJECTILES[p.kind];
    let done = false;
    if (spec.returns !== undefined && p.age === spec.returns) p.hits = 0; // On the way back it can hit again.
    if (spec.returns !== undefined && p.age >= spec.returns) {
      // Back to the thrower, curving round to meet them; caught when it gets there.
      const owner = m.fighters[p.owner];
      if (inPlay(owner)) {
        const dx = owner.x - p.x;
        const dy = owner.y - (BODY_H * SUB) / 2 - p.y;
        // A square root is exact to the last bit in every engine, so this stays the same on every phone.
        const dist = Math.trunc(Math.sqrt(dx * dx + dy * dy));
        if (dist < 30 * SUB) done = true;
        else {
          p.vx = approach(p.vx, Math.trunc((dx * spec.speed) / dist), 160);
          p.vy = approach(p.vy, Math.trunc((dy * spec.speed) / dist), 160);
        }
      }
    }
    p.vy += spec.gravity;
    if (wind.dir !== 0 && !wind.warning && spec.speed < 2500) p.vx += wind.dir * 10;
    p.age++;
    p.life--;

    // A black hole, once it's down, drags everyone near it in, its thrower too.
    if (spec.vortex !== undefined && p.age > 25) {
      const reach = spec.vortex * SUB;
      for (const f of m.fighters) {
        if (!inPlay(f)) continue;
        const dx = p.x - f.x;
        const dy = p.y - (f.y - (BODY_H * SUB) / 2);
        if (Math.abs(dx) + Math.abs(dy) > reach) continue;
        // Slid toward it directly (friction would cancel a push), slower than a run, so you can still get away.
        if (Math.abs(dx) > 4 * SUB) f.x += Math.sign(dx) * VORTEX_PULL;
        if (f.platform < 0) f.vy += Math.sign(dy) * 30;
      }
    }

    // Fast shots move in short steps, so nothing they pass is missed.
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy)) / 1600));
    for (let s = 0; s < steps && !done; s++) {
      const prevY = p.y;
      p.x += Math.trunc(p.vx / steps);
      p.y += Math.trunc(p.vy / steps);

      if (spec.returns === undefined) {
        if (spec.bounces) {
          for (const [, g] of all) {
            if (p.x < g.left || p.x > g.right) continue;
            if (prevY <= g.top && p.y >= g.top && p.vy > 0) {
              p.y = g.top;
              if (spec.settles) {
                // A peel (or a black hole) lands flat and stays put.
                p.vx = 0;
                p.vy = 0;
                continue;
              }
              p.vy = -Math.trunc((p.vy * 55) / 100);
              p.vx = Math.trunc((p.vx * 80) / 100);
            } else if (!g.soft && p.y > g.top && p.y < g.bottom) {
              p.vx = -p.vx;
              p.x += Math.trunc(p.vx / steps);
            }
          }
        } else {
          const wall = inSolid(all, p.x, p.y);
          if (wall && spec.ricochet !== undefined && p.bounced < spec.ricochet) {
            // Off the wall: back to where it was, turned round on the side it struck.
            const fromX = p.x - Math.trunc(p.vx / steps);
            const fromY = p.y - Math.trunc(p.vy / steps);
            if (fromX >= wall.left && fromX <= wall.right) p.vy = -p.vy;
            else p.vx = -p.vx;
            p.x = fromX;
            p.y = fromY;
            p.bounced++;
            p.hits = 0;
          } else if (wall) {
            if (spec.radius !== undefined) explode(m, p, hits);
            done = true;
            break;
          }
        }
      }

      m.fighters.forEach((f, t) => {
        // A settled peel trips its own thrower as readily as anyone.
        const ownSafe = t === p.owner && !(spec.trap && p.age > TRAP_SETTLE);
        if (done || ownSafe || spec.vortex !== undefined || !inPlay(f) || f.invulnerable > 0 || p.hits & (1 << t)) return;
        const size = (spec.size ?? 6) * SUB;
        if (!overlaps({ left: p.x - size, right: p.x + size, top: p.y - size, bottom: p.y + size }, f)) return;
        if (spec.radius !== undefined) {
          // A grenade thrown a moment ago doesn't go off in the thrower's own face; a rocket goes off at once.
          if (!spec.bounces || p.age > 6) {
            explode(m, p, hits);
            done = true;
          }
          return;
        }
        p.hits |= 1 << t;
        const going = p.vx > 0 ? 1 : p.vx < 0 ? -1 : f.facing;
        // A harpoon reels them in, back the way it came.
        const side = spec.pull ? -going : going;
        const angle: Angle = spec.angle ?? (Math.abs(p.vx) * 2 < Math.abs(p.vy) ? (p.vy < 0 ? 'up' : 'spike') : 'low');
        hits.push({ by: p.owner, target: t, damage: p.damage, push: spec.push, angle, side, stun: spec.stun });
        if (!spec.pierce) done = true;
      });
    }

    if (!done && p.life <= 0) {
      if (spec.radius !== undefined) explode(m, p, hits);
      done = true;
    }
    const x = p.x / SUB;
    const y = p.y / SUB;
    if (x < stage.blast.left || x > stage.blast.right || y < stage.blast.top || y > stage.blast.bottom) done = true;
    if (!done) kept.push(p);
  }
  m.projectiles = kept;
}

/** Weapons drop onto the stage now and then, from the match's seed: the same on every phone. */
function dropWeapons(m: Match) {
  m.items = m.items.map((it) => ({ ...it, age: it.age + 1 })).filter((it) => it.age < ITEM_LIFE);
  if (m.between > 0 || m.frame < m.nextItem) return;
  const roll = stream(`${m.seed}:item:${m.dropped}`);
  m.dropped++;
  m.nextItem = m.frame + ITEM_GAP + roll(ITEM_GAP_SPREAD);
  if (m.items.length >= MAX_ITEMS) return;
  const weapon = PICKUPS[roll(PICKUPS.length)];
  const stage = stageOf(m);
  const spots = stage.platforms.map((_, i) => i).filter((i) => !stage.platforms[i].bounce && !isGone(m, i));
  if (spots.length === 0) return;
  const p = stage.platforms[spots[roll(spots.length)]];
  const width = Math.max(0, p.right - p.left - 40);
  m.items.push({ weapon, x: (p.left + 20 + roll(width + 1)) * SUB, y: p.top * SUB, age: 0 });
}

function pickUp(m: Match) {
  m.fighters.forEach((f) => {
    if (!inPlay(f) || f.weapon !== 'fists' || f.move) return;
    const i = m.items.findIndex((it) => Math.abs(it.x - f.x) <= PICK_RANGE * SUB && it.y <= f.y + 10 * SUB && it.y >= f.y - BODY_H * SUB);
    if (i < 0) return;
    f.weapon = m.items[i].weapon;
    f.ammo = WEAPONS[f.weapon].ammo;
    m.items.splice(i, 1);
  });
}

/** Lava burns and throws you up; spikes hurt and push you off. */
function hazards(m: Match) {
  const hazard = stageOf(m).hazard;

  // Mines: a fighter's feet on one sets it off; it re-arms after a while.
  if (hazard.kind === 'mines') {
    hazard.xs.forEach((mx, i) => {
      if (m.mines[i] > 0) return;
      const stepped = m.fighters.some((f) => inPlay(f) && Math.abs(f.x - mx * SUB) < 20 * SUB && Math.abs(f.y - hazard.y * SUB) < 12 * SUB);
      if (!stepped) return;
      m.mines[i] = MINE_REARM;
      const blast: Hit[] = [];
      explode(m, { kind: 'mine', owner: -1, x: mx * SUB, y: (hazard.y - 10) * SUB, vx: 0, vy: 0, life: 0, age: 0, hits: 0, weapon: null, damage: 0, bounced: 0 }, blast);
      for (const h of blast) applyHit(m, h);
    });
  }
  m.fighters.forEach((f, i) => {
    if (!inPlay(f) || f.hazardCooldown > 0) return;
    if (hazard.kind === 'lava' && f.y > hazard.top * SUB) {
      f.hazardCooldown = HAZARD_COOLDOWN;
      f.vy = LAVA_BOUNCE;
      f.platform = -1;
      f.airJumps = 1;
      f.recoveryUsed = false;
      hurt(m, i, LAVA_DAMAGE, f.lastHitBy);
    }
    if (hazard.kind === 'lasers') {
      for (const beam of hazard.beams) {
        if (beamAt(beam, m.frame) !== 'on') continue;
        const box = { left: beam.left * SUB, right: beam.right * SUB, top: (beam.y - 4) * SUB, bottom: (beam.y + 4) * SUB };
        if (!overlaps(box, f)) continue;
        f.hazardCooldown = HAZARD_COOLDOWN;
        f.vy = -1500;
        f.platform = -1;
        f.hitstun = Math.max(f.hitstun, 16);
        f.airJumps = 1;
        f.recoveryUsed = false;
        hurt(m, i, LASER_DAMAGE, f.lastHitBy);
        break;
      }
    }
    if (hazard.kind === 'saws') {
      for (const saw of hazard.saws) {
        const c = sawAt(saw, m.frame);
        const r = saw.radius * SUB;
        const box = { left: c.x * SUB - r, right: c.x * SUB + r, top: c.y * SUB - r, bottom: c.y * SUB + r };
        if (!overlaps(box, f)) continue;
        f.hazardCooldown = HAZARD_COOLDOWN;
        f.vx = (f.x < c.x * SUB ? -1 : 1) * 900;
        f.vy = -1300;
        f.platform = -1;
        f.hitstun = Math.max(f.hitstun, 16);
        f.airJumps = 1;
        f.recoveryUsed = false;
        hurt(m, i, SAW_DAMAGE, f.lastHitBy);
        break;
      }
    }
    if (hazard.kind === 'spikes') {
      for (const s of hazard.strips) {
        const box = { left: s.left * SUB, right: s.right * SUB, top: s.top * SUB, bottom: s.bottom * SUB };
        if (!overlaps(box, f)) continue;
        f.hazardCooldown = HAZARD_COOLDOWN;
        const above = f.y - (BODY_H * SUB) / 2 < (box.top + box.bottom) / 2;
        f.vy = above ? -1800 : 900;
        f.vx = (f.x < (box.left + box.right) / 2 ? -1 : 1) * 500;
        f.platform = -1;
        f.airJumps = 1;
        f.recoveryUsed = false;
        hurt(m, i, SPIKE_DAMAGE, f.lastHitBy);
        break;
      }
    }
  });
}

function knockOut(m: Match, f: FighterState) {
  if (!f.alive) return;
  f.alive = false;
  f.hp = 0;
  f.deadFor = 0;
  f.falls++;
  if (f.lastHitBy >= 0) m.fighters[f.lastHitBy].kos++;
  f.platform = -1;
  f.move = 0;
  f.charge = 0;
  f.dodge = 0;
  // Go limp, with a last little hop.
  f.vy = Math.min(f.vy, -600);
}

/** One frame of the fight, from every seat's input. Returns a new match; the old one is untouched. */
export function step(match: Match, inputs: readonly Input[]): Match {
  if (match.winner !== null) return match;
  const m: Match = {
    ...match,
    frame: match.frame + 1,
    fighters: match.fighters.map((f) => ({ ...f })),
    wins: [...match.wins],
    crumble: match.crumble.map((c) => (c === 0 ? 0 : c + 1 >= CRACK + GONE ? 0 : c + 1)),
    mines: match.mines.map((t) => Math.max(0, t - 1)),
    items: match.items,
    projectiles: match.projectiles.map((p) => ({ ...p })),
    blasts: match.blasts.map((b) => ({ ...b, age: b.age + 1 })).filter((b) => b.age < BLAST_FRAMES),
    // Ice melts; anyone on a floor that's gone simply falls.
    ice: match.ice.map((i) => ({ ...i, life: i.life - 1 })).filter((i) => i.life > 0),
  };

  m.fighters.forEach((_, i) => updateFighter(m, i, inputs[i] ?? 0));

  dropWeapons(m);
  pickUp(m);

  // Anvil Rain: one drops from the sky every so often, somewhere seeded.
  const hz = stageOf(m).hazard;
  if (hz.kind === 'anvils' && m.between === 0 && m.frame % hz.every === 0) {
    const x = hz.left + stream(`${m.seed}:anvil:${m.frame}`)(hz.right - hz.left + 1);
    m.projectiles.push({ kind: 'anvil', owner: -1, x: x * SUB, y: (stageOf(m).blast.top + 60) * SUB, vx: 0, vy: 0, life: PROJECTILES.anvil.life, age: 0, hits: 0, weapon: null, damage: PROJECTILES.anvil.damage, bounced: 0 });
  }

  // Every hit is found before any lands, so two swings that meet both connect.
  const hits: Hit[] = [];
  m.fighters.forEach((attacker, a) => {
    if (!inPlay(attacker) || attacker.freeze > 0) return;
    const move = attackOf(attacker);
    if (!isActive(attacker, move)) return;
    const box = hitbox(attacker, move);
    const aim = aimClass(attacker);
    const reachesBack = move.boxes[aim].x < 0;
    const kick = attacker.move === 2;
    m.fighters.forEach((target, t) => {
      if (t === a || !inPlay(target) || target.invulnerable > 0) return;
      if (attacker.moveHits & (1 << t)) return;
      if (!overlaps(box, target)) return;
      attacker.moveHits |= 1 << t;
      const away = !reachesBack || target.x === attacker.x ? attacker.facing : target.x > attacker.x ? 1 : -1;
      // A hook drags them back in, toward you.
      const side = move.pull ? -away : away;
      hits.push({
        by: a,
        target: t,
        damage: kick ? charged(move.damage, attacker.power, 100) : move.damage,
        push: kick ? charged(move.push, attacker.power, 60) : move.push,
        angle: move.angles[aim],
        side,
        stun: move.stun,
      });
    });
  });
  moveProjectiles(m, hits);
  for (const h of hits) applyHit(m, h);
  hazards(m);

  // Off the edge of the world: out.
  const blast = stageOf(m).blast;
  m.fighters.forEach((f) => {
    if (!f.alive) return;
    const x = f.x / SUB;
    const y = f.y / SUB;
    if (x < blast.left || x > blast.right || y < blast.top || y > blast.bottom) knockOut(m, f);
  });

  // The round: over when one (or none) is left; after a pause, the next, or the match is won.
  if (m.between > 0) {
    if (--m.between === 0) {
      const w = m.roundWinner ?? -1;
      if (w >= 0 && m.wins[w] >= ROUNDS_TO_WIN) m.winner = w;
      else startRound(m, m.round + 1);
    }
  } else {
    const standing = m.fighters.flatMap((f, i) => (f.alive ? [i] : []));
    if (standing.length <= 1) {
      m.roundWinner = standing.length === 1 ? standing[0] : -1;
      if (standing.length === 1) m.wins[standing[0]]++;
      m.between = ROUND_BREAK;
    }
  }
  return m;
}

/** A fingerprint of the whole match, to check two runs (or two phones) agree. */
export const hashState = (m: Match) => hashSeed(JSON.stringify(m)).toString(16);
