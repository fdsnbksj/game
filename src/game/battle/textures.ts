import Phaser from 'phaser';
import { CREATURE_SHAPES, CREATURE_SIZE, type Shape } from '../../shared/creatureShapes';
import { ITEM_GLYPHS, itemColors } from '../../shared/itemGlyphs';
import { ITEMS } from '../../sim/balance';

/** Creatures are drawn at this multiple of their 48px grid so they stay sharp on the 2x canvas. */
const SCALE = 3;

function draw(g: Phaser.GameObjects.Graphics, shapes: readonly Shape[]) {
  for (const shape of shapes) {
    switch (shape.type) {
      case 'circle':
        g.fillStyle(shape.color).fillCircle(shape.x, shape.y, shape.r);
        break;
      case 'ellipse':
        g.fillStyle(shape.color).fillEllipse(shape.x, shape.y, shape.width, shape.height);
        break;
      case 'polygon': {
        const points: Phaser.Types.Math.Vector2Like[] = [];
        for (let i = 0; i < shape.points.length; i += 2) points.push({ x: shape.points[i], y: shape.points[i + 1] });
        g.fillStyle(shape.color).fillPoints(points, true);
        break;
      }
      case 'rect':
        g.fillStyle(shape.color).fillRect(shape.x, shape.y, shape.width, shape.height);
        break;
      case 'line':
        g.lineStyle(shape.width, shape.color).lineBetween(shape.x1, shape.y1, shape.x2, shape.y2);
        break;
    }
  }
}

export const creatureKey = (unitId: string) => `creature-${unitId}`;

/** Bakes every creature once per game. */
export function ensureCreatureTextures(scene: Phaser.Scene) {
  for (const [unitId, shapes] of Object.entries(CREATURE_SHAPES)) {
    const key = creatureKey(unitId);
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({}, false);
    g.scaleCanvas(SCALE, SCALE);
    draw(g, shapes);
    g.generateTexture(key, CREATURE_SIZE * SCALE, CREATURE_SIZE * SCALE);
    g.destroy();
  }
}

/** Display scale that makes a creature texture `size` world pixels wide. */
export const creatureScale = (size: number) => size / (CREATURE_SIZE * SCALE);

export const itemKey = (itemId: string) => `item-${itemId}`;

/** Item tiles: the same glyph and colours as ItemChip, drawn once per game. */
export function ensureItemTextures(scene: Phaser.Scene) {
  const size = 24 * SCALE;
  for (const item of ITEMS) {
    const key = itemKey(item.id);
    if (scene.textures.exists(key)) continue;
    const texture = scene.textures.createCanvas(key, size, size);
    if (!texture) continue;
    const ctx = texture.context;
    const { tile, glyph } = itemColors(item.id);
    ctx.scale(SCALE, SCALE);
    ctx.beginPath();
    roundedRect(ctx, 1, 1, 22, 22, 6);
    ctx.fillStyle = tile;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(28, 28, 30, 0.35)';
    ctx.stroke();
    ctx.translate(4.8, 4.8);
    ctx.scale(0.6, 0.6);
    ctx.fillStyle = glyph;
    ctx.fill(new Path2D(ITEM_GLYPHS[item.id]));
    texture.refresh();
  }
}

/** Display scale that makes an item texture `size` world pixels wide. */
export const itemScale = (size: number) => size / (24 * SCALE);

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
