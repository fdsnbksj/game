/**
 * One player's input for one frame: a few bits. Directions are held (and aim a skill);
 * jump and the two skills count only on the frame they're pressed. Small and plain, so a
 * frame's inputs can be sent between phones and replayed.
 */
export type Input = number;

export const LEFT = 1;
export const RIGHT = 2;
export const UP = 4;
export const DOWN = 8;
export const JUMP = 16;
/** Double tap: the weapon's quick skill. */
export const SKILL1 = 32;
/** Hold: the weapon's strong skill. */
export const SKILL2 = 64;

export const DIRS = LEFT | RIGHT | UP | DOWN;
export const ACTIONS = JUMP | SKILL1 | SKILL2;

/** -1, 0 or 1. */
export const dirX = (input: Input) => (input & RIGHT ? 1 : 0) - (input & LEFT ? 1 : 0);
/** -1 (up), 0 or 1 (down). */
export const dirY = (input: Input) => (input & DOWN ? 1 : 0) - (input & UP ? 1 : 0);
