import { DODGE, DOWN, JUMP, LEFT, RIGHT, SKILL1, SKILL2, UP, type Input } from './input';

/**
 * Two thumbs, sideways. The left thumb lands anywhere on the left and that spot becomes a
 * joystick: it runs, holds down to fall fast or drop through a ledge, and points an
 * attack. The right thumb has four buttons: jump, dodge, normal and heavy attack. An
 * attack with the stick centred aims itself at the nearest fighter (the engine does that).
 *
 * Pure, so it can be tested: positions are CSS pixels.
 */
export const STICK = {
  /** How far the knob travels from the centre. */
  radius: 56,
  /** Inside this share of the radius, the stick is centred. */
  dead: 0.3,
};

export type Button = 'jump' | 'dodge' | 'normal' | 'heavy';

export const BUTTON_BITS: Record<Button, Input> = { jump: JUMP, dodge: DODGE, normal: SKILL1, heavy: SKILL2 };

/**
 * The stick's direction as bits: one of eight ways, or none inside the dead zone. A
 * diagonal needs both parts to be at least half the other (about 27° either side of 45°).
 */
export function stickBits(dx: number, dy: number): Input {
  const dead = STICK.radius * STICK.dead;
  if (dx * dx + dy * dy < dead * dead) return 0;
  let bits = 0;
  if (Math.abs(dx) * 2 > Math.abs(dy)) bits |= dx > 0 ? RIGHT : LEFT;
  if (Math.abs(dy) * 2 > Math.abs(dx)) bits |= dy > 0 ? DOWN : UP;
  return bits;
}

/** Where to draw the knob: the thumb's offset, held inside the stick's ring. */
export function knob(dx: number, dy: number): [number, number] {
  const far = Math.sqrt(dx * dx + dy * dy);
  if (far <= STICK.radius) return [dx, dy];
  return [(dx * STICK.radius) / far, (dy * STICK.radius) / far];
}
