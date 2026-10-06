import { DODGE, DOWN, HEAVY, JUMP, LEFT, LIGHT, RIGHT, UP, type Input } from './input';

/**
 * One thumb, turned into a fighter's input. The thumb lands anywhere in the bottom of the
 * screen, and that spot becomes a stick:
 *
 * - drag left or right to run; drag up to jump (back down and up again for the air jump);
 *   hold down to fast-fall or drop through a ledge;
 * - tap for a light attack; flick sideways or down and let go for one aimed that way;
 * - press and hold still, then let go for a heavy, aimed by where the thumb is at release
 *   (up is the recovery);
 * - tap twice quickly to dodge, aimed by a drag on the second tap.
 *
 * Pure: times come in as numbers, so every gesture can be tested. Thresholds are in CSS
 * pixels and milliseconds, gathered here to tune.
 */
export const GESTURE = {
  /** How far before a drag counts as a direction. */
  dead: 14,
  down: 26,
  jump: 30,
  /** Back within this of the start (vertically) to jump again. */
  rearm: 12,
  tapMs: 180,
  tapPx: 12,
  flickMs: 230,
  flickPx: 26,
  holdMs: 260,
  holdPx: 12,
  doubleMs: 230,
  doublePx: 60,
  dodgeAimMs: 110,
  /** The stick's start follows a thumb that drifts further than this. */
  leash: 70,
};

export interface Touch {
  id: number;
  ox: number;
  oy: number;
  t0: number;
  x: number;
  y: number;
  moved: boolean;
  charging: boolean;
  jumpArmed: boolean;
  /** A second tap: a dodge, waiting a moment for a direction. */
  dodgeAt: number | null;
  /** Already spent on a dodge: letting go does nothing more. */
  spent: boolean;
}

export interface Gesture {
  touch: Touch | null;
  lastTap: { t: number; x: number; y: number } | null;
}

export const idle = (): Gesture => ({ touch: null, lastTap: null });

export interface Result {
  g: Gesture;
  /** A press to send this frame, with its aim, or 0. */
  out: Input;
}

/** The direction of a drag, or 0 inside the dead zone. Only the stronger axis when `single`. */
function direction(dx: number, dy: number, single: boolean): Input {
  const { dead, down } = GESTURE;
  if (single) {
    if (Math.abs(dx) < dead && Math.abs(dy) < dead) return 0;
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? RIGHT : LEFT;
    return dy > 0 ? DOWN : UP;
  }
  let bits = 0;
  if (dx > dead) bits |= RIGHT;
  if (dx < -dead) bits |= LEFT;
  if (dy > down) bits |= DOWN;
  if (dy < -dead) bits |= UP;
  return bits;
}

export function press(g: Gesture, id: number, x: number, y: number, t: number): Result {
  // A second finger is ignored; the same pointer pressing again means its lift was missed.
  if (g.touch && g.touch.id !== id) return { g, out: 0 };
  const last = g.lastTap;
  const second = last !== null && t - last.t <= GESTURE.doubleMs && Math.abs(x - last.x) + Math.abs(y - last.y) <= GESTURE.doublePx;
  return {
    g: {
      lastTap: second ? null : last,
      touch: { id, ox: x, oy: y, t0: t, x, y, moved: false, charging: false, jumpArmed: true, dodgeAt: second ? t : null, spent: false },
    },
    out: 0,
  };
}

export function drag(g: Gesture, id: number, x: number, y: number): Result {
  const touch = g.touch;
  if (!touch || touch.id !== id) return { g, out: 0 };
  const next = { ...touch, x, y };
  let out = 0;
  let dx = x - next.ox;
  let dy = y - next.oy;

  if (next.dodgeAt !== null) {
    const aim = direction(dx, dy, false);
    if (aim) {
      next.dodgeAt = null;
      next.spent = true;
      out = DODGE | aim;
    }
    return { g: { ...g, touch: next }, out };
  }

  if (!next.charging) {
    if (Math.abs(dx) + Math.abs(dy) > GESTURE.holdPx) next.moved = true;
    if (next.jumpArmed && dy < -GESTURE.jump) {
      next.jumpArmed = false;
      out = JUMP;
    } else if (!next.jumpArmed && dy > -GESTURE.rearm) {
      next.jumpArmed = true;
    }
    // A thumb that wanders far drags the stick's centre along, so it never runs out of room.
    const far = Math.max(Math.abs(dx), Math.abs(dy));
    if (far > GESTURE.leash) {
      const pull = (far - GESTURE.leash) / far;
      next.ox += dx * pull;
      next.oy += dy * pull;
      dx = x - next.ox;
      dy = y - next.oy;
    }
  }
  return { g: { ...g, touch: next }, out };
}

/** Called every frame: a still thumb becomes a charge, a second tap with no aim a spot dodge. */
export function tick(g: Gesture, t: number): Result {
  const touch = g.touch;
  if (!touch) return { g, out: 0 };
  if (touch.dodgeAt !== null) {
    if (t - touch.dodgeAt < GESTURE.dodgeAimMs) return { g, out: 0 };
    return { g: { ...g, touch: { ...touch, dodgeAt: null, spent: true } }, out: DODGE };
  }
  if (!touch.moved && !touch.charging && !touch.spent && t - touch.t0 >= GESTURE.holdMs) {
    return { g: { ...g, touch: { ...touch, charging: true } }, out: 0 };
  }
  return { g, out: 0 };
}

export function release(g: Gesture, id: number, x: number, y: number, t: number): Result {
  const touch = g.touch;
  if (!touch || touch.id !== id) return { g, out: 0 };
  const done: Gesture = { touch: null, lastTap: g.lastTap };
  const dx = x - touch.ox;
  const dy = y - touch.oy;
  const held = t - touch.t0;
  const travel = Math.abs(x - touch.ox) + Math.abs(y - touch.oy);

  if (touch.dodgeAt !== null) return { g: done, out: DODGE };
  if (touch.spent) return { g: done, out: 0 };
  if (touch.charging) return { g: done, out: HEAVY | direction(dx, dy, true) };
  if (held <= GESTURE.tapMs && travel <= GESTURE.tapPx) return { g: { touch: null, lastTap: { t, x, y } }, out: LIGHT };
  if (held <= GESTURE.flickMs && travel >= GESTURE.flickPx) {
    const aim = direction(dx, dy, true);
    // An upward flick has already jumped.
    if (aim === UP) return { g: done, out: 0 };
    return { g: done, out: LIGHT | aim };
  }
  return { g: done, out: 0 };
}

/** The directions held this frame: none while charging or waiting on a dodge. */
export function held(g: Gesture): Input {
  const touch = g.touch;
  if (!touch || touch.charging || touch.dodgeAt !== null) return 0;
  return direction(touch.x - touch.ox, touch.y - touch.oy, false);
}

/** How far a charge has come, 0–1, for the ring under the thumb. */
export function charge(g: Gesture, t: number): number {
  const touch = g.touch;
  if (!touch || touch.moved || touch.spent || touch.dodgeAt !== null) return 0;
  return Math.min(1, (t - touch.t0) / GESTURE.holdMs);
}
