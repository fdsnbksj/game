import Phaser from 'phaser';
import type { Battle, BoardStore } from '../../boardStore';
import { useRunStore } from '../../runStore';
import { DISPLAY_FONT, readBoardPalette, type BoardPalette } from '../../shared/theme';
import { BENCH_SIZE, getUnit, MOVE_TICKS, OVERTIME_TICK, TICKS_PER_SECOND, type Star } from '../../sim/balance';
import type { BattleEvent, FighterInfo, Placed } from '../../sim/combat';
import { COLS, distance, ROWS, SIDE_CELLS, toBattleCell } from '../../sim/hex';
import { move, sell, type OwnedUnit, type Slot } from '../../sim/planning';
import { sfx, vibrate } from '../audio';
import { project, projectHex, scaleAtScreenY, unproject, type Tilt } from '../battle/projection';
import {
  creatureHeight,
  creatureKey,
  creatureScale,
  ensureCreatureTextures,
  ensureItemTextures,
  FEET_ORIGIN,
  itemKey,
  itemScale,
} from '../battle/textures';
import { getBottomInset, isOverSellZone, onInsetChange, registerSlotAt } from '../boardBridge';

// World units. The canvas is sized to its container in device pixels and the camera zooms
// to fit, so these are a layout grid rather than a size.
export const BOARD_WIDTH = 360;
export const BOARD_HEIGHT = 400;

// The table, laid out flat: a top-down hex grid in the sim's shape. It's drawn tilted away
// from the viewer through TILT, so these are the table's own units, not the screen's.
const R = 26;
const HEX_W = Math.sqrt(3) * R;
const ROW_STEP = 1.5 * R;
const BOARD_X = (BOARD_WIDTH - 7.5 * HEX_W) / 2;
const BOARD_Y = 0;
/** The two halves sit this far apart, so the gap marks the line between them. */
const HALF_GAP = 6;
/** Tiles are drawn this much smaller than the grid, so the floor shows between them. */
const CELL_R = R - 2.5;
/** The floor reaches this far past the outermost tiles. */
const FLOOR_PAD = 10;
const FLAT_MID = BOARD_Y + R + 3.5 * ROW_STEP + HALF_GAP / 2;

/** Room above the far edge for the far row's creatures and nameplates. */
const HEADROOM = 66;
const TILT: Tilt = {
  cx: BOARD_WIDTH / 2,
  top: BOARD_Y - FLOOR_PAD,
  bottom: BOARD_Y + 7 * ROW_STEP + 2 * R + HALF_GAP + FLOOR_PAD,
  screenTop: HEADROOM,
  far: 0.76,
  squash: 0.8,
};
const at = (x: number, y: number) => project(TILT, x, y);

/** The table's front edge, and how thick it looks. */
const FLOOR_BOTTOM = at(TILT.cx, TILT.bottom).y;
const RIM = 9;
/** Where the two halves meet, on screen. */
const MID_Y = at(TILT.cx, FLAT_MID).y;

// The bench is a straight shelf in front of the table, at the near edge's scale.
const BENCH_SLOT = 38;
const BENCH_GAP = 2;
const BENCH_X = (BOARD_WIDTH - (BENCH_SIZE * BENCH_SLOT + (BENCH_SIZE - 1) * BENCH_GAP)) / 2;
const BENCH_Y = FLOOR_BOTTOM + RIM + 16 + BENCH_SLOT / 2;
/** Where a benched creature's feet go: low on its pad, so it stands on it. */
const BENCH_FEET = BENCH_Y + BENCH_SLOT / 2 - 7;

/** A 1-cost creature's drawn size at the near edge; dearer ones are a little bigger. */
const UNIT_SIZE = 54;
const unitSize = (unitId: string) => UNIT_SIZE * (1 + (getUnit(unitId).cost - 1) * 0.05);

// The nameplate over a creature's head: stars, then health with the item beside it, then
// mana. Its own origin is the bottom of the mana line.
const PLATE_W = 30;
const HP_H = 5;
const MANA_H = 2;
const PLATE_GAP = 1.5;
const ITEM_SIZE = 11;
const ITEM_GAP = 2;
const HP_Y = -(HP_H + PLATE_GAP + MANA_H);
/** Space between the top of a head and its nameplate. */
const PLATE_LIFT = 5;

/** How long a press on a creature has to be held to peek at it. */
const LONG_PRESS_MS = 380;
/** Breathing room around whichever part of the board the camera is showing. */
const VIEW_PAD = 6;
/** How long the camera takes to reveal the rival's half, and to come back. */
const VIEW_TWEEN_MS = 520;
const MS_PER_TICK = 1000 / TICKS_PER_SECOND;
/** Pause on the final frame before handing back to planning. */
const END_PAUSE_TICKS = 30;

const TABLE_LEFT = at(BOARD_X - FLOOR_PAD, TILT.bottom).x;
const VIEW_LEFT = Math.min(TABLE_LEFT, BENCH_X) - VIEW_PAD;
const VIEW_WIDTH = BOARD_WIDTH - 2 * VIEW_LEFT;

/** The near half and the bench: what the camera shows while planning. */
function planningRect() {
  const top = MID_Y - 64;
  return new Phaser.Geom.Rectangle(VIEW_LEFT, top, VIEW_WIDTH, BENCH_Y + BENCH_SLOT / 2 + VIEW_PAD - top);
}

/** The whole table, without the bench: what the camera shows during a fight. */
function fightRect() {
  const top = 6;
  return new Phaser.Geom.Rectangle(VIEW_LEFT, top, VIEW_WIDTH, FLOOR_BOTTOM + RIM + VIEW_PAD - top);
}

/** Everything there is to show: the table and the bench. */
function contentRect() {
  const board = fightRect();
  return new Phaser.Geom.Rectangle(board.x, board.y, board.width, BENCH_Y + BENCH_SLOT / 2 + VIEW_PAD - board.y);
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** A cell's centre on the flat table. */
function flatCell(battleCell: number) {
  const row = Math.floor(battleCell / COLS);
  const col = battleCell % COLS;
  const gap = row >= ROWS / 2 ? HALF_GAP : 0;
  return { x: BOARD_X + HEX_W * (col + 0.5 * (row & 1)) + HEX_W / 2, y: BOARD_Y + R + row * ROW_STEP + gap };
}

/** Where a creature standing on a cell has its feet, on screen. */
function cellPoint(battleCell: number) {
  const { x, y } = flatCell(battleCell);
  return at(x, y);
}

function slotCenter(slot: Slot) {
  if (slot.area === 'board') return cellPoint(toBattleCell(slot.index, 'a'));
  return { x: BENCH_X + slot.index * (BENCH_SLOT + BENCH_GAP) + BENCH_SLOT / 2, y: BENCH_FEET, scale: 1 };
}

/** A cell's tile as it lies on the tilted table. */
function tilePoints(battleCell: number, radius = CELL_R) {
  const { x, y } = flatCell(battleCell);
  return projectHex(TILT, x, y, radius);
}

/** Benched creatures are drawn a little smaller, to fit their pads. */
const BENCH_SCALE = 0.78;

/** How big a creature is drawn where it stands: shrinking up the table, and smaller on the bench. */
const depthScale = (y: number) => (y > FLOOR_BOTTOM + RIM ? BENCH_SCALE : Phaser.Math.Clamp(scaleAtScreenY(TILT, y), TILT.far, 1));

/**
 * A creature standing on the table, with its team's ring on the floor under it and one
 * nameplate over its head: its stars (from 2★), then the health bar with the held item
 * beside it, then mana. Planning shows the same plate without the bars, so the stars and
 * item don't move when a fight starts. The plate lives above every creature, so a nearer
 * one never hides a farther one's health; follow() keeps it over this one's head.
 */
class UnitView extends Phaser.GameObjects.Container {
  readonly image: Phaser.GameObjects.Image;
  /** The creature and its ring, scaled for how far up the table it stands. */
  readonly figure: Phaser.GameObjects.Container;
  protected readonly plate: Phaser.GameObjects.Container;
  private ring: Phaser.GameObjects.Graphics;
  private stars: Phaser.GameObjects.Graphics;
  private badge: Phaser.GameObjects.Image;
  private readonly size: number;
  private readonly cost: number;
  private readonly stand: number;
  depth3d = 1;
  /** A hit squashes the creature (positive) and a cast stretches it (negative); tweened back to 0. */
  squash = 0;
  /** So creatures side by side don't breathe in step. */
  private readonly phase = Math.random() * Math.PI * 2;
  private readonly baseScale: number;
  star: Star = 1;
  item?: string;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    unitId: string,
    star: Star,
    protected palette: BoardPalette,
    plates: Phaser.GameObjects.Layer,
    item?: string,
    readonly side: 'a' | 'b' = 'a',
  ) {
    super(scene, x, y);
    this.size = unitSize(unitId);
    this.cost = getUnit(unitId).cost;
    this.stand = creatureHeight(unitId) * this.size;
    this.ring = scene.add.graphics();
    this.drawRing();
    this.baseScale = creatureScale(this.size);
    this.image = scene.add.image(0, 0, creatureKey(unitId)).setOrigin(0.5, FEET_ORIGIN).setScale(this.baseScale);
    this.figure = scene.add.container(0, 0, [this.ring, this.image]);
    this.add(this.figure);
    this.stars = scene.add.graphics();
    this.badge = scene.add.image(0, HP_Y + (HP_H + PLATE_GAP + MANA_H) / 2, '__DEFAULT').setVisible(false);
    this.plate = scene.add.container(0, 0, [this.stars, this.badge]);
    plates.add(this.plate);
    this.setStar(star);
    this.setItem(item);
    // The hit box covers the body, which stands above the feet this sits on.
    this.setSize(UNIT_SIZE, UNIT_SIZE + 6);
    scene.add.existing(this);
    this.follow(0, false);
  }

  /** The hit area for dragging: the body above the feet (see setSize). */
  static readonly HIT = new Phaser.Geom.Rectangle(0, -UNIT_SIZE / 2 - 3, UNIT_SIZE, UNIT_SIZE + 6);

  /**
   * Whether a press lands on the creature as it's drawn now. A fixed box would be too big
   * for creatures up the table, which are drawn smaller, and reach over the one behind:
   * a press on that one would pick up the nearer one instead. Local coordinates put the
   * box's middle at x = UNIT_SIZE / 2 and the feet at y = (UNIT_SIZE + 6) / 2.
   */
  static hitTest(_area: Phaser.Geom.Rectangle, x: number, y: number, view: UnitView): boolean {
    const scale = view.depth3d;
    const feet = (UNIT_SIZE + 6) / 2;
    const halfWidth = (UNIT_SIZE * scale) / 2;
    // The creature's own height, and a little over its head for the nameplate.
    const height = Math.max(view.headHeight, UNIT_SIZE * 0.5 * scale) + 6;
    return Math.abs(x - UNIT_SIZE / 2) <= halfWidth && y <= feet + 3 && y >= feet - height;
  }

  /** How high the top of the head is above the feet, as drawn now. */
  get headHeight() {
    return this.stand * this.depth3d * this.scaleY;
  }

  /** The middle of the body, for things that fly to or from it. */
  get bodyY() {
    return this.y - this.headHeight / 2;
  }

  /** Sizes the creature for where it stands and keeps its plate over its head; every frame. */
  follow(now: number, motion: boolean) {
    this.depth3d = depthScale(this.y);
    this.figure.setScale(this.depth3d);
    // A slow breath, and any squash or stretch, pivoting on the feet.
    const breath = motion ? Math.sin(now / 420 + this.phase) * 0.018 : 0;
    this.image.setScale(this.baseScale * (1 + this.squash * 0.08), this.baseScale * (1 + breath - this.squash * 0.14));
    this.plate
      .setPosition(this.x, this.y - this.headHeight - PLATE_LIFT)
      .setVisible(this.visible)
      .setAlpha(this.alpha)
      .setScale(Math.min(1, this.scaleX));
    // Nearer creatures stand in front of farther ones.
    if (this.depth < 30) this.setDepth(10 + this.y / 100);
  }

  /** Left edge of the health bar. The plate is centred as a whole, item included. */
  protected get plateLeft() {
    return -(PLATE_W + (this.item ? ITEM_GAP + ITEM_SIZE : 0)) / 2;
  }

  /** A soft shadow at the feet, and a ring round it in the creature's rarity colour. */
  private drawRing() {
    const color = this.palette.tier[this.cost - 1];
    const w = this.size * 0.7;
    const h = this.size * 0.24;
    this.ring.clear();
    this.ring.fillStyle(this.palette.shadow, this.palette.shadowAlpha).fillEllipse(0, 0, w * 0.86, h * 0.8);
    this.ring.fillStyle(color, 0.16).fillEllipse(0, 0, w, h);
    this.ring.lineStyle(2, color, 0.9).strokeEllipse(0, 0, w, h);
  }

  /** Redraws everything that carries a colour, after the scheme changes. */
  applyPalette(palette: BoardPalette) {
    this.palette = palette;
    this.drawRing();
    this.layoutPlate();
  }

  setItem(item?: string) {
    this.item = item;
    if (item) this.badge.setTexture(itemKey(item)).setScale(itemScale(ITEM_SIZE));
    this.badge.setVisible(item !== undefined);
    this.layoutPlate();
  }

  setStar(star: Star) {
    this.star = star;
    this.layoutPlate();
  }

  /** Places the item and stars around the health bar; a fighter also redraws its bars. */
  protected layoutPlate() {
    const left = this.plateLeft;
    this.badge.setX(left + PLATE_W + ITEM_GAP + ITEM_SIZE / 2);
    // A 1★ unit is the default and shows nothing; 2★ and 3★ show silver or gold stars.
    this.stars.clear();
    if (this.star > 1) {
      this.stars.fillStyle(this.palette.star[this.star - 1], 1).lineStyle(1, this.palette.shadow, 0.5);
      const cx = left + PLATE_W / 2;
      for (let i = 0; i < this.star; i++) {
        const points = starPoints(cx + (i - (this.star - 1) / 2) * 8, HP_Y - 6, 3.6);
        this.stars.fillPoints(points, true).strokePoints(points, true);
      }
    }
  }

  destroy(fromScene?: boolean) {
    this.plate.destroy(fromScene);
    super.destroy(fromScene);
  }
}

function starPoints(cx: number, cy: number, radius: number) {
  const points: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const angle = Phaser.Math.DegToRad(-90 + 36 * i);
    points.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  return points;
}

class FighterView extends UnitView {
  hp: number;
  shield = 0;
  mana: number;
  private readonly bars: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, readonly info: FighterInfo, palette: BoardPalette, plates: Phaser.GameObjects.Layer) {
    const { x, y } = cellPoint(info.cell);
    super(scene, x, y, info.unitId, info.star, palette, plates, info.item, info.side);
    this.hp = info.hp;
    this.mana = info.mana;
    this.bars = scene.add.graphics();
    this.plate.add(this.bars);
    this.drawBars();
  }

  protected layoutPlate() {
    super.layoutPlate();
    this.drawBars();
  }

  /** Health in the team's colour with any shield after it, and mana in a line below. */
  drawBars() {
    // The base constructor lays out the plate before this one has made its bars.
    if (!this.bars) return;
    const x = this.plateLeft;
    const total = this.info.maxHp + this.shield;
    const hpWidth = (PLATE_W * this.hp) / total;
    const manaY = HP_Y + HP_H + PLATE_GAP;
    const p = this.palette;
    this.bars.clear();
    // A dark backing, so the bar reads over any creature or floor.
    this.bars.fillStyle(p.shadow, 0.55).fillRoundedRect(x - 1.5, HP_Y - 1.5, PLATE_W + 3, HP_H + PLATE_GAP + MANA_H + 3, 3);
    this.bars.fillStyle(p.track, p.trackAlpha).fillRoundedRect(x, HP_Y, PLATE_W, HP_H, HP_H / 2);
    this.bars.fillRoundedRect(x, manaY, PLATE_W, MANA_H, MANA_H / 2);
    if (this.shield > 0) {
      this.bars.fillStyle(p.shield).fillRoundedRect(x, HP_Y, Math.min(PLATE_W, hpWidth + (PLATE_W * this.shield) / total), HP_H, HP_H / 2);
    }
    if (this.hp > 0) this.bars.fillStyle(this.side === 'a' ? p.mine : p.rival).fillRoundedRect(x, HP_Y, Math.max(HP_H, hpWidth), HP_H, HP_H / 2);
    if (this.mana > 0) {
      this.bars.fillStyle(p.mana).fillRoundedRect(x, manaY, Math.max(MANA_H, (PLATE_W * this.mana) / this.info.maxMana), MANA_H, MANA_H / 2);
    }
  }
}

interface Replay {
  battle: Battle;
  elapsed: number;
  next: number;
  finished: boolean;
  overtimeShown: boolean;
}

/**
 * Planning: the player's half of the board and the bench, where units are dragged about.
 * Combat: a replay of a fight that has already been simulated, driven by its event log.
 */
export class BattleScene extends Phaser.Scene {
  private views = new Map<number, UnitView>();
  /** A puzzle's rival, standing on its half while the player plans. */
  private previews: UnitView[] = [];
  private fighters: FighterView[] = [];
  private replay: Replay | null = null;
  private highlight!: Phaser.GameObjects.Graphics;
  /** A press being held on a creature, which becomes a peek at its essentials. */
  private holding: Phaser.Time.TimerEvent | null = null;
  /** The press that just peeked, so letting go of it doesn't also open the sheet. */
  private peeked = false;
  private board!: Phaser.GameObjects.Graphics;
  /** Drawn apart from the board so it can fade out while a fight is on. */
  private bench!: Phaser.GameObjects.Graphics;
  private palette: BoardPalette = readBoardPalette();
  private effects!: Phaser.GameObjects.Layer;
  /** Every nameplate, above every creature. */
  private plates!: Phaser.GameObjects.Layer;
  private lastHitSound = 0;
  /** The unit under the player's finger; sync leaves it where it is. */
  private dragging: UnitView | null = null;
  /** Ends the window listener that follows a unit drag, including off the canvas. */
  private stopFollowing: (() => void) | null = null;
  /** Where the finger was last seen during a unit drag, in client pixels. */
  private dragClient = { x: 0, y: 0 };
  private view: 'planning' | 'fight' = 'planning';
  /** Device pixels per world pixel, so text is baked at the screen's density. */
  private textResolution = 2;
  /**
   * False once the scene has been shut down or destroyed. The store subscription can outlive
   * the scene, so everything it reaches guards on this. `sys.isActive()` can't do the job:
   * it's still false during create(), where the first sync has to run.
   */
  private alive = false;
  /** The mode using the board: a run unless the screen hands it another through the registry. */
  private store: BoardStore = useRunStore;

  constructor() {
    super('battle');
  }

  create() {
    this.alive = true;
    this.store = (this.registry.get('store') as BoardStore | undefined) ?? useRunStore;
    this.textResolution = Math.max(1, Math.round(1 / (this.scale.zoom || 1)));
    this.palette = readBoardPalette();
    this.board = this.add.graphics().setDepth(0);
    this.bench = this.add.graphics().setDepth(0);
    this.showView('planning', false);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this));
    ensureCreatureTextures(this);
    ensureItemTextures(this);
    this.drawBoard();
    this.highlight = this.add.graphics().setDepth(1);
    this.plates = this.add.layer().setDepth(35);
    this.effects = this.add.layer().setDepth(40);
    this.input.dragDistanceThreshold = 6;
    this.setUpDragging();

    this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.store.getState().select(null);
    });
    this.input.on('pointerup', () => this.letGo());

    const unsubscribe = this.store.subscribe((state, previous) => {
      // Compared by result: marking a fight over makes a new battle object for the same fight.
      const battleChanged = state.battle?.result !== previous.battle?.result;
      if (battleChanged) {
        if (state.battle) this.startReplay(state.battle);
        else this.stopReplay();
      }
      // Ending a replay changes only the battle, but the planning units have to reappear.
      // The peek closing takes its range off the board.
      const peekClosed = previous.peek !== null && state.peek === null;
      if (state.rivalPreview !== previous.rivalPreview) {
        this.syncPreview();
        if (!state.battle) this.showView('planning', false);
      }
      if (battleChanged || peekClosed || state.run !== previous.run || state.selected !== previous.selected || state.itemTarget !== previous.itemTarget) {
        this.syncPlanning();
      }
    });
    // The dock over the bottom of the canvas changes height between planning and a fight;
    // the camera refits to what's left, mid-tween included.
    const stopInset = onInsetChange(() => this.showView(this.view, this.cameras.main.panEffect.isRunning));
    const stopSlotAt = registerSlotAt((x, y) => this.unitSlotAtClient(x, y));
    // Leaving the screen destroys the game, which emits DESTROY rather than SHUTDOWN. Miss
    // that and this subscription outlives the scene and throws on the next store change.
    // A phone flips scheme on its own at sunset, mid-fight included, so the board
    // repaints in place rather than restarting the scene. One frame later: the change
    // event can land before the style recalc that updates the custom properties.
    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => requestAnimationFrame(() => this.applyPalette());
    dark.addEventListener('change', onScheme);
    const stop = () => {
      this.alive = false;
      dark.removeEventListener('change', onScheme);
      this.stopFollowing?.();
      stopInset();
      stopSlotAt();
      unsubscribe();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
    this.events.once(Phaser.Scenes.Events.DESTROY, stop);

    const { battle } = this.store.getState();
    this.syncPreview();
    if (battle) this.startReplay(battle);
    this.syncPlanning();
  }

  private onResize() {
    if (!this.alive) return;
    this.textResolution = Math.max(1, Math.round(1 / (this.scale.zoom || 1)));
    this.showView(this.view, false);
  }

  /**
   * Planning sits the player's half and the bench just above the dock, as large as the
   * width allows, with the rival's half dimmed above; a fight recentres on both halves and
   * lifts the dimming. The camera tweens between the two, which is the reveal. The dock
   * covers the bottom of the canvas, so everything is fitted into the part above it.
   */
  private showView(view: 'planning' | 'fight', animate: boolean) {
    if (!this.alive) return;
    this.view = view;
    // With a rival to study, planning shows the whole table as well as the bench.
    const rect = view === 'planning' ? (this.store.getState().rivalPreview ? contentRect() : planningRect()) : fightRect();
    const camera = this.cameras.main;
    const inset = Math.min(camera.height * 0.8, getBottomInset() / (this.scale.zoom || 1));
    const available = camera.height - inset;
    const zoom = Math.min(camera.width / rect.width, available / rect.height);
    const visibleHeight = available / zoom;
    const cx = rect.centerX;
    // The board is wider than a phone, so the camera fits its width and there's height to
    // spare. While planning, the spare height goes above the player's half, keeping the
    // bench within thumb reach; once everything fits, it's centred instead.
    const content = contentRect();
    const visibleCenter =
      view === 'fight' ? rect.centerY : visibleHeight >= content.height ? content.centerY : rect.bottom - visibleHeight / 2;
    // centerOn() puts a point at the middle of the whole canvas, which is half the inset
    // below the middle of the part that shows.
    const cy = visibleCenter + inset / 2 / zoom;
    // The rival's half lights up and the bench steps back while a fight is on.
    this.tweens.killTweensOf(this.bench);
    const duration = animate ? VIEW_TWEEN_MS : 0;
    this.tweens.add({ targets: this.bench, alpha: view === 'planning' ? 1 : 0, duration });
    camera.panEffect.reset();
    camera.zoomEffect.reset();
    if (!animate || prefersReducedMotion()) {
      camera.setZoom(zoom).centerOn(cx, cy);
      return;
    }
    camera.pan(cx, cy, VIEW_TWEEN_MS, 'Cubic.easeInOut');
    camera.zoomTo(zoom, VIEW_TWEEN_MS, 'Cubic.easeInOut');
  }

  /**
   * The table: a floor with a front edge, and a tile per cell, each half faintly in its
   * team's colour. Redrawn whenever the colour scheme changes, so it holds no colour of
   * its own.
   */
  private drawBoard() {
    const p = this.palette;
    const g = this.board.clear();
    // The room: a back wall, and the ground from just behind the table's far edge down.
    // Far wider and taller than any camera view, so its edges never show.
    const horizon = TILT.screenTop - 14;
    g.fillStyle(p.stage, 1).fillRect(-BOARD_WIDTH, -BOARD_HEIGHT, 3 * BOARD_WIDTH, BOARD_HEIGHT + horizon);
    g.fillStyle(p.ground, 1).fillRect(-BOARD_WIDTH, horizon, 3 * BOARD_WIDTH, 2 * BOARD_HEIGHT);
    const left = BOARD_X - FLOOR_PAD;
    const right = BOARD_WIDTH - left;
    // The sides aren't quite straight once tilted, so they're traced in steps.
    const steps = 12;
    const outline: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i <= steps; i++) outline.push(at(right, TILT.top + ((TILT.bottom - TILT.top) * i) / steps));
    for (let i = steps; i >= 0; i--) outline.push(at(left, TILT.top + ((TILT.bottom - TILT.top) * i) / steps));
    const nearLeft = at(left, TILT.bottom);
    const nearRight = at(right, TILT.bottom);
    // The table's shadow on the ground, then its front edge.
    g.fillStyle(p.shadow, p.shadowAlpha * 0.6).fillRoundedRect(nearLeft.x + 4, nearLeft.y + RIM - 2, nearRight.x - nearLeft.x - 8, 8, 4);
    g.fillStyle(p.rim, 1).fillPoints([nearLeft, nearRight, { x: nearRight.x, y: nearRight.y + RIM }, { x: nearLeft.x, y: nearLeft.y + RIM }], true);
    g.fillStyle(p.floor, 1).fillPoints(outline, true);

    for (let cell = 0; cell < ROWS * COLS; cell++) {
      const points = tilePoints(cell);
      const mine = cell >= SIDE_CELLS;
      // A sliver of the rim's colour under each tile gives it a little thickness.
      g.fillStyle(p.rim, 0.5).fillPoints(
        points.map(({ x, y }) => ({ x, y: y + 1.5 })),
        true,
      );
      g.fillStyle(p.tile, p.tileAlpha).fillPoints(points, true);
      g.fillStyle(mine ? p.mine : p.rival, p.tintAlpha).fillPoints(points, true);
    }

    // The bench: a shelf in front of the table, with a pad per slot.
    const shelfLeft = BENCH_X - 6;
    const shelfWidth = BOARD_WIDTH - 2 * shelfLeft;
    this.bench.clear();
    this.bench.fillStyle(p.rim, 1).fillRoundedRect(shelfLeft, BENCH_Y - BENCH_SLOT / 2 - 6 + 4, shelfWidth, BENCH_SLOT + 12, 12);
    this.bench.fillStyle(p.floor, 1).fillRoundedRect(shelfLeft, BENCH_Y - BENCH_SLOT / 2 - 6, shelfWidth, BENCH_SLOT + 12, 12);
    for (let i = 0; i < BENCH_SIZE; i++) {
      const x = BENCH_X + i * (BENCH_SLOT + BENCH_GAP);
      this.bench.fillStyle(p.tile, p.tileAlpha).fillRoundedRect(x, BENCH_Y - BENCH_SLOT / 2, BENCH_SLOT, BENCH_SLOT, 9);
    }
  }

  /** The scheme changed: re-read the stylesheet and repaint everything that has a colour. */
  private applyPalette() {
    if (!this.alive) return;
    this.palette = readBoardPalette();
    this.drawBoard();
    for (const view of this.views.values()) view.applyPalette(this.palette);
    for (const view of this.previews) view.applyPalette(this.palette);
    for (const fighter of this.fighters) {
      fighter.applyPalette(this.palette);
      fighter.drawBars();
    }
    this.syncPlanning();
  }

  // ---------- Planning ----------

  /** A point on the screen, in world units. */
  private clientToWorld(clientX: number, clientY: number) {
    const rect = this.game.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) * this.scale.width) / rect.width;
    const y = ((clientY - rect.top) * this.scale.height) / rect.height;
    // The dock covers the bottom of the canvas, so the board only shows above it.
    const visibleBottom = rect.bottom - getBottomInset();
    const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= visibleBottom;
    return { point: this.cameras.main.getWorldPoint(x, y), inside };
  }

  /** Which of the player's creatures is under a point on the screen; for dropping items. */
  private unitSlotAtClient(clientX: number, clientY: number): Slot | null {
    const { run, battle } = this.store.getState();
    if (!this.alive || !run || battle) return null;
    const { point, inside } = this.clientToWorld(clientX, clientY);
    if (!inside) return null;
    const slot = this.dropSlot(point.x, point.y);
    if (!slot) return null;
    return (slot.area === 'board' ? run.board : run.bench)[slot.index] ? slot : null;
  }

  /**
   * Phaser only hears the pointer over the canvas, but a unit can be dragged down onto the
   * shop to sell it, so the drag follows window events and moves the sprite itself.
   */
  private setUpDragging() {
    this.input.on('dragstart', (pointer: Phaser.Input.Pointer, view: UnitView) => {
      this.letGo();
      this.peeked = false;
      this.store.setState({ peek: null });
      this.dragging = view;
      // A pop-in, slide or item bump still running would keep pulling the unit back.
      this.tweens.killTweensOf(view);
      view.setDepth(30).setScale(1.15).setAlpha(1);
      sfx.pickUp();
      const store = this.store.getState();
      store.select(null);
      const slot = view.getData('slot') as Slot;
      const dragged = store.run ? (slot.area === 'board' ? store.run.board : store.run.bench)[slot.index] : null;
      const def = dragged ? getUnit(dragged.unitId) : null;
      this.store.setState({ unitDrag: { slot, overSell: false, outside: null } });

      const rect = this.game.canvas.getBoundingClientRect();
      this.dragClient = { x: rect.left + (pointer.x * rect.width) / this.scale.width, y: rect.top + (pointer.y * rect.height) / this.scale.height };
      const follow = (event: PointerEvent) => {
        if (!this.alive || this.dragging !== view) return;
        const last = { x: event.clientX, y: event.clientY };
        this.dragClient = last;
        const { point, inside } = this.clientToWorld(last.x, last.y);
        view.setPosition(point.x, point.y).setVisible(inside);
        const to = inside ? this.dropSlot(point.x, point.y) : null;
        const refused = to !== null && !this.canMove(slot, to);
        // Over a hex it could stand on, show what it would reach from there.
        if (def && to?.area === 'board' && !refused) this.drawRange(toBattleCell(to.index, 'a'), def.range, def.cost);
        else this.drawHighlight(to, refused);
        const overSell = isOverSellZone(last.x, last.y);
        const current = this.store.getState().unitDrag;
        // The finger's position only matters to React once the canvas can't draw the unit.
        const outside = inside ? null : last;
        if (current && (current.overSell !== overSell || (current.outside === null) !== (outside === null) || outside)) {
          this.store.setState({ unitDrag: { ...current, overSell, outside } });
        }
      };
      window.addEventListener('pointermove', follow);
      this.stopFollowing = () => {
        window.removeEventListener('pointermove', follow);
        this.stopFollowing = null;
        this.store.setState({ unitDrag: null });
      };
    });
    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, view: UnitView) => {
      const last = this.dragClient;
      this.dragging = null;
      this.stopFollowing?.();
      view.setDepth(10).setScale(1).setVisible(true);
      this.highlight.clear();
      const from = view.getData('slot') as Slot;
      const store = this.store.getState();
      if (isOverSellZone(last.x, last.y)) {
        if (store.act((run) => sell(run, from))) sfx.sell();
        this.syncPlanning();
        return;
      }
      const { point, inside } = this.clientToWorld(last.x, last.y);
      const to = inside ? this.dropSlot(point.x, point.y) : null;
      const level = store.run?.level ?? 1;
      if (to && (to.area !== from.area || to.index !== from.index)) {
        if (store.act((run) => move(run, from, to), `Level ${level} fits ${level} unit${level === 1 ? '' : 's'} on the board`)) sfx.drop();
      }
      this.syncPlanning();
    });
  }

  /** The bench slot or player hex under a point, if any. */
  private dropSlot(x: number, y: number): Slot | null {
    if (Math.abs(y - BENCH_Y) < BENCH_SLOT / 2 + 8) {
      const index = Math.floor((x - BENCH_X) / (BENCH_SLOT + BENCH_GAP));
      if (index >= 0 && index < BENCH_SIZE) return { area: 'bench', index };
    }
    // Found on the flat table, where the cells are round and evenly spaced.
    const flat = unproject(TILT, x, y);
    let best: Slot | null = null;
    let bestDistance = R;
    for (let own = 0; own < SIDE_CELLS; own++) {
      const center = flatCell(toBattleCell(own, 'a'));
      const d = Math.hypot(center.x - flat.x, center.y - flat.y);
      if (d < bestDistance) {
        best = { area: 'board', index: own };
        bestDistance = d;
      }
    }
    return best;
  }

  /**
   * Starts timing a press on a creature. Held still long enough, it shows the creature's
   * essentials in a bubble over it instead of opening the sheet.
   */
  private holdFor(view: UnitView) {
    this.letGo();
    this.peeked = false;
    this.holding = this.time.delayedCall(LONG_PRESS_MS, () => {
      this.holding = null;
      const rival = view.getData('rival') as Placed | undefined;
      if (rival) {
        if (!this.alive || this.dragging) return;
        this.peeked = true;
        vibrate(10);
        const at = this.worldToClient(view.x, view.y - view.headHeight);
        this.drawRange(toBattleCell(rival.cell, 'b'), getUnit(rival.unitId).range, getUnit(rival.unitId).cost, 'b');
        this.store.setState({ peek: { unitId: rival.unitId, star: rival.star, x: at.x, y: at.y } });
        return;
      }
      const slot = view.getData('slot') as Slot | undefined;
      const run = this.store.getState().run;
      const unit = slot && run ? (slot.area === 'board' ? run.board : run.bench)[slot.index] : null;
      if (!this.alive || !unit || this.dragging) return;
      this.peeked = true;
      vibrate(10);
      const at = this.worldToClient(view.x, view.y - view.headHeight);
      if (slot?.area === 'board') this.drawRange(toBattleCell(slot.index, 'a'), getUnit(unit.unitId).range, getUnit(unit.unitId).cost);
      this.store.setState({ peek: { unitId: unit.unitId, star: unit.star, x: at.x, y: at.y } });
    });
  }

  /** Every tile a creature standing on `from` can hit, rival's half included: while it's peeked at, or dragged over `from`. */
  private drawRange(from: number, range: number, cost: number, side: 'a' | 'b' = 'a') {
    const p = this.palette;
    const color = side === 'a' ? p.mine : p.rival;
    this.highlight.clear().fillStyle(color, 0.24).lineStyle(1.5, color, 0.9);
    for (let cell = 0; cell < ROWS * COLS; cell++) {
      if (cell === from || distance(cell, from) > range) continue;
      const points = tilePoints(cell);
      this.highlight.fillPoints(points, true).strokePoints(points, true);
    }
    this.highlight.lineStyle(2.5, p.tier[cost - 1], 1).strokePoints(tilePoints(from), true);
  }

  private letGo() {
    this.holding?.remove();
    this.holding = null;
  }

  /** A world point, in client pixels. */
  private worldToClient(x: number, y: number) {
    const rect = this.game.canvas.getBoundingClientRect();
    const camera = this.cameras.main;
    const px = rect.width / this.scale.width;
    return { x: rect.left + (x - camera.worldView.x) * camera.zoom * px, y: rect.top + (y - camera.worldView.y) * camera.zoom * px };
  }

  /** Whether a unit could go there: the board holds no more units than the level. */
  private canMove(from: Slot, to: Slot) {
    const run = this.store.getState().run;
    if (!run || (from.area === to.area && from.index === to.index)) return true;
    return move(run, from, to) !== run;
  }

  /** The slot a drag would land in; red when the move would be refused. */
  private drawHighlight(slot: Slot | null, refused = false) {
    this.highlight.clear();
    if (!slot) return;
    const color = refused ? this.palette.rival : this.palette.mine;
    this.highlight.fillStyle(color, 0.22).lineStyle(2, color, 0.95);
    if (slot.area === 'board') {
      const points = tilePoints(toBattleCell(slot.index, 'a'));
      this.highlight.fillPoints(points, true).strokePoints(points, true);
    } else {
      const x = BENCH_X + slot.index * (BENCH_SLOT + BENCH_GAP);
      this.highlight.fillRoundedRect(x, BENCH_Y - BENCH_SLOT / 2, BENCH_SLOT, BENCH_SLOT, 9);
      this.highlight.strokeRoundedRect(x, BENCH_Y - BENCH_SLOT / 2, BENCH_SLOT, BENCH_SLOT, 9);
    }
  }

  /** Stands the store's rival preview, if any, on the rival's half; long-press one to read it. */
  private syncPreview() {
    if (!this.alive) return;
    for (const view of this.previews) view.destroy();
    this.previews = [];
    for (const unit of this.store.getState().rivalPreview ?? []) {
      const { x, y } = cellPoint(toBattleCell(unit.cell, 'b'));
      const view = new UnitView(this, x, y, unit.unitId, unit.star, this.palette, this.plates, unit.item, 'b');
      view.setData('rival', unit);
      view.setInteractive({ hitArea: UnitView.HIT, hitAreaCallback: UnitView.hitTest });
      view.on('pointerdown', () => this.holdFor(view));
      view.on('pointerup', () => {
        this.letGo();
        this.peeked = false;
      });
      view.setVisible(!this.store.getState().battle);
      this.previews.push(view);
    }
  }

  /** Makes the sprites match the run: new units pop in, moved ones slide, sold ones fade. */
  private syncPlanning() {
    if (!this.alive) return;
    const { run, battle, selected, itemTarget } = this.store.getState();
    const planning = !battle;
    const seen = new Set<number>();
    const place = (unit: OwnedUnit | null, slot: Slot) => {
      if (!unit) return;
      seen.add(unit.uid);
      const target = slotCenter(slot);
      let view = this.views.get(unit.uid);
      if (!view) {
        view = new UnitView(this, target.x, target.y, unit.unitId, unit.star, this.palette, this.plates, unit.item);
        view.setInteractive({ hitArea: UnitView.HIT, hitAreaCallback: UnitView.hitTest, draggable: true, useHandCursor: true });
        const held = view;
        view.on('pointerdown', () => this.holdFor(held));
        view.on('pointerup', (pointer: Phaser.Input.Pointer) => {
          this.letGo();
          if (this.peeked) {
            this.peeked = false;
            return;
          }
          if (pointer.getDistance() < 6) this.store.getState().select(held.getData('slot') as Slot);
        });
        view.setScale(0.4);
        this.tweens.add({ targets: view, scale: 1, duration: 220, ease: 'Back.easeOut' });
        this.views.set(unit.uid, view);
      } else if (view.item !== unit.item) {
        view.setItem(unit.item);
        if (unit.item) {
          this.tweens.add({ targets: view, scale: { from: 1.25, to: 1 }, duration: 320, ease: 'Back.easeOut' });
          this.burst(target.x, view.bodyY, this.palette.mine);
        }
      }
      if (view.star !== unit.star) {
        view.setStar(unit.star);
        this.tweens.add({ targets: view, scale: { from: 1.5, to: 1 }, duration: 380, ease: 'Back.easeOut' });
        this.burst(target.x, view.bodyY, unit.star === 3 ? this.palette.star[2] : this.palette.mine);
        sfx.combine();
      }
      view.setData('slot', slot);
      view.setVisible(planning);
      if (view === this.dragging) return;
      if (view.x !== target.x || view.y !== target.y) {
        this.tweens.add({ targets: view, x: target.x, y: target.y, duration: 160, ease: 'Quad.easeOut' });
      }
      const isSelected = selected?.area === slot.area && selected.index === slot.index;
      const isTarget = itemTarget?.area === slot.area && itemTarget.index === slot.index;
      // A ring marks the selection; tinting the art washes it out on a light board.
      if (!this.tweens.isTweening(view)) view.setScale(isTarget ? 1.15 : isSelected ? 1.08 : 1);
    };
    run?.board.forEach((unit, index) => place(unit, { area: 'board', index }));
    run?.bench.forEach((unit, index) => place(unit, { area: 'bench', index }));
    for (const [uid, view] of this.views) {
      if (seen.has(uid)) continue;
      this.views.delete(uid);
      view.disableInteractive();
      this.tweens.add({ targets: view, alpha: 0, scale: 0.3, duration: 180, onComplete: () => view.destroy() });
    }
    if (planning && itemTarget) this.drawHighlight(itemTarget);
    else this.drawSelection(planning ? selected : null);
  }

  private drawSelection(slot: Slot | null) {
    this.highlight.clear();
    if (!slot) return;
    this.highlight.lineStyle(2, this.palette.mine, 1);
    if (slot.area === 'board') this.highlight.strokePoints(tilePoints(toBattleCell(slot.index, 'a')), true);
    else this.highlight.strokeRoundedRect(BENCH_X + slot.index * (BENCH_SLOT + BENCH_GAP), BENCH_Y - BENCH_SLOT / 2, BENCH_SLOT, BENCH_SLOT, 9);
  }

  // ---------- Combat replay ----------

  private startReplay(battle: Battle) {
    if (!this.alive) return;
    this.stopReplay();
    this.showView('fight', true);
    for (const view of this.views.values()) view.setVisible(false);
    for (const view of this.previews) view.setVisible(false);
    this.highlight.clear();
    this.fighters = battle.result.fighters.map((info) => new FighterView(this, info, this.palette, this.plates));
    for (const fighter of this.fighters) {
      fighter.setScale(0);
      this.tweens.add({ targets: fighter, scale: 1, duration: 260, delay: fighter.info.side === 'b' ? 120 : 0, ease: 'Back.easeOut' });
    }
    this.publishTeamHp();
    sfx.fightStart();
    // Opponents sit on the half that was empty during planning; let them land before anything moves.
    this.replay = { battle, elapsed: -500, next: 0, finished: false, overtimeShown: false };
  }

  private stopReplay() {
    this.replay = null;
    if (!this.alive) return;
    this.showView('planning', true);
    for (const view of this.previews) view.setVisible(true);
    this.tweens.killTweensOf(this.fighters);
    for (const fighter of this.fighters) fighter.destroy();
    this.fighters = [];
    this.effects.removeAll(true);
  }

  /** Each side's health and units left, for the team strips above and below the board. */
  private publishTeamHp() {
    const hp = { a: 0, b: 0, maxA: 0, maxB: 0, aliveA: 0, aliveB: 0 };
    for (const fighter of this.fighters) {
      const alive = fighter.hp > 0 ? 1 : 0;
      if (fighter.info.side === 'a') {
        hp.a += fighter.hp;
        hp.maxA += fighter.info.maxHp;
        hp.aliveA += alive;
      } else {
        hp.b += fighter.hp;
        hp.maxB += fighter.info.maxHp;
        hp.aliveB += alive;
      }
    }
    this.store.setState({ teamHp: hp });
  }

  update(time: number, delta: number) {
    const motion = !prefersReducedMotion();
    for (const view of this.views.values()) view.follow(time, motion);
    for (const view of this.previews) view.follow(time, motion);
    for (const fighter of this.fighters) fighter.follow(time, motion);
    const replay = this.replay;
    if (!replay) return;
    const speed = this.store.getState().speed;
    replay.elapsed += delta * speed;
    const tick = Math.floor(replay.elapsed / MS_PER_TICK);
    const { events, ticks, winner } = replay.battle.result;
    let changed = false;
    while (replay.next < events.length && events[replay.next].t <= tick) changed = this.apply(events[replay.next++], speed) || changed;
    if (changed) this.publishTeamHp();
    if (!replay.overtimeShown && tick > OVERTIME_TICK && tick <= ticks) {
      replay.overtimeShown = true;
      this.banner('Overtime', this.palette.currency);
    }
    if (!replay.finished && tick > ticks) {
      replay.finished = true;
      // The result card over the board says who won; the scene only plays the sting.
      this.store.getState().finishReplay();
      if (winner === 'a') {
        sfx.reward();
        vibrate(20);
      } else {
        sfx.defeat();
        vibrate([40, 30, 60]);
      }
    }
    if (tick > ticks + END_PAUSE_TICKS) this.store.getState().endReplay();
  }

  /** Plays one event; true if it changed anyone's health. */
  private apply(event: BattleEvent, speed: number): boolean {
    const fighter = this.fighters[event.id];
    if (!fighter) return false;
    switch (event.k) {
      case 'move': {
        const { x, y } = cellPoint(event.cell);
        this.tweens.add({ targets: fighter, x, y, duration: (MOVE_TICKS * MS_PER_TICK) / speed, ease: 'Sine.easeInOut' });
        return false;
      }
      case 'attack': {
        const target = this.fighters[event.target];
        fighter.mana = event.mana;
        fighter.drawBars();
        if (!target) return false;
        if (Phaser.Math.Distance.Between(fighter.x, fighter.y, target.x, target.y) > HEX_W * 1.3) {
          this.projectile(fighter, target, speed);
        } else {
          const dx = (target.x - fighter.x) * 0.25;
          const dy = (target.y - fighter.y) * 0.25;
          this.tweens.add({ targets: fighter.figure, x: dx, y: dy - 4, duration: 70 / speed, yoyo: true });
        }
        return false;
      }
      case 'hit':
        fighter.hp = event.hp;
        fighter.shield = event.shield;
        fighter.mana = event.mana;
        fighter.drawBars();
        this.floatText(fighter, `${event.amount}`, event.ability ? this.palette.danger : this.palette.onInk, event.ability ? 15 : 12);
        this.spark(fighter.x, fighter.bodyY);
        this.tweens.add({ targets: fighter, squash: { from: 1, to: 0 }, duration: 200, ease: 'Quad.easeOut' });
        if (this.time.now - this.lastHitSound > 60) {
          this.lastHitSound = this.time.now;
          sfx.hit(event.ability);
        }
        return true;
      case 'dodge':
        this.floatText(fighter, 'Miss', this.palette.muted, 11);
        this.tweens.add({ targets: fighter.figure, x: { from: 0, to: 6 }, duration: 90, yoyo: true });
        return false;
      case 'heal':
        fighter.hp = event.hp;
        fighter.drawBars();
        this.floatText(fighter, `+${event.amount}`, this.palette.success, 12);
        return true;
      case 'shield':
        fighter.shield = event.shield;
        fighter.drawBars();
        this.floatText(fighter, 'Shield', this.palette.onInk, 11);
        return false;
      case 'stun':
        fighter.image.setTint(this.palette.star[2]);
        this.floatText(fighter, 'Stun', this.palette.currency, 11);
        this.time.delayedCall((event.ticks * MS_PER_TICK) / speed, () => fighter.active && fighter.image.clearTint());
        return false;
      case 'cast': {
        fighter.mana = 0;
        fighter.drawBars();
        const color = fighter.info.side === 'a' ? this.palette.mine : this.palette.rival;
        for (const cell of event.cells) {
          const flash = this.add.graphics().fillStyle(color, 0.35).fillPoints(tilePoints(cell), true);
          this.effects.add(flash);
          this.tweens.add({ targets: flash, alpha: 0, duration: 420 / speed, onComplete: () => flash.destroy() });
        }
        this.tweens.add({ targets: fighter, squash: { from: -1.4, to: 0 }, duration: 320 / speed, ease: 'Back.easeOut' });
        sfx.cast();
        return false;
      }
      case 'death': {
        fighter.hp = 0;
        // Tips over away from the middle, sinks, and goes in a puff.
        const away = fighter.x < BOARD_WIDTH / 2 ? -1 : 1;
        this.tweens.add({ targets: fighter.figure, angle: 24 * away, y: 4, duration: 240 / speed, ease: 'Quad.easeIn' });
        this.tweens.add({ targets: fighter, alpha: 0, delay: 160 / speed, duration: 200 / speed });
        this.puff(fighter.x, fighter.y - 6 * fighter.depth3d);
        sfx.faint();
        return true;
      }
      default:
        return false;
    }
  }

  /** A number or word over a creature, in bold with an ink edge: it pops, then rises away. */
  private floatText(over: UnitView, text: string, color: string, size: number) {
    const label = this.add
      .text(over.x + Phaser.Math.Between(-7, 7), over.y - over.headHeight * 0.7, text, {
        fontFamily: DISPLAY_FONT,
        fontSize: `${size}px`,
        fontStyle: '800',
        color,
        stroke: this.palette.ink,
        strokeThickness: 3.5,
      })
      .setResolution(this.textResolution)
      .setOrigin(0.5)
      .setScale(0.5);
    this.effects.add(label);
    this.tweens.add({ targets: label, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: label, y: label.y - 18, alpha: 0, delay: 260, duration: 520, ease: 'Quad.easeIn', onComplete: () => label.destroy() });
  }

  /** A shot from a ranged attacker: a small ball on a short arc to its target. */
  private projectile(from: FighterView, to: FighterView, speed: number) {
    const color = from.info.side === 'a' ? this.palette.mine : this.palette.rival;
    const ball = this.add.circle(from.x, from.bodyY, 3.2, color).setStrokeStyle(1.5, this.palette.inkInt);
    this.effects.add(ball);
    const start = { x: from.x, y: from.bodyY };
    const end = { x: to.x, y: to.bodyY };
    const lift = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y) * 0.3;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 220 / speed,
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        ball.setPosition(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t - Math.sin(Math.PI * t) * lift);
      },
      onComplete: () => ball.destroy(),
    });
  }

  /** A little four-point star where a blow lands. */
  private spark(x: number, y: number) {
    const points: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? 7 : 2.4;
      const angle = (Math.PI / 4) * i;
      points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    const star = this.add
      .graphics({ x: x + Phaser.Math.Between(-5, 5), y: y + Phaser.Math.Between(-5, 3) })
      .fillStyle(this.palette.onInkInt, 1)
      .lineStyle(1.5, this.palette.inkInt, 1)
      .fillPoints(points, true)
      .strokePoints(points, true)
      .setScale(0.4)
      .setAngle(Phaser.Math.Between(0, 45));
    this.effects.add(star);
    this.tweens.add({ targets: star, scale: 1.1, alpha: 0, duration: 200, ease: 'Quad.easeOut', onComplete: () => star.destroy() });
  }

  /** A few soft rings of dust where a creature fell. */
  private puff(x: number, y: number) {
    for (let i = 0; i < 3; i++) {
      const dot = this.add.circle(x + (i - 1) * 9, y - (i === 1 ? 6 : 0), 5, this.palette.shadow, this.palette.shadowAlpha * 1.4);
      this.effects.add(dot);
      this.tweens.add({ targets: dot, radius: 11, y: dot.y - 8, alpha: 0, delay: 180, duration: 420, ease: 'Quad.easeOut', onComplete: () => dot.destroy() });
    }
  }

  private burst(x: number, y: number, color: number) {
    const ring = this.add.circle(x, y, 6).setStrokeStyle(2, color).setFillStyle();
    this.effects.add(ring);
    this.tweens.add({ targets: ring, radius: 26, alpha: 0, duration: 360, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
  }

  /** A short word across the middle of the board, e.g. when overtime starts. */
  private banner(text: string, color: string) {
    const label = this.add
      .text(BOARD_WIDTH / 2, MID_Y, text, {
        fontFamily: DISPLAY_FONT,
        fontSize: '22px',
        fontStyle: '800',
        color,
        stroke: this.palette.ink,
        strokeThickness: 5,
      })
      .setResolution(this.textResolution)
      .setOrigin(0.5)
      .setScale(0.6)
      .setAlpha(0);
    this.effects.add(label);
    this.tweens.add({ targets: label, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: label, alpha: 0, delay: 900, duration: 400, onComplete: () => label.destroy() });
  }
}
