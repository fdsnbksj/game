// The bird's parts as plain shapes on a 48x48 grid, facing right. Phaser bakes them into
// textures (src/game/character/textures.ts) and BirdChip draws them as SVG, so the bird
// on the leaderboard is the same bird as in the game.

/** 'tint' areas take the player's color for that part; numbers are fixed colors. */
export type Paint = number | 'tint';

export type Shape =
  | { type: 'circle'; x: number; y: number; r: number; paint: Paint }
  | { type: 'ellipse'; x: number; y: number; width: number; height: number; paint: Paint }
  | { type: 'triangle'; points: [number, number, number, number, number, number]; paint: Paint }
  | { type: 'rect'; x: number; y: number; width: number; height: number; paint: Paint }
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number; width: number; paint: Paint };

export const PART_SIZE = 48;

const INK = 0x10131a;
const BEAK = 0xffa42b;
const BEAK_SHADE = 0xd97d12;

export const PART_SHAPES: Record<string, readonly Shape[]> = {
  body_round: [
    { type: 'triangle', points: [10, 20, 0, 13, 11, 31], paint: 'tint' },
    { type: 'circle', x: 22, y: 24, r: 14, paint: 'tint' },
  ],
  body_sleek: [
    { type: 'triangle', points: [9, 22, 0, 15, 10, 31], paint: 'tint' },
    { type: 'ellipse', x: 24, y: 24, width: 38, height: 22, paint: 'tint' },
  ],
  body_chunky: [
    { type: 'triangle', points: [8, 20, 0, 12, 9, 32], paint: 'tint' },
    { type: 'circle', x: 22, y: 25, r: 16, paint: 'tint' },
  ],
  // Drawn over the body and never tinted, so every bird keeps a readable face.
  face: [
    { type: 'triangle', points: [34, 21, 47, 25, 34, 29], paint: BEAK },
    { type: 'triangle', points: [34, 25, 45, 26, 34, 29], paint: BEAK_SHADE },
    { type: 'circle', x: 30, y: 18, r: 5, paint: 0xffffff },
    { type: 'circle', x: 31, y: 18, r: 2.5, paint: INK },
  ],
  wing_basic: [{ type: 'ellipse', x: 20, y: 26, width: 22, height: 13, paint: 'tint' }],
  wing_pointed: [{ type: 'triangle', points: [9, 17, 30, 26, 13, 35], paint: 'tint' }],
  wing_feathered: [
    { type: 'ellipse', x: 21, y: 24, width: 21, height: 11, paint: 'tint' },
    { type: 'ellipse', x: 19, y: 28, width: 18, height: 10, paint: 'tint' },
    { type: 'ellipse', x: 16, y: 32, width: 14, height: 8, paint: 'tint' },
  ],
  hat_none: [],
  hat_cap: [
    { type: 'ellipse', x: 24, y: 10, width: 20, height: 11, paint: 0xff3df0 },
    { type: 'rect', x: 30, y: 9, width: 13, height: 3, paint: 0xff3df0 },
  ],
  hat_antenna: [
    { type: 'line', x1: 24, y1: 12, x2: 27, y2: 3, width: 2, paint: 0x36e2ff },
    { type: 'circle', x: 27, y: 2, r: 3, paint: 0x36e2ff },
  ],
  hat_crown: [
    { type: 'rect', x: 15, y: 7, width: 19, height: 5, paint: 0xffd23f },
    { type: 'triangle', points: [15, 8, 18, 1, 21, 8], paint: 0xffd23f },
    { type: 'triangle', points: [22, 8, 25, 0, 28, 8], paint: 0xffd23f },
    { type: 'triangle', points: [29, 8, 32, 1, 34, 8], paint: 0xffd23f },
  ],
};
