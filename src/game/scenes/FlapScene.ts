import Phaser from 'phaser';
import { dayId, MAX_SCORE } from '../../shared/constants';
import { createRandom, hashSeed } from '../../shared/random';
import { COLORS, DISPLAY_FONT, NEON } from '../../shared/theme';
import type { Loadout, RunResult } from '../../shared/types';
import { BIRD_RADIUS, BirdSprite } from '../character/BirdSprite';
import { createTrail } from '../character/trail';
import { setMusicLevel, sfx, vibrate } from '../audio';
import { EventBus, RESTART_RUN, RUN_FINISHED } from '../EventBus';

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

/** How fast the city drifts behind the "tap to fly" prompt. */
const IDLE_SPEED = 40;

const SKYLINE_BACK = 'skyline-back';
const SKYLINE_FAR = 'skyline-far';
const SKYLINE_NEAR = 'skyline-near';
const SKYLINE_WIDTH = 480;
const TWINKLE_TEXTURE = 'twinkle';
const GROUND_TEXTURE = 'neon-ground';
const VIGNETTE_TEXTURE = 'vignette';

/** Parallax: how far each layer moves per pixel the towers move. */
const PARALLAX = { back: 0.05, far: 0.12, near: 0.35, ground: 1 };

/** The music gains a layer at each of these scores. */
const MUSIC_LEVEL_SCORES = [10, 25];

interface Tower {
  x: number;
  gapTop: number;
  gapBottom: number;
  scored: boolean;
  /** Glow top, glow bottom, top, bottom, top lip, bottom lip. */
  parts: Phaser.GameObjects.Rectangle[];
}

interface Point {
  x: number;
  y: number;
}

/**
 * Tap to flap through the gaps in a neon skyline. The tower layout comes from a
 * day-based seed, so everyone flies the same course on the same day.
 */
export class FlapScene extends Phaser.Scene {
  private bird!: BirdSprite;
  private scoreText!: Phaser.GameObjects.Text;
  private skylineBack!: Phaser.GameObjects.TileSprite;
  private skylineFar!: Phaser.GameObjects.TileSprite;
  private skylineNear!: Phaser.GameObjects.TileSprite;
  private twinkle!: Phaser.GameObjects.TileSprite;
  private ground!: Phaser.GameObjects.TileSprite;
  private trail: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  /** Hover and wing beats shown before the first tap. */
  private idle: (Phaser.Tweens.Tween | Phaser.Time.TimerEvent)[] = [];
  private random: () => number = Math.random;
  private towers: Tower[] = [];
  /** Towers that have left the screen, kept for reuse instead of rebuilt. */
  private spareTowers: Tower[] = [];
  private spawned = 0;
  private velocity = 0;
  private score = 0;
  private running = false;
  private dead = false;
  private accumulator = 0;

  // Reused every physics step rather than allocated 120 times a second.
  private readonly hitbox = new Phaser.Geom.Circle();
  private readonly towerTop = new Phaser.Geom.Rectangle();
  private readonly towerBottom = new Phaser.Geom.Rectangle();

  constructor() {
    super('flap');
  }

  create() {
    const loadout = this.registry.get('loadout') as Loadout;
    const courseId = (this.registry.get('courseId') as string | undefined) ?? dayId();
    this.random = createRandom(hashSeed(courseId));
    this.towers = [];
    this.spareTowers = [];
    this.idle = [];
    this.spawned = 0;
    this.velocity = 0;
    this.score = 0;
    this.running = false;
    this.dead = false;
    this.accumulator = 0;
    setMusicLevel(0);

    this.drawCity(courseId);

    this.bird = new BirdSprite(this, BIRD_X, GAME_HEIGHT * 0.4, loadout).setDepth(5);
    this.trail = createTrail(this, this.bird, loadout);
    this.trail?.setDepth(4);

    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 64, '0', {
        fontFamily: DISPLAY_FONT,
        fontSize: '56px',
        fontStyle: '900',
        color: COLORS.text,
        padding: { x: 16, y: 16 },
      })
      .setShadow(0, 0, COLORS.cyan, 14, false, true)
      .setOrigin(0.5)
      .setDepth(10);

    const prompt = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, 'TAP TO FLY', {
        fontFamily: DISPLAY_FONT,
        fontSize: '22px',
        fontStyle: '700',
        color: COLORS.text,
        padding: { x: 16, y: 16 },
      })
      .setLetterSpacing(3)
      .setShadow(0, 0, COLORS.magenta, 12, false, true)
      .setOrigin(0.5)
      .setDepth(10);
    const promptPulse = this.tweens.add({
      targets: prompt,
      alpha: 0.45,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // index.html preloads the font, but text drawn before it arrives keeps the fallback face.
    void document.fonts?.load(`900 56px ${DISPLAY_FONT}`, 'TAPOFLY0123456789').then(() => {
      if (this.scoreText.active) this.scoreText.updateText();
      if (prompt.active) prompt.updateText();
    });

    // Before the first tap the bird hovers and the city drifts, so the start screen isn't frozen.
    this.idle.push(
      this.tweens.add({
        targets: this.bird,
        y: this.bird.y - 10,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
      this.time.addEvent({ delay: 600, loop: true, callback: () => this.bird.flap() }),
    );

    this.input.on('pointerdown', () => {
      if (this.dead) return;
      if (!this.running) {
        this.idle.forEach((motion) => motion.remove());
        promptPulse.remove();
        this.tweens.add({
          targets: prompt,
          alpha: 0,
          y: prompt.y - 16,
          duration: 200,
          ease: 'Quad.easeIn',
          onComplete: () => prompt.destroy(),
        });
        this.running = true;
        setMusicLevel(1);
      }
      this.velocity = FLAP_VELOCITY;
      this.bird.flap();
      sfx.flap();
    });

    // Restarting the scene keeps the game, its WebGL context and its textures between runs.
    const restart = () => this.scene.restart();
    EventBus.on(RESTART_RUN, restart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off(RESTART_RUN, restart));

    // Enough towers to fill the screen before the first flap.
    while (this.towers.length < 4) this.spawnTower();
  }

  update(_time: number, delta: number) {
    if (!this.running) {
      if (!this.dead) this.scrollCity((IDLE_SPEED * delta) / 1000);
      return;
    }
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
    this.scrollCity(distance);

    this.hitbox.setTo(BIRD_X, this.bird.y, BIRD_RADIUS);
    for (const tower of this.towers) {
      tower.x -= distance;
      for (const part of tower.parts) part.x = tower.x - (part.getData('inset') as number);

      if (!tower.scored && tower.x + TOWER_WIDTH < BIRD_X) {
        tower.scored = true;
        this.addPoint();
      }
      if (this.hitsTower(tower)) {
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
      const gone = this.towers.shift()!;
      gone.parts.forEach((part) => part.setVisible(false));
      this.spareTowers.push(gone);
    }
    const last = this.towers[this.towers.length - 1];
    if (!last || last.x < GAME_WIDTH) this.spawnTower();
  }

  private scrollCity(distance: number) {
    this.skylineBack.tilePositionX += distance * PARALLAX.back;
    this.skylineFar.tilePositionX += distance * PARALLAX.far;
    this.skylineNear.tilePositionX += distance * PARALLAX.near;
    this.twinkle.tilePositionX = this.skylineNear.tilePositionX;
    this.ground.tilePositionX += distance * PARALLAX.ground;
  }

  private hitsTower(tower: Tower) {
    this.towerTop.setTo(tower.x, 0, TOWER_WIDTH, tower.gapTop);
    this.towerBottom.setTo(tower.x, tower.gapBottom, TOWER_WIDTH, GROUND_Y - tower.gapBottom);
    return (
      Phaser.Geom.Intersects.CircleToRectangle(this.hitbox, this.towerTop) ||
      Phaser.Geom.Intersects.CircleToRectangle(this.hitbox, this.towerBottom)
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

    const tower = this.spareTowers.pop() ?? this.buildTower();
    Object.assign(tower, { x, gapTop, gapBottom, scored: false });

    // Each part sits `inset` pixels left of the tower's x, and moves with it.
    const place = (part: Phaser.GameObjects.Rectangle, inset: number, y: number, width: number, height: number) =>
      part.setPosition(x - inset, y).setSize(width, height).setData('inset', inset).setVisible(true);

    const [glowTop, glowBottom, top, bottom, lipTop, lipBottom] = tower.parts;
    place(glowTop, 5, -6, TOWER_WIDTH + 10, gapTop + 6).setFillStyle(color, 0.16);
    place(glowBottom, 5, gapBottom, TOWER_WIDTH + 10, GROUND_Y - gapBottom + 6).setFillStyle(color, 0.16);
    place(top, 0, -6, TOWER_WIDTH, gapTop + 6).setStrokeStyle(3, color);
    place(bottom, 0, gapBottom, TOWER_WIDTH, GROUND_Y - gapBottom + 6).setStrokeStyle(3, color);
    // A lit lip either side of the gap, so the opening reads at a glance.
    place(lipTop, 4, gapTop - 8, TOWER_WIDTH + 8, 8).setFillStyle(color, 1);
    place(lipBottom, 4, gapBottom, TOWER_WIDTH + 8, 8).setFillStyle(color, 1);

    this.towers.push(tower);
  }

  private buildTower(): Tower {
    const rect = (depth: number) => this.add.rectangle(0, 0, 1, 1, 0x141a2b, 1).setOrigin(0, 0).setDepth(depth);
    return {
      x: 0,
      gapTop: 0,
      gapBottom: 0,
      scored: false,
      parts: [rect(1), rect(1), rect(2), rect(2), rect(2), rect(2)],
    };
  }

  private addPoint() {
    this.score += 1;
    this.scoreText.setText(`${this.score}`);
    this.tweens.add({ targets: this.scoreText, scale: 1.25, duration: 90, yoyo: true });
    sfx.score();
    if (this.score % 10 === 0) vibrate(20);
    setMusicLevel(1 + MUSIC_LEVEL_SCORES.filter((score) => this.score >= score).length);
    if (this.score >= MAX_SCORE) this.die();
  }

  private die() {
    if (this.dead) return;
    this.dead = true;
    this.running = false;
    this.trail?.stop();
    this.cameras.main.shake(180, 0.008);
    sfx.death();
    vibrate([40, 30, 60]);
    setMusicLevel(0);

    // Report the run straight away. Hanging this on the fall animation's callback meant
    // a bird that died on the ground never finished falling, so the run was never reported.
    const result: RunResult = { score: this.score };
    EventBus.emit(RUN_FINISHED, result);

    this.tweens.add({ targets: this.bird, angle: 95, duration: 260 });
    this.tweens.add({ targets: this.bird, y: GROUND_Y - BIRD_RADIUS, duration: 340, ease: 'Quad.easeIn' });
  }

  /**
   * The near and far skylines draw from the course's random stream before any tower,
   * so they are part of the course: changing how they draw changes every day's towers.
   * Every other layer draws from a stream of its own and can't move a tower.
   */
  private drawCity(courseId: string) {
    const decor = (layer: string) => createRandom(hashSeed(`${courseId}:${layer}`));

    const skyKey = `sky-${courseId}`;
    if (!this.textures.exists(skyKey)) this.makeSkyTexture(skyKey, decor('sky'));
    this.add.image(0, 0, skyKey).setOrigin(0, 0).setDepth(0);

    const backKey = `${SKYLINE_BACK}-${courseId}`;
    if (!this.textures.exists(backKey)) this.makeBackSkylineTexture(backKey, decor('back'));
    this.skylineBack = this.add
      .tileSprite(0, GROUND_Y - 250, GAME_WIDTH, 250, backKey)
      .setOrigin(0, 0)
      .setDepth(0);

    this.makeSkylineTexture(SKYLINE_FAR, 0x1b2350, 170, false);
    const windows = this.makeSkylineTexture(SKYLINE_NEAR, 0x141a33, 210, true);
    this.makeTwinkleTexture(windows, 210, decor('twinkle'));
    this.makeGroundTexture();

    this.skylineFar = this.add.tileSprite(0, GROUND_Y - 170, GAME_WIDTH, 170, SKYLINE_FAR).setOrigin(0, 0).setDepth(0);
    this.skylineNear = this.add.tileSprite(0, GROUND_Y - 210, GAME_WIDTH, 210, SKYLINE_NEAR).setOrigin(0, 0).setDepth(0);
    this.twinkle = this.add
      .tileSprite(0, GROUND_Y - 210, GAME_WIDTH, 210, TWINKLE_TEXTURE)
      .setOrigin(0, 0)
      .setDepth(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    this.tweens.add({ targets: this.twinkle, alpha: 0.9, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.ground = this.add
      .tileSprite(0, GROUND_Y, GAME_WIDTH, GROUND_HEIGHT, GROUND_TEXTURE)
      .setOrigin(0, 0)
      .setDepth(3);

    if (!this.textures.exists(VIGNETTE_TEXTURE)) this.makeVignetteTexture();
    this.add.image(0, 0, VIGNETTE_TEXTURE).setOrigin(0, 0).setDepth(9);
  }

  /** Night gradient, a magenta haze over the city, stars and a moon. */
  private makeSkyTexture(key: string, random: () => number) {
    const texture = this.textures.createCanvas(key, GAME_WIDTH, GAME_HEIGHT)!;
    const ctx = texture.getContext();

    const sky = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    sky.addColorStop(0, '#05071a');
    sky.addColorStop(0.5, '#141539');
    sky.addColorStop(1, '#35194f');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const haze = ctx.createRadialGradient(GAME_WIDTH / 2, GROUND_Y, 0, GAME_WIDTH / 2, GROUND_Y, GAME_WIDTH * 0.9);
    haze.addColorStop(0, 'rgb(255 61 240 / 0.28)');
    haze.addColorStop(1, 'rgb(255 61 240 / 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    for (let i = 0; i < 80; i++) {
      const x = Math.round(random() * GAME_WIDTH);
      const y = Math.round(random() * GAME_HEIGHT * 0.62);
      const size = random() < 0.85 ? 1 : 2;
      ctx.fillStyle = `rgb(255 255 255 / ${0.25 + random() * 0.65})`;
      ctx.fillRect(x, y, size, size);
    }

    const moonX = GAME_WIDTH * 0.74;
    const moonY = 118;
    const glow = ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, 90);
    glow.addColorStop(0, 'rgb(255 236 200 / 0.35)');
    glow.addColorStop(1, 'rgb(255 236 200 / 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(moonX - 90, moonY - 90, 180, 180);
    ctx.fillStyle = '#fff1d6';
    ctx.beginPath();
    ctx.arc(moonX, moonY, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgb(214 196 170 / 0.55)';
    const craters: [number, number, number][] = [
      [-8, -6, 5],
      [7, 5, 4],
      [-2, 11, 3],
    ];
    for (const [dx, dy, r] of craters) {
      ctx.beginPath();
      ctx.arc(moonX + dx, moonY + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    texture.refresh();
  }

  /** Distant towers with lit spires, only a shade lighter than the sky. */
  private makeBackSkylineTexture(key: string, random: () => number) {
    const height = 250;
    const g = this.make.graphics({}, false);
    let x = 0;
    while (x < SKYLINE_WIDTH) {
      const width = 20 + Math.floor(random() * 34);
      const top = height - 90 - Math.floor(random() * 150);
      g.fillStyle(0x221c4a, 1);
      g.fillRect(x, top, width, height - top);
      if (random() > 0.6) {
        g.fillRect(x + width / 2 - 1, top - 22, 2, 22);
        g.fillStyle(0xff3df0, 0.8);
        g.fillRect(x + width / 2 - 1.5, top - 24, 3, 3);
      }
      x += width + 2 + Math.floor(random() * 10);
    }
    g.generateTexture(key, SKYLINE_WIDTH, height);
    g.destroy();
  }

  /** Returns the lit windows it drew, so the twinkle layer can line up with them. */
  private makeSkylineTexture(key: string, color: number, height: number, windows: boolean): Point[] {
    if (this.textures.exists(key)) this.textures.remove(key);
    const lit: Point[] = [];
    const g = this.make.graphics({}, false);
    let x = 0;
    while (x < SKYLINE_WIDTH) {
      const buildingWidth = 26 + Math.floor(this.random() * 42);
      const buildingHeight = 50 + Math.floor(this.random() * (height - 60));
      g.fillStyle(color, 1);
      g.fillRect(x, height - buildingHeight, buildingWidth, buildingHeight);
      if (windows) {
        g.fillStyle(0xffe9a8, 0.5);
        for (let wy = height - buildingHeight + 10; wy < height - 12; wy += 15) {
          for (let wx = x + 7; wx < x + buildingWidth - 8; wx += 13) {
            if (this.random() > 0.45) {
              g.fillRect(wx, wy, 5, 7);
              lit.push({ x: wx, y: wy });
            }
          }
        }
      }
      x += buildingWidth + 5 + Math.floor(this.random() * 14);
    }
    g.generateTexture(key, SKYLINE_WIDTH, height);
    g.destroy();
    return lit;
  }

  /** Some of the near skyline's lit windows, brighter; the layer fades in and out as one. */
  private makeTwinkleTexture(windows: Point[], height: number, random: () => number) {
    if (this.textures.exists(TWINKLE_TEXTURE)) this.textures.remove(TWINKLE_TEXTURE);
    const g = this.make.graphics({}, false);
    g.fillStyle(0xfff6d0, 1);
    for (const window of windows) {
      if (random() < 0.14) g.fillRect(window.x, window.y, 5, 7);
    }
    g.generateTexture(TWINKLE_TEXTURE, SKYLINE_WIDTH, height);
    g.destroy();
  }

  private makeGroundTexture() {
    if (this.textures.exists(GROUND_TEXTURE)) return;
    const g = this.make.graphics({}, false);
    g.fillStyle(0x0a0d1c, 1);
    g.fillRect(0, 0, 120, GROUND_HEIGHT);
    // The skyline's glow reflected on the street.
    for (let y = 3; y < 19; y++) {
      g.fillStyle(0x36e2ff, 0.22 * (1 - (y - 3) / 16));
      g.fillRect(0, y, 120, 1);
    }
    g.fillStyle(0x36e2ff, 1);
    g.fillRect(0, 0, 120, 3);
    g.fillStyle(0xff3df0, 0.65);
    for (let x = 0; x < 120; x += 30) g.fillRect(x, 26, 16, 4);
    g.fillStyle(0xff3df0, 0.1);
    for (let x = 0; x < 120; x += 30) g.fillRect(x, 34, 2, GROUND_HEIGHT - 34);
    g.generateTexture(GROUND_TEXTURE, 120, GROUND_HEIGHT);
    g.destroy();
  }

  /** Darkened edges, drawn once and laid over everything but the score. */
  private makeVignetteTexture() {
    const texture = this.textures.createCanvas(VIGNETTE_TEXTURE, GAME_WIDTH, GAME_HEIGHT)!;
    const ctx = texture.getContext();
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT * 0.45;
    const shade = ctx.createRadialGradient(cx, cy, GAME_HEIGHT * 0.3, cx, cy, GAME_HEIGHT * 0.72);
    shade.addColorStop(0, 'rgb(0 0 0 / 0)');
    shade.addColorStop(1, 'rgb(0 0 0 / 0.5)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    texture.refresh();
  }
}
