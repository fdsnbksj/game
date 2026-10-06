/**
 * The one stage: a floating island with three soft ledges above it. In world pixels, y
 * growing downward, 0 at the island's top. The state stores everything in sub-units
 * (SUB per pixel) so all the maths stays in whole numbers.
 */
export const SUB = 100;

export interface Platform {
  left: number;
  right: number;
  top: number;
  /** Solid ground has an underside and sides; soft ledges can be jumped up through and dropped from. */
  soft: boolean;
  bottom: number;
}

export const PLATFORMS: readonly Platform[] = [
  { left: -280, right: 280, top: 0, bottom: 40, soft: false },
  { left: -250, right: -100, top: -150, bottom: -150, soft: true },
  { left: 100, right: 250, top: -150, bottom: -150, soft: true },
  { left: -75, right: 75, top: -290, bottom: -290, soft: true },
];

/** Cross any of these and you're out of the fight until you respawn. */
export const BLAST = { left: -720, right: 720, top: -780, bottom: 480 };

export const SPAWNS: readonly { x: number; y: number }[] = [
  { x: -170, y: 0 },
  { x: 170, y: 0 },
  { x: -60, y: 0 },
  { x: 60, y: 0 },
];

export const RESPAWN = { x: 0, y: -440 };

/** A fighter's body, feet at its position. */
export const BODY_W = 36;
export const BODY_H = 64;
