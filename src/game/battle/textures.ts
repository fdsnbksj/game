import Phaser from 'phaser';
import { CREATURE_ART, CREATURE_SIZE, INK, OUTLINE, type Part } from '../../shared/creatureArt';
import { ITEM_SIZE, itemParts } from '../../shared/itemArt';
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
    drawParts(ctx, art.parts);
    texture.refresh();
  }
}

/** The same parts, in the same order, as PartSvg in CreatureChip. */
function drawParts(ctx: CanvasRenderingContext2D, parts: readonly Part[]) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const part of parts) {
    const path = new Path2D(part.d);
    ctx.globalAlpha = part.opacity ?? 1;
    if (part.fill) {
      ctx.fillStyle = part.fill;
      ctx.fill(path);
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
  ctx.globalAlpha = 1;
}

/** Display scale that makes a creature texture `size` world pixels wide. */
export const creatureScale = (size: number) => size / (CREATURE_SIZE * SCALE);

/** Where the creatures' feet touch the ground, down their 48-unit grid. */
const FEET = 46;

/** The texture origin that stands a creature on its feet. */
export const FEET_ORIGIN = FEET / CREATURE_SIZE;

/** How tall a creature stands above its feet, as a share of its drawn size. */
export const creatureHeight = (unitId: string) => (FEET - (CREATURE_ART[unitId]?.top ?? 0)) / CREATURE_SIZE;

export const itemKey = (itemId: string) => `item-${itemId}`;

/** Item tiles: the same parts as ItemChip, drawn once per game. */
export function ensureItemTextures(scene: Phaser.Scene) {
  const size = 24 * SCALE;
  for (const item of ITEMS) {
    const key = itemKey(item.id);
    if (scene.textures.exists(key)) continue;
    const texture = scene.textures.createCanvas(key, size, size);
    if (!texture) continue;
    texture.context.scale(size / ITEM_SIZE, size / ITEM_SIZE);
    drawParts(texture.context, itemParts(item.id));
    texture.refresh();
  }
}

/** Display scale that makes an item texture `size` world pixels wide. */
export const itemScale = (size: number) => size / (24 * SCALE);
