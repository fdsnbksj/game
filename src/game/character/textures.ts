import Phaser from 'phaser';

/** Parts are designed on a 48x48 grid and rendered at this multiple so they stay sharp when scaled up. */
export const TEXTURE_SCALE = 4;
const PART_SIZE = 48;
const PARTICLE_SIZE = 12;

// White areas take the layer's tint. Fixed colors (beak, hats, eyes) are drawn as they should look.
const WHITE = 0xffffff;
const INK = 0x10131a;
const BEAK = 0xffa42b;
const BEAK_SHADE = 0xd97d12;

type DrawPart = (g: Phaser.GameObjects.Graphics) => void;

// Body and wing are tinted, so they're drawn white. The bird faces right.
const PARTS: Record<string, DrawPart> = {
  body_round: (g) => {
    g.fillStyle(WHITE);
    g.fillTriangle(10, 20, 0, 13, 11, 31);
    g.fillCircle(22, 24, 14);
  },
  body_sleek: (g) => {
    g.fillStyle(WHITE);
    g.fillTriangle(9, 22, 0, 15, 10, 31);
    g.fillEllipse(24, 24, 38, 22);
  },
  body_chunky: (g) => {
    g.fillStyle(WHITE);
    g.fillTriangle(8, 20, 0, 12, 9, 32);
    g.fillCircle(22, 25, 16);
  },
  // Drawn over the body, never tinted, so every bird keeps a readable face.
  face: (g) => {
    g.fillStyle(BEAK);
    g.fillTriangle(34, 21, 47, 25, 34, 29);
    g.fillStyle(BEAK_SHADE);
    g.fillTriangle(34, 25, 45, 26, 34, 29);
    g.fillStyle(WHITE);
    g.fillCircle(30, 18, 5);
    g.fillStyle(INK);
    g.fillCircle(31, 18, 2.5);
  },
  wing_basic: (g) => {
    g.fillStyle(WHITE);
    g.fillEllipse(20, 26, 22, 13);
  },
  wing_pointed: (g) => {
    g.fillStyle(WHITE);
    g.fillTriangle(9, 17, 30, 26, 13, 35);
  },
  wing_feathered: (g) => {
    g.fillStyle(WHITE);
    g.fillEllipse(21, 24, 21, 11);
    g.fillEllipse(19, 28, 18, 10);
    g.fillEllipse(16, 32, 14, 8);
  },
  hat_none: () => {},
  hat_cap: (g) => {
    g.fillStyle(0xff3df0);
    g.fillEllipse(24, 10, 20, 11);
    g.fillRect(30, 9, 13, 3);
  },
  hat_antenna: (g) => {
    g.lineStyle(2, 0x36e2ff);
    g.lineBetween(24, 12, 27, 3);
    g.fillStyle(0x36e2ff);
    g.fillCircle(27, 2, 3);
  },
  hat_crown: (g) => {
    g.fillStyle(0xffd23f);
    g.fillRect(15, 7, 19, 5);
    g.fillTriangle(15, 8, 18, 1, 21, 8);
    g.fillTriangle(22, 8, 25, 0, 28, 8);
    g.fillTriangle(29, 8, 32, 1, 34, 8);
  },
};

// Trail particles are tinted per player, so they're white too.
const PARTICLES: Record<string, DrawPart> = {
  trail_spark: (g) => {
    g.fillStyle(WHITE);
    g.fillTriangle(6, 0, 8, 6, 6, 12);
    g.fillTriangle(0, 6, 6, 4, 12, 6);
    g.fillCircle(6, 6, 2.5);
  },
  trail_rainbow: (g) => {
    g.fillStyle(WHITE);
    g.fillCircle(6, 6, 5);
  },
};

function generate(scene: Phaser.Scene, key: string, draw: DrawPart, size: number) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({}, false);
  g.scaleCanvas(TEXTURE_SCALE, TEXTURE_SCALE);
  draw(g);
  g.generateTexture(key, size * TEXTURE_SCALE, size * TEXTURE_SCALE);
  g.destroy();
}

/** Generates every bird part and trail particle texture once per game. */
export function ensureBirdTextures(scene: Phaser.Scene) {
  for (const [key, draw] of Object.entries(PARTS)) generate(scene, key, draw, PART_SIZE);
  for (const [key, draw] of Object.entries(PARTICLES)) generate(scene, key, draw, PARTICLE_SIZE);
}
