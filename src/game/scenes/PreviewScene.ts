import Phaser from 'phaser';
import type { Loadout } from '../../shared/types';
import { BirdSprite } from '../character/BirdSprite';
import { createTrail } from '../character/trail';

export const PREVIEW_WIDTH = 200;
export const PREVIEW_HEIGHT = 150;

/** Shows the bird from the 'loadout' registry value and redraws when it changes. */
export class PreviewScene extends Phaser.Scene {
  constructor() {
    super('preview');
  }

  create() {
    const centreY = PREVIEW_HEIGHT / 2;
    let loadout = this.registry.get('loadout') as Loadout;
    const bird = new BirdSprite(this, PREVIEW_WIDTH / 2 + 10, centreY, loadout).setScale(1.6);
    let trail = createTrail(this, bird, loadout);
    trail?.setDepth(-1);

    const onChange = (_parent: unknown, next: Loadout) => {
      loadout = next;
      bird.setLoadout(next);
      trail?.destroy();
      trail = createTrail(this, bird, next);
      trail?.setDepth(-1);
    };
    this.registry.events.on('changedata-loadout', onChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.registry.events.off('changedata-loadout', onChange));

    this.tweens.add({ targets: bird, y: centreY - 8, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.addEvent({ delay: 900, loop: true, callback: () => bird.flap() });
  }
}
