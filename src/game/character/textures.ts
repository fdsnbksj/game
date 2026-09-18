import Phaser from 'phaser';
import { PART_SHAPES, PART_SIZE, type Shape } from '../../shared/birdShapes';

/** Parts are designed on a 48x48 grid and rendered at this multiple so they stay sharp when scaled up. */
export const TEXTURE_SCALE = 4;
const PARTICLE_SIZE = 12;

const WHITE = 0xffffff;

type DrawPart = (g: Phaser.GameObjects.Graphics) => void;

// Tinted areas are drawn white, so the image's tint gives them the player's color.
function drawShapes(g: Phaser.GameObjects.Graphics, shapes: readonly Shape[]) {
  for (const shape of shapes) {
    const color = shape.paint === 'tint' ? WHITE : shape.paint;
    switch (shape.type) {
      case 'circle':
        g.fillStyle(color).fillCircle(shape.x, shape.y, shape.r);
        break;
      case 'ellipse':
        g.fillStyle(color).fillEllipse(shape.x, shape.y, shape.width, shape.height);
        break;
      case 'triangle':
        g.fillStyle(color).fillTriangle(...shape.points);
        break;
      case 'rect':
        g.fillStyle(color).fillRect(shape.x, shape.y, shape.width, shape.height);
        break;
      case 'line':
        g.lineStyle(shape.width, color).lineBetween(shape.x1, shape.y1, shape.x2, shape.y2);
        break;
    }
  }
}

const PARTS: Record<string, DrawPart> = Object.fromEntries(
  Object.entries(PART_SHAPES).map(([key, shapes]) => [key, (g: Phaser.GameObjects.Graphics) => drawShapes(g, shapes)]),
);

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
