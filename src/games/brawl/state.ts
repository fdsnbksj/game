import { hashSeed } from '../../shared/random';
import { ANGLES, FIGHTERS, totalFrames, type FighterId, type Move, type MoveId } from './fighters';
import { ACTIONS, DIRS, DODGE, DOWN, HEAVY, JUMP, LIGHT, UP, dirX, type Input } from './input';
import { BLAST, BODY_H, BODY_W, PLATFORMS, RESPAWN, SPAWNS, SUB } from './stage';

/**
 * Sky Brawl, frame by frame. `step(match, inputs)` moves the fight on by one 60th of a
 * second and is the whole game: no clock, no randomness, whole numbers only, so the same
 * inputs make the same fight on every device. That is what lets a match be saved and
 * resumed, and later lets two phones run the same fight from each other's inputs.
 */

/** Bump when a change would make old saved matches play differently. */
export const BRAWL_VERSION = 1;

export const STOCKS = 3;

/** 0 is a person; 1–3 are bots, easy to hard. */
export type BotLevel = 0 | 1 | 2 | 3;

export interface Seat {
  fighter: FighterId;
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
  /** The platform stood on, or -1 in the air. */
  platform: number;
  airJumps: number;
  recoveryUsed: boolean;
  move: MoveId | null;
  moveFrame: number;
  /** Seats this move has already hit, as bits, so one swing hits each fighter once. */
  moveHits: number;
  hitstun: number;
  /** Frames of landing lag after an air move. */
  lag: number;
  dodge: number;
  dodgeCooldown: number;
  invulnerable: number;
  /** The hit-pause: a few frames frozen when a hit lands, so it reads. */
  freeze: number;
  /** Frames left out of the fight after a KO; while 0, in play. */
  respawn: number;
  dropThrough: number;
  downHeld: number;
  prevInput: Input;
  /** An action pressed while busy, kept a few frames, with the direction it was aimed. */
  buffer: Input;
  bufferAge: number;
  lastHitBy: number;
  kos: number;
  falls: number;
  /** Damage dealt, for the summary at the end. */
  dealt: number;
}

export interface Match {
  v: number;
  seed: string;
  frame: number;
  seats: Seat[];
  fighters: FighterState[];
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
const DODGE_FRAMES = 18;
const DODGE_SPEED = 900;
const DODGE_COOLDOWN = 54;
const SPOT_DODGE_COOLDOWN = 30;
const BUFFER_FRAMES = 8;
const RESPAWN_FRAMES = 75;
const RESPAWN_INVULNERABLE = 120;
const DROP_HOLD = 10;
const HALF_W = (BODY_W / 2) * SUB;

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
        move: null,
        moveFrame: 0,
        moveHits: 0,
        hitstun: 0,
        lag: 0,
        dodge: 0,
        dodgeCooldown: 0,
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
    winner: null,
  };
}

export const inPlay = (f: FighterState) => f.stocks > 0 && f.respawn === 0;

/** Moves a value toward a target by at most `by`. */
const approach = (value: number, target: number, by: number) => (value < target ? Math.min(target, value + by) : Math.max(target, value - by));

export function moveOf(m: Match, seat: number): Move | null {
  const f = m.fighters[seat];
  return f.move ? FIGHTERS[m.seats[seat].fighter].moves[f.move] : null;
}

/** Whether the move's hitbox is out this frame. */
export function isActive(f: FighterState, move: Move | null) {
  return move !== null && f.moveFrame > move.startup && f.moveFrame <= move.startup + move.active;
}

/** The move a press makes, from where the fighter is and the direction it was aimed. */
export function chooseMove(f: FighterState, action: Input): MoveId | null {
  const side = dirX(action) !== 0;
  const grounded = f.platform >= 0;
  if (action & LIGHT) {
    if (grounded) return side ? 'sLight' : action & DOWN ? 'dLight' : 'nLight';
    return side ? 'sAir' : action & DOWN ? 'dAir' : 'nAir';
  }
  if (grounded) {
    if (action & UP) return 'recovery';
    return side ? 'sSig' : action & DOWN ? 'dSig' : 'nSig';
  }
  if (action & DOWN) return 'pound';
  return f.recoveryUsed ? null : 'recovery';
}

function startMove(f: FighterState, id: MoveId, action: Input) {
  const dx = dirX(action);
  if (dx !== 0) f.facing = dx as 1 | -1;
  f.move = id;
  f.moveFrame = 0;
  f.moveHits = 0;
  if (id === 'recovery') f.recoveryUsed = true;
}

function startDodge(f: FighterState, action: Input) {
  f.dodge = DODGE_FRAMES;
  f.invulnerable = Math.max(f.invulnerable, DODGE_FRAMES);
  const dx = dirX(action);
  const dy = (action & DOWN ? 1 : 0) - (action & UP ? 1 : 0);
  const grounded = f.platform >= 0;
  if (dx === 0 && dy === 0) {
    f.vx = 0;
    if (!grounded) f.vy = 0;
    f.dodgeCooldown = SPOT_DODGE_COOLDOWN;
    return;
  }
  // A diagonal moves about as far as a straight dodge (707 ≈ 1000/√2).
  const scale = dx !== 0 && dy !== 0 ? 707 : 1000;
  f.vx = Math.trunc((dx * DODGE_SPEED * scale) / 1000);
  f.vy = grounded ? 0 : Math.trunc((dy * DODGE_SPEED * scale) / 1000);
  if (dy < 0) f.platform = -1;
  f.dodgeCooldown = DODGE_COOLDOWN;
}

function jump(f: FighterState, seat: Seat) {
  const fighter = FIGHTERS[seat.fighter];
  if (f.platform >= 0) {
    f.vy = fighter.jump;
    f.platform = -1;
  } else if (f.airJumps > 0) {
    f.airJumps--;
    f.vy = fighter.airJump;
  }
}

function land(f: FighterState, index: number, move: Move | null) {
  f.platform = index;
  f.y = PLATFORMS[index].top * SUB;
  f.vy = 0;
  f.airJumps = 1;
  f.recoveryUsed = false;
  if (move?.land !== undefined) {
    f.move = null;
    f.lag = move.land;
  }
  if (f.hitstun > 0) f.hitstun = Math.trunc(f.hitstun / 2);
}

/** One fighter's frame: its input, its movement, and the stage. */
function updateFighter(f: FighterState, seat: Seat, input: Input) {
  const fighter = FIGHTERS[seat.fighter];
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
  if (f.dodgeCooldown > 0 && f.dodge === 0) f.dodgeCooldown--;
  if (f.dropThrough > 0) f.dropThrough--;

  const busy = f.hitstun > 0 || f.move !== null || f.dodge > 0 || f.lag > 0;
  if (f.hitstun > 0) f.hitstun--;
  else if (f.lag > 0) f.lag--;

  if (!busy && f.buffer) {
    const action = f.buffer;
    f.buffer = 0;
    f.bufferAge = 0;
    if (action & DODGE) {
      if (f.dodgeCooldown === 0) startDodge(f, action);
    } else if (action & (LIGHT | HEAVY)) {
      const id = chooseMove(f, action);
      if (id) startMove(f, id, action);
    } else if (action & JUMP) {
      jump(f, seat);
    }
  }

  const grounded = f.platform >= 0;
  const move = f.move ? fighter.moves[f.move] : null;
  const dx = dirX(input);

  // Dropping through a soft ledge takes a moment of holding down, so a quick down-strike doesn't.
  f.downHeld = input & DOWN ? f.downHeld + 1 : 0;
  if (grounded && PLATFORMS[f.platform].soft && f.downHeld >= DROP_HOLD && !f.move && f.dodge === 0 && f.hitstun === 0) {
    f.platform = -1;
    f.dropThrough = 14;
  }

  if (f.dodge > 0) {
    f.dodge--;
    f.vx = approach(f.vx, 0, 40);
    f.vy = f.platform >= 0 ? 0 : approach(f.vy, 0, 40);
  } else {
    if (move) {
      if (f.moveFrame === move.startup) {
        if (move.lunge) f.vx = move.lunge * f.facing;
        if (move.leap) {
          f.vy = move.leap;
          if (move.leap < 0) f.platform = -1;
        }
      }
      f.moveFrame++;
      if (f.moveFrame >= totalFrames(move)) f.move = null;
    }

    const control = f.hitstun === 0 && f.lag === 0 && (!move || move.land !== undefined);
    if (control) {
      const ground = f.platform >= 0;
      const target = dx * (ground ? fighter.run : fighter.air);
      f.vx = approach(f.vx, target, ground ? GROUND_ACCEL : dx === 0 ? 20 : AIR_ACCEL);
      if (ground && dx !== 0 && !move) f.facing = dx as 1 | -1;
    } else if (f.platform >= 0) {
      f.vx = approach(f.vx, 0, f.hitstun > 0 ? 50 : FRICTION / 2);
    } else {
      f.vx = approach(f.vx, 0, f.hitstun > 0 ? LAUNCH_DRAG : 20);
    }

    if (f.platform < 0) {
      const cap = f.hitstun > 0 ? MAX_LAUNCH_FALL : input & DOWN && f.vy > 0 && f.move !== 'pound' ? FAST_FALL : f.move === 'pound' ? 1800 : MAX_FALL;
      f.vy = Math.min(f.vy + GRAVITY, Math.max(cap, f.vy));
    }
  }

  // Move, then meet the stage.
  const prevY = f.y;
  const prevTop = f.y - BODY_H * SUB;
  f.x += f.vx;
  f.y += f.vy;

  if (f.platform >= 0) {
    const p = PLATFORMS[f.platform];
    if (f.x < p.left * SUB || f.x > p.right * SUB) f.platform = -1;
    else {
      f.y = p.top * SUB;
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
          land(f, i, f.move ? fighter.moves[f.move] : null);
          break;
        }
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

/** A hitbox in world sub-units. */
export function hitbox(f: FighterState, move: Move) {
  const { x, y, w, h } = move.box;
  const near = f.x + x * SUB * f.facing;
  const far = f.x + (x + w) * SUB * f.facing;
  return { left: Math.min(near, far), right: Math.max(near, far), top: f.y + y * SUB, bottom: f.y + (y + h) * SUB };
}

function overlaps(box: { left: number; right: number; top: number; bottom: number }, f: FighterState) {
  return box.left < f.x + HALF_W && box.right > f.x - HALF_W && box.top < f.y && box.bottom > f.y - BODY_H * SUB;
}

/** Knockback speed for a hit at the target's damage (after the hit), in sub-units a frame. */
export function knockback(move: Move, damage: number, weight: number) {
  return Math.trunc(((move.base + damage * move.growth) * 100) / weight);
}

function hit(attacker: FighterState, a: number, target: FighterState, t: number, move: Move, weight: number) {
  attacker.moveHits |= 1 << t;
  target.damage = Math.min(999, target.damage + move.damage);
  attacker.dealt += move.damage;
  const speed = knockback(move, target.damage, weight);
  const [ax, ay] = ANGLES[move.angle];
  // Moves reaching behind the body (an overhead, a sweep) send a fighter the way they were from you.
  const side = move.box.x >= 0 || target.x === attacker.x ? attacker.facing : target.x > attacker.x ? 1 : -1;
  target.vx = Math.trunc((ax * speed) / 1000) * side;
  target.vy = Math.trunc((ay * speed) / 1000);
  if (target.platform >= 0) {
    // A downward hit on someone standing bounces them up instead.
    if (target.vy > 0) target.vy = -Math.trunc(target.vy / 2);
    if (target.vy < 0) target.platform = -1;
  }
  target.hitstun = 8 + Math.trunc(speed / 60);
  target.move = null;
  target.dodge = 0;
  target.lag = 0;
  target.buffer = 0;
  target.bufferAge = 0;
  target.airJumps = 1;
  target.recoveryUsed = false;
  target.lastHitBy = a;
  const pause = 3 + Math.trunc(move.damage / 3);
  attacker.freeze = Math.max(attacker.freeze, pause);
  target.freeze = pause;
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
  f.move = null;
  f.hitstun = 0;
  f.lag = 0;
  f.dodge = 0;
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
  f.dodgeCooldown = 0;
}

/** One frame of the fight, from every seat's input. Returns a new match; the old one is untouched. */
export function step(match: Match, inputs: readonly Input[]): Match {
  if (match.winner !== null) return match;
  const m: Match = { ...match, frame: match.frame + 1, fighters: match.fighters.map((f) => ({ ...f })) };

  m.fighters.forEach((f, i) => {
    if (f.stocks <= 0) return;
    if (f.respawn > 0) {
      f.prevInput = inputs[i] ?? 0;
      if (--f.respawn === 0) comeBack(f);
      return;
    }
    updateFighter(f, m.seats[i], inputs[i] ?? 0);
  });

  // Every hit is found before any lands, so two swings that meet both connect.
  const hits: { a: number; t: number; move: Move }[] = [];
  m.fighters.forEach((attacker, a) => {
    if (!inPlay(attacker) || attacker.freeze > 0) return;
    const move = moveOf(m, a);
    if (!move || !isActive(attacker, move)) return;
    const box = hitbox(attacker, move);
    m.fighters.forEach((target, t) => {
      if (t === a || !inPlay(target) || target.invulnerable > 0 || target.dodge > 0) return;
      if (attacker.moveHits & (1 << t)) return;
      if (overlaps(box, target)) hits.push({ a, t, move });
    });
  });
  for (const { a, t, move } of hits) hit(m.fighters[a], a, m.fighters[t], t, move, FIGHTERS[m.seats[t].fighter].weight);

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
