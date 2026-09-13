import Phaser from 'phaser';
import { getItem, LAYER_ORDER } from '../../shared/items';
import type { Loadout, Slot } from '../../shared/types';
import { ensureCharacterTextures, TEXTURE_SCALE } from './textures';

/** A character built from stacked, tinted layers. Positioned by its feet. */
export class CharacterSprite extends Phaser.GameObjects.Container {
  private readonly layers = new Map<Slot, Phaser.GameObjects.Image>();

  constructor(scene: Phaser.Scene, x: number, y: number, loadout: Loadout) {
    super(scene, x, y);
    ensureCharacterTextures(scene);
    for (const slot of LAYER_ORDER) {
      const layer = new Phaser.GameObjects.Image(scene, 0, 0, '__MISSING').setOrigin(0.5, 1).setScale(1 / TEXTURE_SCALE);
      this.layers.set(slot, layer);
      this.add(layer);
    }
    this.setLoadout(loadout);
    scene.add.existing(this);
  }

  setLoadout(loadout: Loadout): this {
    for (const [slot, layer] of this.layers) {
      layer.setTexture(getItem(loadout[slot])?.spriteKey ?? '__MISSING');
    }
    const { skin, hair, outfit } = loadout.colors;
    this.layers.get('body')?.setTint(skin);
    this.layers.get('hair')?.setTint(hair);
    this.layers.get('outfit')?.setTint(outfit);
    return this;
  }
}
