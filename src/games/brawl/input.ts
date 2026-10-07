/**
 * One player's input for one frame: a few bits. Directions come from the joystick (held,
 * and they aim an attack); jump, dodge and the two attacks are buttons that count only on
 * the frame they're pressed. Small and plain, so a
 * frame's inputs can be sent between phones and replayed.
 */
export type Input = number;

export const LEFT = 1;
export const RIGHT = 2;
export const UP = 4;
export const DOWN = 8;
export const JUMP = 16;
/** The normal attack: the weapon's quick skill. */
export const SKILL1 = 32;
/**
 * The heavy attack: the weapon's strong skill. Unlike the other buttons it's held: it
 * charges while down and strikes when let go, harder the longer it was held.
 */
export const SKILL2 = 64;
/** A roll on the ground; in the air, a floor of ice to stand on. */
export const DODGE = 128;

export const DIRS = LEFT | RIGHT | UP | DOWN;
/** Buttons that count on the frame they're pressed. */
export const ACTIONS = JUMP | SKILL1 | DODGE;
/** What a player holds down from frame to frame: the stick, and a charging heavy. */
export const HELD = DIRS | SKILL2;

/** -1, 0 or 1. */
export const dirX = (input: Input) => (input & RIGHT ? 1 : 0) - (input & LEFT ? 1 : 0);
/** -1 (up), 0 or 1 (down). */
export const dirY = (input: Input) => (input & DOWN ? 1 : 0) - (input & UP ? 1 : 0);
