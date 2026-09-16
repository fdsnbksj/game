import Phaser from 'phaser';
import { getItem } from '../../shared/items';
import type { Loadout } from '../../shared/types';
import { ensureBirdTextures } from './textures';

const RAINBOW = [0xff4d4d, 0xffd23f, 0x5cff87, 0x36e2ff, 0xb77cff];

/**
 * Particle trail that follows the bird, or null when the player has no trail equipped.
 * It lives in the scene rather than inside the bird, so particles stay behind as the bird moves on.
 */
export function createTrail(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  loadout: Loadout,
): Phaser.GameObjects.Particles.ParticleEmitter | null {
  const spriteKey = getItem(loadout.trail)?.spriteKey;
  if (!spriteKey || spriteKey === 'trail_none') return null;
  ensureBirdTextures(scene);

  const emitter = scene.add.particles(0, 0, spriteKey, {
    lifespan: 450,
    speed: { min: 8, max: 38 },
    angle: { min: 150, max: 210 },
    scale: { start: 1, end: 0 },
    alpha: { start: 0.9, end: 0 },
    frequency: 55,
    blendMode: 'ADD',
    tint: spriteKey === 'trail_rainbow' ? RAINBOW : loadout.colors.trail,
  });
  emitter.startFollow(target, -14, 4);
  return emitter;
}
