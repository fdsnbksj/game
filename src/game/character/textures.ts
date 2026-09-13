import Phaser from 'phaser';

/** Layers are designed on a 64x96 grid and rendered at this multiple so they stay sharp when scaled up. */
export const TEXTURE_SCALE = 4;
const WIDTH = 64;
const HEIGHT = 96;

// White areas take the layer's tint; INK details stay dark under any tint.
const WHITE = 0xffffff;
const INK = 0x1b1b1f;

type DrawLayer = (g: Phaser.GameObjects.Graphics) => void;

function drawLimbs(g: Phaser.GameObjects.Graphics) {
  g.fillRoundedRect(12, 40, 8, 24, 4);
  g.fillRoundedRect(44, 40, 8, 24, 4);
  g.fillRoundedRect(22, 66, 8, 26, 4);
  g.fillRoundedRect(34, 66, 8, 26, 4);
}

function drawEyes(g: Phaser.GameObjects.Graphics) {
  g.fillStyle(INK);
  g.fillCircle(27, 23, 2);
  g.fillCircle(37, 23, 2);
}

// Placeholder art, keyed by Item.spriteKey. Replace with a sprite sheet once there's real art.
const LAYERS: Record<string, DrawLayer> = {
  body_basic: (g) => {
    g.fillStyle(WHITE);
    g.fillCircle(32, 22, 14);
    g.fillRoundedRect(21, 38, 22, 30, 6);
    drawLimbs(g);
    drawEyes(g);
  },
  body_round: (g) => {
    g.fillStyle(WHITE);
    g.fillCircle(32, 22, 16);
    g.fillEllipse(32, 54, 34, 34);
    drawLimbs(g);
    drawEyes(g);
  },
  outfit_basic: (g) => {
    g.fillStyle(WHITE);
    g.fillRoundedRect(19, 37, 26, 24, 6);
    g.fillRoundedRect(11, 39, 10, 12, 4);
    g.fillRoundedRect(43, 39, 10, 12, 4);
  },
  outfit_hoodie: (g) => {
    g.fillStyle(WHITE);
    g.fillEllipse(32, 38, 30, 10);
    g.fillRoundedRect(18, 37, 28, 32, 6);
    g.fillRoundedRect(10, 39, 11, 26, 4);
    g.fillRoundedRect(43, 39, 11, 26, 4);
    g.fillStyle(INK, 0.25);
    g.fillRoundedRect(24, 55, 16, 9, 3);
  },
  outfit_armor: (g) => {
    g.fillStyle(WHITE);
    g.fillRoundedRect(18, 36, 28, 34, 4);
    g.fillCircle(15, 42, 7);
    g.fillCircle(49, 42, 7);
    g.lineStyle(2, INK, 0.35);
    g.lineBetween(20, 50, 44, 50);
    g.lineBetween(20, 60, 44, 60);
  },
  hair_basic: (g) => {
    g.fillStyle(WHITE);
    g.fillEllipse(32, 13, 30, 14);
    g.fillRect(18, 12, 4, 10);
    g.fillRect(42, 12, 4, 10);
  },
  hair_spiky: (g) => {
    g.fillStyle(WHITE);
    g.fillEllipse(32, 15, 30, 12);
    g.fillTriangle(17, 16, 20, 1, 27, 12);
    g.fillTriangle(24, 12, 31, 0, 36, 12);
    g.fillTriangle(33, 12, 42, 1, 44, 14);
    g.fillTriangle(40, 14, 49, 5, 47, 19);
  },
  hair_long: (g) => {
    g.fillStyle(WHITE);
    g.fillEllipse(32, 13, 32, 14);
    g.fillRoundedRect(15, 12, 8, 32, 4);
    g.fillRoundedRect(41, 12, 8, 32, 4);
  },
  acc_none: () => {},
  acc_glasses: (g) => {
    g.lineStyle(2, INK);
    g.strokeCircle(26, 23, 5);
    g.strokeCircle(38, 23, 5);
    g.lineBetween(31, 23, 33, 23);
  },
  acc_crown: (g) => {
    g.fillStyle(0xffc83d);
    g.fillRect(21, 6, 22, 6);
    g.fillTriangle(21, 7, 24, 0, 27, 7);
    g.fillTriangle(29, 7, 32, 0, 35, 7);
    g.fillTriangle(37, 7, 40, 0, 43, 7);
  },
};

/** Generates every character layer texture once per game. */
export function ensureCharacterTextures(scene: Phaser.Scene) {
  for (const [key, draw] of Object.entries(LAYERS)) {
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({}, false);
    g.scaleCanvas(TEXTURE_SCALE, TEXTURE_SCALE);
    draw(g);
    g.generateTexture(key, WIDTH * TEXTURE_SCALE, HEIGHT * TEXTURE_SCALE);
    g.destroy();
  }
}
