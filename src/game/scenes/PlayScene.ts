import Phaser from 'phaser';
import { RUN_DURATION_MS } from '../../shared/constants';
import type { Loadout, RunResult } from '../../shared/types';
import { CharacterSprite } from '../character/CharacterSprite';
import { EventBus, RUN_FINISHED } from '../EventBus';

export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 640;

const CHARACTER_Y = GAME_HEIGHT - 24;
const TARGET_RADIUS = 30;
const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: '22px',
  color: '#f1f3f7',
};

/**
 * Placeholder gameplay until the real game is chosen: tap each target before it
 * shrinks away. Targets shrink faster as the score climbs.
 */
export class PlayScene extends Phaser.Scene {
  private score = 0;
  private running = false;
  private endTimer?: Phaser.Time.TimerEvent;
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private character!: CharacterSprite;

  constructor() {
    super('play');
  }

  create() {
    this.score = 0;
    this.running = false;
    this.scoreText = this.add.text(16, 16, 'Score 0', TEXT_STYLE);
    this.timerText = this.add.text(GAME_WIDTH - 16, 16, `${RUN_DURATION_MS / 1000}s`, TEXT_STYLE).setOrigin(1, 0);
    this.character = new CharacterSprite(this, GAME_WIDTH / 2, CHARACTER_Y, this.registry.get('loadout') as Loadout);
    this.character.setScale(1.5);

    const prompt = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'Tap to start', { ...TEXT_STYLE, fontSize: '32px' })
      .setOrigin(0.5);
    this.input.once('pointerdown', () => {
      prompt.destroy();
      this.start();
    });
  }

  update() {
    if (!this.running || !this.endTimer) return;
    // Read the countdown from the end timer itself: it only advances while the game runs,
    // so the display stays in sync after the tab or app is backgrounded.
    this.timerText.setText(`${Math.ceil(this.endTimer.getRemainingSeconds())}s`);
  }

  private start() {
    this.running = true;
    this.endTimer = this.time.delayedCall(RUN_DURATION_MS, () => this.finish());
    this.spawnTarget();
  }

  private spawnTarget() {
    if (!this.running) return;
    const lifetime = Math.max(450, 1200 - this.score * 20);
    const x = Phaser.Math.Between(TARGET_RADIUS + 8, GAME_WIDTH - TARGET_RADIUS - 8);
    const y = Phaser.Math.Between(80, GAME_HEIGHT - 220);
    const target = this.add.circle(x, y, TARGET_RADIUS, 0xff5a5f).setStrokeStyle(4, 0xffffff).setInteractive();

    const shrink = this.tweens.add({
      targets: target,
      scale: 0,
      duration: lifetime,
      onComplete: () => {
        target.destroy();
        this.spawnTarget();
      },
    });

    target.once('pointerdown', () => {
      // stop() skips onComplete, so the missed-target path doesn't also spawn one.
      shrink.stop();
      target.destroy();
      this.addPoint();
      this.spawnTarget();
    });
  }

  private addPoint() {
    this.score += 1;
    this.scoreText.setText(`Score ${this.score}`);
    this.tweens.killTweensOf(this.character);
    this.character.y = CHARACTER_Y;
    this.tweens.add({ targets: this.character, y: CHARACTER_Y - 20, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
  }

  private finish() {
    this.running = false;
    this.input.enabled = false;
    this.timerText.setText('0s');
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "Time's up!", { ...TEXT_STYLE, fontSize: '32px' }).setOrigin(0.5);
    const result: RunResult = { score: this.score };
    EventBus.emit(RUN_FINISHED, result);
  }
}
