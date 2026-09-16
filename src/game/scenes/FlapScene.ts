import Phaser from 'phaser';
import { dayId, MAX_SCORE } from '../../shared/constants';
import { createRandom, hashSeed } from '../../shared/random';
import type { Loadout, RunResult } from '../../shared/types';
import { BIRD_RADIUS, BirdSprite } from '../character/BirdSprite';
import { createTrail } from '../character/trail';
import { EventBus, RUN_FINISHED } from '../EventBus';

export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 640;

const GROUND_HEIGHT = 70;
const GROUND_Y = GAME_HEIGHT - GROUND_HEIGHT;
const BIRD_X = 96;

// Flight feel. Gravity and the flap kick are in pixels per second.
const GRAVITY = 1500;
const FLAP_VELOCITY = -430;
const MAX_FALL_SPEED = 780;
const PHYSICS_STEP_MS = 1000 / 120;

// Towers. The gap shrinks and the course speeds up the further you get.
const TOWER_WIDTH = 58;
const TOWER_SPACING = 210;
const GAP_START = 190;
const GAP_MIN = 132;
const GAP_SHRINK = 2.5;
const GAP_MARGIN = 74;
const SPEED_START = 155;
const SPEED_MAX = 260;
const SPEED_GAIN = 1.6;
const NEON = [0x36e2ff, 0xff3df0, 0xb77cff, 0x5cff87];

const SKYLINE_FAR = 'skyline-far';
const SKYLINE_NEAR = 'skyline-near';
const GROUND_TEXTURE = 'neon-ground';

interface Tower {
  x: number;
  gapTop: number;
  gapBottom: number;
  scored: boolean;
  parts: Phaser.GameObjects.Rectangle[];
}

/**
 * Tap to flap through the gaps in a neon skyline. The tower layout comes from a
 * day-based seed, so everyone flies the same course on the same day.
 */
export class FlapScene extends Phaser.Scene {
  private bird!: BirdSprite;
  private scoreText!: Phaser.GameObjects.Text;
  private skylineFar!: Phaser.GameObjects.TileSprite;
  private skylineNear!: Phaser.GameObjects.TileSprite;
  private ground!: Phaser.GameObjects.TileSprite;
  private trail: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private random: () => number = Math.random;
  private towers: Tower[] = [];
  private spawned = 0;
  private velocity = 0;
  private score = 0;
  private running = false;
  private dead = false;
  private accumulator = 0;

  constructor() {
    super('flap');
  }

  create() {
    const loadout = this.registry.get('loadout') as Loadout;
    const courseId = (this.registry.get('courseId') as string | undefined) ?? dayId();
    this.random = createRandom(hashSeed(courseId));
    this.towers = [];
    this.spawned = 0;
    this.velocity = 0;
    this.score = 0;
    this.running = false;
    this.dead = false;
    this.accumulator = 0;

    this.drawCity();

    this.bird = new BirdSprite(this, BIRD_X, GAME_HEIGHT * 0.4, loadout).setDepth(5);
    this.trail = createTrail(this, this.bird, loadout);
    this.trail?.setDepth(4);

    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 56, '0', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '56px',
        color: '#ffffff',
        stroke: '#36e2ff',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(10);

    const prompt = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, 'TAP TO FLY', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
        stroke: '#ff3df0',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.input.on('pointerdown', () => {
      if (this.dead) return;
      if (!this.running) {
        prompt.destroy();
        this.running = true;
      }
      this.velocity = FLAP_VELOCITY;
      this.bird.flap();
    });

    // Enough towers to fill the screen before the first flap.
    while (this.towers.length < 4) this.spawnTower();
  }

  update(_time: number, delta: number) {
    if (!this.running) return;
    this.accumulator = Math.min(this.accumulator + delta, 100);
    while (this.accumulator >= PHYSICS_STEP_MS) {
      this.step(PHYSICS_STEP_MS / 1000);
      this.accumulator -= PHYSICS_STEP_MS;
    }
    // Nose up while climbing, dive while falling.
    this.bird.setAngle(Phaser.Math.Clamp(this.velocity * 0.06, -28, 80));
  }

  private get speed() {
    return Math.min(SPEED_MAX, SPEED_START + this.score * SPEED_GAIN);
  }

  private step(dt: number) {
    this.velocity = Math.min(this.velocity + GRAVITY * dt, MAX_FALL_SPEED);
    this.bird.y += this.velocity * dt;
    if (this.bird.y < BIRD_RADIUS) {
      this.bird.y = BIRD_RADIUS;
      this.velocity = 0;
    }

    const distance = this.speed * dt;
    this.skylineFar.tilePositionX += distance * 0.12;
    this.skylineNear.tilePositionX += distance * 0.35;
    this.ground.tilePositionX += distance;

    const hitbox = new Phaser.Geom.Circle(BIRD_X, this.bird.y, BIRD_RADIUS);
    for (const tower of this.towers) {
      tower.x -= distance;
      for (const part of tower.parts) part.x = tower.x - (part.getData('inset') as number);

      if (!tower.scored && tower.x + TOWER_WIDTH < BIRD_X) {
        tower.scored = true;
        this.addPoint();
      }
      if (this.hitsTower(hitbox, tower)) {
        this.die();
        return;
      }
    }

    if (this.bird.y + BIRD_RADIUS >= GROUND_Y) {
      this.bird.y = GROUND_Y - BIRD_RADIUS;
      this.die();
      return;
    }

    while (this.towers.length > 0 && this.towers[0].x + TOWER_WIDTH < -40) {
      const gone = this.towers.shift();
      gone?.parts.forEach((part) => part.destroy());
    }
    const last = this.towers[this.towers.length - 1];
    if (!last || last.x < GAME_WIDTH) this.spawnTower();
  }

  private hitsTower(hitbox: Phaser.Geom.Circle, tower: Tower) {
    const top = new Phaser.Geom.Rectangle(tower.x, 0, TOWER_WIDTH, tower.gapTop);
    const bottom = new Phaser.Geom.Rectangle(tower.x, tower.gapBottom, TOWER_WIDTH, GROUND_Y - tower.gapBottom);
    return (
      Phaser.Geom.Intersects.CircleToRectangle(hitbox, top) ||
      Phaser.Geom.Intersects.CircleToRectangle(hitbox, bottom)
    );
  }

  private spawnTower() {
    const previous = this.towers[this.towers.length - 1];
    const x = previous ? previous.x + TOWER_SPACING : GAME_WIDTH + 80;
    const gapHeight = Math.max(GAP_MIN, GAP_START - this.spawned * GAP_SHRINK);
    const gapCenter = GAP_MARGIN + this.random() * (GROUND_Y - GAP_MARGIN * 2);
    const gapTop = gapCenter - gapHeight / 2;
    const gapBottom = gapCenter + gapHeight / 2;
    const color = NEON[this.spawned % NEON.length];
    this.spawned += 1;

    const parts: Phaser.GameObjects.Rectangle[] = [];
    const addPart = (px: number, py: number, width: number, height: number, fill: number, alpha: number, glow: boolean) => {
      const rect = this.add.rectangle(px, py, width, height, fill, alpha).setOrigin(0, 0).setDepth(glow ? 1 : 2);
      if (!glow) rect.setStrokeStyle(3, color);
      rect.setData('inset', x - px);
      parts.push(rect);
    };

    addPart(x - 5, -6, TOWER_WIDTH + 10, gapTop + 6, color, 0.16, true);
    addPart(x - 5, gapBottom, TOWER_WIDTH + 10, GROUND_Y - gapBottom + 6, color, 0.16, true);
    addPart(x, -6, TOWER_WIDTH, gapTop + 6, 0x141a2b, 1, false);
    addPart(x, gapBottom, TOWER_WIDTH, GROUND_Y - gapBottom + 6, 0x141a2b, 1, false);

    this.towers.push({ x, gapTop, gapBottom, scored: false, parts });
  }

  private addPoint() {
    this.score += 1;
    this.scoreText.setText(`${this.score}`);
    this.tweens.add({ targets: this.scoreText, scale: 1.25, duration: 90, yoyo: true });
    if (this.score >= MAX_SCORE) this.die();
  }

  private die() {
    if (this.dead) return;
    this.dead = true;
    this.running = false;
    this.trail?.stop();
    this.cameras.main.shake(180, 0.008);

    // Report the run straight away. Hanging this on the fall animation's callback meant
    // a bird that died on the ground never finished falling, so the run was never reported.
    const result: RunResult = { score: this.score };
    EventBus.emit(RUN_FINISHED, result);

    this.tweens.add({ targets: this.bird, angle: 95, duration: 260 });
    this.tweens.add({ targets: this.bird, y: GROUND_Y - BIRD_RADIUS, duration: 340, ease: 'Quad.easeIn' });
  }

  private drawCity() {
    const sky = this.add.graphics().setDepth(0);
    sky.fillGradientStyle(0x080b1c, 0x080b1c, 0x35194f, 0x122045, 1);
    sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.makeSkylineTexture(SKYLINE_FAR, 0x1b2350, 170, false);
    this.makeSkylineTexture(SKYLINE_NEAR, 0x141a33, 210, true);
    this.makeGroundTexture();

    this.skylineFar = this.add.tileSprite(0, GROUND_Y - 170, GAME_WIDTH, 170, SKYLINE_FAR).setOrigin(0, 0).setDepth(0);
    this.skylineNear = this.add.tileSprite(0, GROUND_Y - 210, GAME_WIDTH, 210, SKYLINE_NEAR).setOrigin(0, 0).setDepth(0);
    this.ground = this.add
      .tileSprite(0, GROUND_Y, GAME_WIDTH, GROUND_HEIGHT, GROUND_TEXTURE)
      .setOrigin(0, 0)
      .setDepth(3);
  }

  private makeSkylineTexture(key: string, color: number, height: number, windows: boolean) {
    const width = 480;
    if (this.textures.exists(key)) this.textures.remove(key);
    const g = this.make.graphics({}, false);
    let x = 0;
    while (x < width) {
      const buildingWidth = 26 + Math.floor(this.random() * 42);
      const buildingHeight = 50 + Math.floor(this.random() * (height - 60));
      g.fillStyle(color, 1);
      g.fillRect(x, height - buildingHeight, buildingWidth, buildingHeight);
      if (windows) {
        g.fillStyle(0xffe9a8, 0.5);
        for (let wy = height - buildingHeight + 10; wy < height - 12; wy += 15) {
          for (let wx = x + 7; wx < x + buildingWidth - 8; wx += 13) {
            if (this.random() > 0.45) g.fillRect(wx, wy, 5, 7);
          }
        }
      }
      x += buildingWidth + 5 + Math.floor(this.random() * 14);
    }
    g.generateTexture(key, width, height);
    g.destroy();
  }

  private makeGroundTexture() {
    if (this.textures.exists(GROUND_TEXTURE)) return;
    const g = this.make.graphics({}, false);
    g.fillStyle(0x0c1020, 1);
    g.fillRect(0, 0, 120, GROUND_HEIGHT);
    g.fillStyle(0x36e2ff, 1);
    g.fillRect(0, 0, 120, 3);
    g.fillStyle(0xff3df0, 0.65);
    for (let x = 0; x < 120; x += 30) g.fillRect(x, 22, 16, 4);
    g.generateTexture(GROUND_TEXTURE, 120, GROUND_HEIGHT);
    g.destroy();
  }
}
