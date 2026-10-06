/**
 * One player's input for one frame: a few bits. Directions are held; jump, light, heavy
 * and dodge count only on the frame they're pressed. Small and plain on purpose, so a
 * frame's inputs can later be sent between phones and replayed.
 */
export type Input = number;

export const LEFT = 1;
export const RIGHT = 2;
export const UP = 4;
export const DOWN = 8;
export const JUMP = 16;
export const LIGHT = 32;
export const HEAVY = 64;
export const DODGE = 128;

export const DIRS = LEFT | RIGHT | UP | DOWN;
export const ACTIONS = JUMP | LIGHT | HEAVY | DODGE;

/** -1, 0 or 1. */
export const dirX = (input: Input) => (input & RIGHT ? 1 : 0) - (input & LEFT ? 1 : 0);
