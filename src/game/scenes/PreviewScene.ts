import Phaser from 'phaser';
import type { Loadout } from '../../shared/types';
import { CharacterSprite } from '../character/CharacterSprite';

export const PREVIEW_WIDTH = 160;
export const PREVIEW_HEIGHT = 210;

/** Shows the character from the 'loadout' registry value and redraws when it changes. */
export class PreviewScene extends Phaser.Scene {
  constructor() {
    super('preview');
  }

  create() {
    const baseY = PREVIEW_HEIGHT - 8;
    const character = new CharacterSprite(this, PREVIEW_WIDTH / 2, baseY, this.registry.get('loadout') as Loadout);
    character.setScale(2);

    const onChange = (_parent: unknown, loadout: Loadout) => character.setLoadout(loadout);
    this.registry.events.on('changedata-loadout', onChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.registry.events.off('changedata-loadout', onChange));

    this.tweens.add({ targets: character, y: baseY - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}
