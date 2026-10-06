import { DOWN, JUMP, LEFT, RIGHT, SKILL1, SKILL2, UP, type Input } from './input';

/**
 * One thumb, turned into a fighter's input. The thumb lands anywhere in the bottom of the
 * screen:
 *
 * - drag left or right to run, down to fall fast or drop through a ledge;
 * - tap to jump (tap again in the air for the second jump);
 * - double tap for the weapon's quick skill; swipe on the second tap to aim it;
 * - press and hold still for the strong skill: it charges, a drag aims it, letting go fires.
 *
 * A skill with no swipe aims itself at the nearest opponent (the engine does that), so
 * tapping works from the start and aiming is the skill to learn.
 *
 * Pure: times come in as numbers, so every gesture can be tested. Thresholds are in CSS
 * pixels and milliseconds, gathered here to tune.
 */
export const GESTURE = {
  /** How far before a drag counts as a direction. */
  dead: 14,
  down: 26,
  tapMs: 200,
  tapPx: 14,
  holdMs: 250,
  holdPx: 12,
  /** A second tap this soon after the first is a double tap. */
  doubleMs: 240,
  doublePx: 70,
  /** How long a double tap waits for a swipe to aim it before firing at the nearest opponent. */
  aimMs: 120,
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
  /** A second tap: skill 1, waiting a moment for a swipe to aim it. */
  skillAt: number | null;
  /** Already spent on a skill: letting go does nothing more, moving still runs. */
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

/** The direction of a drag, or 0 inside the dead zone. `aim` allows all eight ways evenly. */
function direction(dx: number, dy: number, aim: boolean): Input {
  const { dead, down } = GESTURE;
  if (aim) {
    if (Math.abs(dx) < dead && Math.abs(dy) < dead) return 0;
    let bits = 0;
    if (Math.abs(dx) * 2 > Math.abs(dy)) bits |= dx > 0 ? RIGHT : LEFT;
    if (Math.abs(dy) * 2 > Math.abs(dx)) bits |= dy > 0 ? DOWN : UP;
    return bits;
  }
  let bits = 0;
  if (dx > dead) bits |= RIGHT;
  if (dx < -dead) bits |= LEFT;
  if (dy > down) bits |= DOWN;
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
      touch: { id, ox: x, oy: y, t0: t, x, y, moved: false, charging: false, skillAt: second ? t : null, spent: false },
    },
    out: 0,
  };
}

export function drag(g: Gesture, id: number, x: number, y: number): Result {
  const touch = g.touch;
  if (!touch || touch.id !== id) return { g, out: 0 };
  const next = { ...touch, x, y };
  const dx = x - next.ox;
  const dy = y - next.oy;

  // The second tap of a double tap, swiped: skill 1 that way, at once.
  if (next.skillAt !== null) {
    const aim = direction(dx, dy, true);
    if (!aim) return { g: { ...g, touch: next }, out: 0 };
    next.skillAt = null;
    next.spent = true;
    next.ox = x;
    next.oy = y;
    return { g: { ...g, touch: next }, out: SKILL1 | aim };
  }

  if (!next.charging) {
    if (Math.abs(dx) + Math.abs(dy) > GESTURE.holdPx) next.moved = true;
    // A thumb that wanders far drags the stick's centre along, so it never runs out of room.
    const far = Math.max(Math.abs(dx), Math.abs(dy));
    if (far > GESTURE.leash) {
      const pull = (far - GESTURE.leash) / far;
      next.ox += dx * pull;
      next.oy += dy * pull;
    }
  }
  return { g: { ...g, touch: next }, out: 0 };
}

/** Called every frame: a still thumb starts charging; an unswiped double tap fires. */
export function tick(g: Gesture, t: number): Result {
  const touch = g.touch;
  if (!touch) return { g, out: 0 };
  if (touch.skillAt !== null) {
    if (t - touch.skillAt < GESTURE.aimMs) return { g, out: 0 };
    return { g: { ...g, touch: { ...touch, skillAt: null, spent: true } }, out: SKILL1 };
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
  const travel = Math.abs(x - touch.ox) + Math.abs(y - touch.oy);

  if (touch.skillAt !== null) return { g: done, out: SKILL1 };
  if (touch.spent) return { g: done, out: 0 };
  if (touch.charging) return { g: done, out: SKILL2 | direction(x - touch.ox, y - touch.oy, true) };
  if (t - touch.t0 <= GESTURE.tapMs && travel <= GESTURE.tapPx && !touch.moved) {
    return { g: { touch: null, lastTap: { t, x, y } }, out: JUMP };
  }
  return { g: done, out: 0 };
}

/** The directions held this frame: running, and down. None while charging or aiming. */
export function held(g: Gesture): Input {
  const touch = g.touch;
  if (!touch || touch.charging || touch.skillAt !== null) return 0;
  return direction(touch.x - touch.ox, touch.y - touch.oy, false);
}

/** How far a charge has come, 0–1, for the ring under the thumb. */
export function charge(g: Gesture, t: number): number {
  const touch = g.touch;
  if (!touch || touch.moved || touch.spent || touch.skillAt !== null) return 0;
  return Math.min(1, (t - touch.t0) / GESTURE.holdMs);
}

/** Where a charging skill is aimed, as a direction from the ring, or null for "at the nearest". */
export function chargeAim(g: Gesture): [number, number] | null {
  const touch = g.touch;
  if (!touch?.charging) return null;
  const bits = direction(touch.x - touch.ox, touch.y - touch.oy, true);
  if (!bits) return null;
  return [(bits & RIGHT ? 1 : 0) - (bits & LEFT ? 1 : 0), (bits & DOWN ? 1 : 0) - (bits & UP ? 1 : 0)];
}
