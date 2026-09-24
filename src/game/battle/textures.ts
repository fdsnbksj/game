import Phaser from 'phaser';
import { CREATURE_ART, CREATURE_SIZE, GLOSS, INK, OUTLINE, glossEllipse, shadeEllipse } from '../../shared/creatureArt';
import { ITEM_GLYPHS, itemColors } from '../../shared/itemGlyphs';
import { ITEMS } from '../../sim/balance';

/** Creatures are baked at this multiple of their 48px grid so they stay sharp when scaled up. */
const SCALE = 4;

export const creatureKey = (unitId: string) => `creature-${unitId}`;

/** Bakes every creature once per game: the same parts, in the same order, as CreatureChip. */
export function ensureCreatureTextures(scene: Phaser.Scene) {
  const size = CREATURE_SIZE * SCALE;
  for (const [unitId, art] of Object.entries(CREATURE_ART)) {
    const key = creatureKey(unitId);
    if (scene.textures.exists(key)) continue;
    const texture = scene.textures.createCanvas(key, size, size);
    if (!texture) continue;
    const ctx = texture.context;
    ctx.scale(SCALE, SCALE);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const part of art.parts) {
      const path = new Path2D(part.d);
      ctx.globalAlpha = part.opacity ?? 1;
      if (part.fill) {
        ctx.fillStyle = part.fill;
        ctx.fill(path);
      }
      if (part.shade || part.gloss) {
        ctx.save();
        ctx.clip(path);
        if (part.shade) fillEllipse(ctx, shadeEllipse(part.box), part.shade);
        if (part.gloss) fillEllipse(ctx, glossEllipse(part.box), GLOSS);
        ctx.restore();
      }
      if (part.line) {
        ctx.strokeStyle = part.line.color;
        ctx.lineWidth = part.line.width;
        ctx.stroke(path);
      }
      if (part.outline) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = OUTLINE;
        ctx.stroke(path);
      }
    }
    texture.refresh();
  }
}

function fillEllipse(ctx: CanvasRenderingContext2D, e: { cx: number; cy: number; rx: number; ry: number }, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(e.cx, e.cy, e.rx, e.ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Display scale that makes a creature texture `size` world pixels wide. */
export const creatureScale = (size: number) => size / (CREATURE_SIZE * SCALE);

/** How far the top of a creature's head is from the bottom of its texture, as a share of its size. */
export const creatureHeight = (unitId: string) => 1 - (CREATURE_ART[unitId]?.top ?? 0) / CREATURE_SIZE;

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
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = INK;
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
