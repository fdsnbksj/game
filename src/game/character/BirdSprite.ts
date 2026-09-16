import Phaser from 'phaser';
import { getItem } from '../../shared/items';
import type { Loadout } from '../../shared/types';
import { ensureBirdTextures, TEXTURE_SCALE } from './textures';

/** Roughly the drawn body radius, used for collisions. */
export const BIRD_RADIUS = 13;

// The wing pivots near the bird's shoulder rather than its own centre.
const WING_PIVOT_X = 6;
const WING_PIVOT_Y = -4;
const PART_SIZE = 48;

/** The player's bird: tinted body and wing, a fixed face, and a hat. */
export class BirdSprite extends Phaser.GameObjects.Container {
  // Not named `body`: Phaser game objects already use that for their physics body.
  private readonly bodyPart: Phaser.GameObjects.Image;
  private readonly wing: Phaser.GameObjects.Image;
  private readonly hat: Phaser.GameObjects.Image;
  private wingTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, loadout: Loadout) {
    super(scene, x, y);
    ensureBirdTextures(scene);

    const part = (key: string) => new Phaser.GameObjects.Image(scene, 0, 0, key).setScale(1 / TEXTURE_SCALE);
    this.bodyPart = part('__MISSING');
    this.wing = part('__MISSING')
      .setOrigin(0.5 + WING_PIVOT_X / PART_SIZE, 0.5 + WING_PIVOT_Y / PART_SIZE)
      .setPosition(WING_PIVOT_X, WING_PIVOT_Y);
    this.hat = part('hat_none');
    this.add([this.bodyPart, this.wing, part('face'), this.hat]);

    this.setLoadout(loadout);
    scene.add.existing(this);
  }

  setLoadout(loadout: Loadout): this {
    this.bodyPart.setTexture(getItem(loadout.body)?.spriteKey ?? '__MISSING').setTint(loadout.colors.body);
    this.wing.setTexture(getItem(loadout.wing)?.spriteKey ?? '__MISSING').setTint(loadout.colors.wing);
    this.hat.setTexture(getItem(loadout.hat)?.spriteKey ?? 'hat_none');
    return this;
  }

  /** One wing beat: snap up, sweep down. */
  flap(): this {
    this.wingTween?.stop();
    this.wing.setAngle(-38);
    this.wingTween = this.scene.tweens.add({
      targets: this.wing,
      angle: 18,
      duration: 220,
      ease: 'Sine.easeOut',
    });
    return this;
  }
}
