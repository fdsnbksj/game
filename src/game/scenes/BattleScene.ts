import Phaser from 'phaser';
import { useRunStore, type Battle } from '../../runStore';
import { DISPLAY_FONT, readBoardPalette, type BoardPalette } from '../../shared/theme';
import { BENCH_SIZE, MOVE_TICKS, OVERTIME_TICK, TICKS_PER_SECOND, type Star } from '../../sim/balance';
import type { BattleEvent, FighterInfo } from '../../sim/combat';
import { COLS, ROWS, SIDE_CELLS, toBattleCell } from '../../sim/hex';
import { move, sell, type OwnedUnit, type Slot } from '../../sim/planning';
import { sfx, vibrate } from '../audio';
import { creatureKey, creatureScale, ensureCreatureTextures, ensureItemTextures, itemKey, itemScale } from '../battle/textures';
import { getBottomInset, isOverSellZone, onInsetChange, registerSlotAt } from '../boardBridge';

// The board and bench, in world units. The canvas is sized to its container in device
// pixels and the camera zooms to fit, so these are a layout grid rather than a size.
export const BOARD_WIDTH = 360;
export const BOARD_HEIGHT = 400;

const R = 26;
const HEX_W = Math.sqrt(3) * R;
const ROW_STEP = 1.5 * R;
const BOARD_X = (BOARD_WIDTH - 7.5 * HEX_W) / 2;
const BOARD_Y = 6;
const BENCH_SLOT = 38;
const BENCH_GAP = 1;
const BENCH_X = (BOARD_WIDTH - (BENCH_SIZE * BENCH_SLOT + (BENCH_SIZE - 1) * BENCH_GAP)) / 2;
const BENCH_Y = BOARD_Y + 7 * ROW_STEP + 2 * R + 12 + BENCH_SLOT / 2;

const UNIT_SIZE = 42;
const ITEM_SIZE = 15;
/** Breathing room around whichever part of the board the camera is showing. */
const VIEW_PAD = 6;
/** How long the camera takes to reveal the rival's half, and to come back. */
const VIEW_TWEEN_MS = 520;
const MS_PER_TICK = 1000 / TICKS_PER_SECOND;
/** Pause on the final frame before handing back to planning. */
const END_PAUSE_TICKS = 30;

/** The bench is a little wider than the board, so the planning view fits whichever is wider. */
const PLAN_LEFT = Math.min(BOARD_X, BENCH_X);
const PLAN_WIDTH = BOARD_WIDTH - 2 * PLAN_LEFT;

/** Rows 4-7 and the bench: what the camera shows while planning. */
function planningRect() {
  return new Phaser.Geom.Rectangle(
    PLAN_LEFT - VIEW_PAD,
    BOARD_Y + 4 * ROW_STEP - VIEW_PAD,
    PLAN_WIDTH + 2 * VIEW_PAD,
    BENCH_Y + BENCH_SLOT / 2 + 2 * VIEW_PAD - (BOARD_Y + 4 * ROW_STEP),
  );
}

/** Both halves, without the bench: what the camera shows during a fight. */
function fightRect() {
  return new Phaser.Geom.Rectangle(
    BOARD_X - VIEW_PAD,
    BOARD_Y - VIEW_PAD,
    7.5 * HEX_W + 2 * VIEW_PAD,
    7 * ROW_STEP + 2 * R + 2 * VIEW_PAD,
  );
}

/** Everything there is to show: both halves and the bench. */
function contentRect() {
  const board = fightRect();
  return new Phaser.Geom.Rectangle(board.x, board.y, board.width, BENCH_Y + BENCH_SLOT / 2 + VIEW_PAD - board.y);
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function cellCenter(battleCell: number) {
  const row = Math.floor(battleCell / COLS);
  const col = battleCell % COLS;
  return { x: BOARD_X + HEX_W * (col + 0.5 * (row & 1)) + HEX_W / 2, y: BOARD_Y + R + row * ROW_STEP };
}

function slotCenter(slot: Slot) {
  if (slot.area === 'board') return cellCenter(toBattleCell(slot.index, 'a'));
  return { x: BENCH_X + slot.index * (BENCH_SLOT + BENCH_GAP) + BENCH_SLOT / 2, y: BENCH_Y };
}

function hexPoints(cx: number, cy: number, radius: number) {
  const points: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = Phaser.Math.DegToRad(60 * i - 30);
    points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  }
  return points;
}

/** A creature on a team-coloured base, with star pips under it and its item in the corner. */
class UnitView extends Phaser.GameObjects.Container {
  readonly image: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Graphics;
  private pips: Phaser.GameObjects.Graphics;
  private badge: Phaser.GameObjects.Image;
  star: Star = 1;
  item?: string;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    unitId: string,
    star: Star,
    protected palette: BoardPalette,
    item?: string,
    readonly side: 'a' | 'b' = 'a',
  ) {
    super(scene, x, y);
    this.ring = scene.add.graphics();
    this.drawRing();
    this.image = scene.add.image(0, -4, creatureKey(unitId)).setScale(creatureScale(UNIT_SIZE));
    this.pips = scene.add.graphics();
    this.badge = scene.add.image(UNIT_SIZE / 2 - 5, -UNIT_SIZE / 2 + 7, '__DEFAULT').setVisible(false);
    this.add([this.ring, this.image, this.pips, this.badge]);
    this.setStar(star);
    this.setItem(item);
    this.setSize(UNIT_SIZE, UNIT_SIZE);
    scene.add.existing(this);
  }

  /** The base a creature stands on, in its team's colour: it keeps a pale creature off a
      pale board, and tells the two sides apart in a fight. */
  private drawRing() {
    const color = this.side === 'a' ? this.palette.mine : this.palette.rival;
    const y = UNIT_SIZE * 0.36;
    this.ring.clear();
    this.ring.fillStyle(this.palette.shadow, this.palette.shadowAlpha).fillEllipse(0, y + 1.5, UNIT_SIZE * 0.78, 11);
    this.ring.fillStyle(color, 0.22).fillEllipse(0, y, UNIT_SIZE * 0.74, 10);
    this.ring.lineStyle(1.75, color, 0.95).strokeEllipse(0, y, UNIT_SIZE * 0.74, 10);
  }

  /** Redraws everything that carries a colour, after the scheme changes. */
  applyPalette(palette: BoardPalette) {
    this.palette = palette;
    this.drawRing();
    this.setStar(this.star);
  }

  /** The held item's own tile, top right. */
  setItem(item?: string) {
    this.item = item;
    if (!item) {
      this.badge.setVisible(false);
      return;
    }
    this.badge.setTexture(itemKey(item)).setScale(itemScale(ITEM_SIZE)).setVisible(true);
  }

  /** One star per level on a dark pill, in bronze, silver or gold. */
  setStar(star: Star) {
    this.star = star;
    const color = this.palette.star[star - 1];
    const y = UNIT_SIZE / 2 - 1;
    const width = star * 8 + 4;
    this.pips.clear();
    this.pips.fillStyle(this.palette.track, 0.85).fillRoundedRect(-width / 2, y - 5, width, 10, 5);
    this.pips.fillStyle(color, 1);
    for (let i = 0; i < star; i++) this.pips.fillPoints(starPoints((i - (star - 1) / 2) * 8, y, 3.4), true);
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

  constructor(scene: Phaser.Scene, readonly info: FighterInfo, palette: BoardPalette) {
    const { x, y } = cellCenter(info.cell);
    super(scene, x, y, info.unitId, info.star, palette, info.item, info.side);
    this.hp = info.hp;
    this.mana = info.mana;
    this.bars = scene.add.graphics();
    this.add(this.bars);
    this.drawBars();
  }

  drawBars() {
    const width = 36;
    const x = -width / 2;
    const y = -UNIT_SIZE / 2 - 9;
    const total = this.info.maxHp + this.shield;
    const hpWidth = (width * this.hp) / total;
    this.bars.clear();
    this.bars.fillStyle(this.palette.track, 0.85).fillRoundedRect(x - 1.5, y - 1.5, width + 3, 9, 2.5);
    this.bars.fillStyle(this.info.side === 'a' ? this.palette.hp : this.palette.hpRival).fillRect(x, y, hpWidth, 4);
    if (this.shield > 0) this.bars.fillStyle(this.palette.shield).fillRect(x + hpWidth, y, (width * this.shield) / total, 4);
    this.bars.fillStyle(this.palette.mana).fillRect(x, y + 5, (width * this.mana) / this.info.maxMana, 1.5);
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
  private fighters: FighterView[] = [];
  private replay: Replay | null = null;
  private highlight!: Phaser.GameObjects.Graphics;
  /** Dims the rival's half while planning, so the eye goes to your own. */
  private rivalScrim!: Phaser.GameObjects.Graphics;
  private board!: Phaser.GameObjects.Graphics;
  private palette: BoardPalette = readBoardPalette();
  private effects!: Phaser.GameObjects.Layer;
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

  constructor() {
    super('battle');
  }

  create() {
    this.alive = true;
    this.textResolution = Math.max(1, Math.round(1 / (this.scale.zoom || 1)));
    this.palette = readBoardPalette();
    this.board = this.add.graphics().setDepth(0);
    this.rivalScrim = this.add.graphics().setDepth(2);
    this.drawScrim();
    this.showView('planning', false);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this));
    ensureCreatureTextures(this);
    ensureItemTextures(this);
    this.drawBoard();
    this.highlight = this.add.graphics().setDepth(1);
    this.effects = this.add.layer().setDepth(40);
    this.input.dragDistanceThreshold = 6;
    this.setUpDragging();

    this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) useRunStore.getState().select(null);
    });

    const unsubscribe = useRunStore.subscribe((state, previous) => {
      // Compared by result: marking a fight over makes a new battle object for the same fight.
      const battleChanged = state.battle?.result !== previous.battle?.result;
      if (battleChanged) {
        if (state.battle) this.startReplay(state.battle);
        else this.stopReplay();
      }
      // Ending a replay changes only the battle, but the planning units have to reappear.
      if (battleChanged || state.run !== previous.run || state.selected !== previous.selected || state.itemTarget !== previous.itemTarget) {
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

    const { battle } = useRunStore.getState();
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
    const rect = view === 'planning' ? planningRect() : fightRect();
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
    this.tweens.killTweensOf(this.rivalScrim);
    this.tweens.add({ targets: this.rivalScrim, alpha: view === 'planning' ? 1 : 0, duration: animate ? VIEW_TWEEN_MS : 0 });
    camera.panEffect.reset();
    camera.zoomEffect.reset();
    if (!animate || prefersReducedMotion()) {
      camera.setZoom(zoom).centerOn(cx, cy);
      return;
    }
    camera.pan(cx, cy, VIEW_TWEEN_MS, 'Cubic.easeInOut');
    camera.zoomTo(zoom, VIEW_TWEEN_MS, 'Cubic.easeInOut');
  }

  /** Redrawn whenever the colour scheme changes, so it holds no colour of its own. */
  private drawBoard() {
    const p = this.palette;
    const midY = BOARD_Y + R + 3.5 * ROW_STEP;
    this.board.clear();

    for (let cell = 0; cell < ROWS * COLS; cell++) {
      const { x, y } = cellCenter(cell);
      const mine = cell >= SIDE_CELLS;
      const outer = hexPoints(x, y, R - 1.5);
      this.board.fillStyle(p.cell, mine ? p.cellAlpha : p.cellRivalAlpha);
      this.board.fillPoints(outer, true);
      this.board.lineStyle(1, p.edge, mine ? p.edgeAlpha : p.edgeRivalAlpha);
      this.board.strokePoints(outer, true);
    }

    // The line where the two halves meet.
    this.board.lineStyle(1.5, p.edge, p.edgeAlpha);
    this.board.lineBetween(BOARD_X, midY, BOARD_WIDTH - BOARD_X, midY);

    for (let i = 0; i < BENCH_SIZE; i++) {
      const { x, y } = slotCenter({ area: 'bench', index: i });
      const left = x - BENCH_SLOT / 2;
      const top = y - BENCH_SLOT / 2 - 3;
      this.board.fillStyle(p.cell, p.cellAlpha).fillRoundedRect(left, top, BENCH_SLOT, BENCH_SLOT + 6, 8);
      this.board.lineStyle(1, p.edge, p.edgeAlpha).strokeRoundedRect(left, top, BENCH_SLOT, BENCH_SLOT + 6, 8);
    }
  }

  private drawScrim() {
    // Wider and taller than any camera view, so its edges never show.
    this.rivalScrim.clear();
    this.rivalScrim
      .fillStyle(this.palette.scrim, this.palette.scrimAlpha)
      .fillRect(-BOARD_WIDTH, -BOARD_HEIGHT, 3 * BOARD_WIDTH, BOARD_HEIGHT + BOARD_Y + R + 3.5 * ROW_STEP);
  }

  /** The scheme changed: re-read the stylesheet and repaint everything that has a colour. */
  private applyPalette() {
    if (!this.alive) return;
    this.palette = readBoardPalette();
    this.drawBoard();
    this.drawScrim();
    for (const view of this.views.values()) view.applyPalette(this.palette);
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
    const { run, battle } = useRunStore.getState();
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
      this.dragging = view;
      // A pop-in, slide or item bump still running would keep pulling the unit back.
      this.tweens.killTweensOf(view);
      view.setDepth(30).setScale(1.15).setAlpha(1);
      sfx.pickUp();
      const store = useRunStore.getState();
      store.select(null);
      const slot = view.getData('slot') as Slot;
      useRunStore.setState({ unitDrag: { slot, overSell: false, outside: null } });

      const rect = this.game.canvas.getBoundingClientRect();
      this.dragClient = { x: rect.left + (pointer.x * rect.width) / this.scale.width, y: rect.top + (pointer.y * rect.height) / this.scale.height };
      const follow = (event: PointerEvent) => {
        if (!this.alive || this.dragging !== view) return;
        const last = { x: event.clientX, y: event.clientY };
        this.dragClient = last;
        const { point, inside } = this.clientToWorld(last.x, last.y);
        view.setPosition(point.x, point.y).setVisible(inside);
        const to = inside ? this.dropSlot(point.x, point.y) : null;
        this.drawHighlight(to, to !== null && !this.canMove(slot, to));
        const overSell = isOverSellZone(last.x, last.y);
        const current = useRunStore.getState().unitDrag;
        // The finger's position only matters to React once the canvas can't draw the unit.
        const outside = inside ? null : last;
        if (current && (current.overSell !== overSell || (current.outside === null) !== (outside === null) || outside)) {
          useRunStore.setState({ unitDrag: { ...current, overSell, outside } });
        }
      };
      window.addEventListener('pointermove', follow);
      this.stopFollowing = () => {
        window.removeEventListener('pointermove', follow);
        this.stopFollowing = null;
        useRunStore.setState({ unitDrag: null });
      };
    });
    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, view: UnitView) => {
      const last = this.dragClient;
      this.dragging = null;
      this.stopFollowing?.();
      view.setDepth(10).setScale(1).setVisible(true);
      this.highlight.clear();
      const from = view.getData('slot') as Slot;
      const store = useRunStore.getState();
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
    let best: Slot | null = null;
    let bestDistance = R;
    for (let own = 0; own < SIDE_CELLS; own++) {
      const center = slotCenter({ area: 'board', index: own });
      const d = Math.hypot(center.x - x, center.y - y);
      if (d < bestDistance) {
        best = { area: 'board', index: own };
        bestDistance = d;
      }
    }
    return best;
  }

  /** Whether a unit could go there: the board holds no more units than the level. */
  private canMove(from: Slot, to: Slot) {
    const run = useRunStore.getState().run;
    if (!run || (from.area === to.area && from.index === to.index)) return true;
    return move(run, from, to) !== run;
  }

  /** The slot a drag would land in; red when the move would be refused. */
  private drawHighlight(slot: Slot | null, refused = false) {
    this.highlight.clear();
    if (!slot) return;
    const { x, y } = slotCenter(slot);
    const color = refused ? this.palette.rival : this.palette.mine;
    this.highlight.fillStyle(color, 0.14).lineStyle(2, color, 0.95);
    if (slot.area === 'board') {
      this.highlight.fillPoints(hexPoints(x, y, R - 2), true);
      this.highlight.strokePoints(hexPoints(x, y, R - 2), true);
    } else {
      this.highlight.fillRoundedRect(x - BENCH_SLOT / 2, y - BENCH_SLOT / 2 - 3, BENCH_SLOT, BENCH_SLOT + 6, 8);
      this.highlight.strokeRoundedRect(x - BENCH_SLOT / 2, y - BENCH_SLOT / 2 - 3, BENCH_SLOT, BENCH_SLOT + 6, 8);
    }
  }

  /** Makes the sprites match the run: new units pop in, moved ones slide, sold ones fade. */
  private syncPlanning() {
    if (!this.alive) return;
    const { run, battle, selected, itemTarget } = useRunStore.getState();
    const planning = !battle;
    const seen = new Set<number>();
    const place = (unit: OwnedUnit | null, slot: Slot) => {
      if (!unit) return;
      seen.add(unit.uid);
      const target = slotCenter(slot);
      let view = this.views.get(unit.uid);
      if (!view) {
        view = new UnitView(this, target.x, target.y, unit.unitId, unit.star, this.palette, unit.item).setDepth(10);
        view.setInteractive({ draggable: true, useHandCursor: true });
        view.on('pointerup', (pointer: Phaser.Input.Pointer) => {
          if (pointer.getDistance() < 6) useRunStore.getState().select(view!.getData('slot') as Slot);
        });
        view.setScale(0.4);
        this.tweens.add({ targets: view, scale: 1, duration: 220, ease: 'Back.easeOut' });
        this.views.set(unit.uid, view);
      } else if (view.item !== unit.item) {
        view.setItem(unit.item);
        if (unit.item) {
          this.tweens.add({ targets: view, scale: { from: 1.25, to: 1 }, duration: 320, ease: 'Back.easeOut' });
          this.burst(target.x, target.y, this.palette.mine);
        }
      }
      if (view.star !== unit.star) {
        view.setStar(unit.star);
        this.tweens.add({ targets: view, scale: { from: 1.5, to: 1 }, duration: 380, ease: 'Back.easeOut' });
        this.burst(target.x, target.y, unit.star === 3 ? this.palette.star[2] : this.palette.mine);
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
    const { x, y } = slotCenter(slot);
    this.highlight.lineStyle(2, this.palette.mine, 1);
    if (slot.area === 'board') this.highlight.strokePoints(hexPoints(x, y, R - 3), true);
    else this.highlight.strokeRoundedRect(x - BENCH_SLOT / 2, y - BENCH_SLOT / 2 - 3, BENCH_SLOT, BENCH_SLOT + 6, 6);
  }

  // ---------- Combat replay ----------

  private startReplay(battle: Battle) {
    if (!this.alive) return;
    this.stopReplay();
    this.showView('fight', true);
    for (const view of this.views.values()) view.setVisible(false);
    this.highlight.clear();
    this.fighters = battle.result.fighters.map((info) => new FighterView(this, info, this.palette).setDepth(10));
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
    this.tweens.killTweensOf(this.fighters);
    for (const fighter of this.fighters) fighter.destroy();
    this.fighters = [];
    this.effects.removeAll(true);
  }

  /** Each side's health left, for the versus header over the board. */
  private publishTeamHp() {
    const hp = { a: 0, b: 0, maxA: 0, maxB: 0 };
    for (const fighter of this.fighters) {
      if (fighter.info.side === 'a') {
        hp.a += fighter.hp;
        hp.maxA += fighter.info.maxHp;
      } else {
        hp.b += fighter.hp;
        hp.maxB += fighter.info.maxHp;
      }
    }
    useRunStore.setState({ teamHp: hp });
  }

  update(_time: number, delta: number) {
    const replay = this.replay;
    if (!replay) return;
    const speed = useRunStore.getState().speed;
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
      useRunStore.getState().finishReplay();
      if (winner === 'a') {
        sfx.reward();
        vibrate(20);
      } else {
        sfx.defeat();
        vibrate([40, 30, 60]);
      }
    }
    if (tick > ticks + END_PAUSE_TICKS) useRunStore.getState().endReplay();
  }

  /** Plays one event; true if it changed anyone's health. */
  private apply(event: BattleEvent, speed: number): boolean {
    const fighter = this.fighters[event.id];
    if (!fighter) return false;
    switch (event.k) {
      case 'move': {
        const { x, y } = cellCenter(event.cell);
        this.tweens.add({ targets: fighter, x, y, duration: (MOVE_TICKS * MS_PER_TICK) / speed, ease: 'Sine.easeInOut' });
        return false;
      }
      case 'attack': {
        const target = this.fighters[event.target];
        fighter.mana = event.mana;
        fighter.drawBars();
        if (!target) return false;
        if (Phaser.Math.Distance.Between(fighter.x, fighter.y, target.x, target.y) > HEX_W * 1.5) {
          const bolt = this.add.circle(fighter.x, fighter.y - 4, 3, fighter.info.side === 'a' ? this.palette.mine : this.palette.rival);
          this.effects.add(bolt);
          this.tweens.add({ targets: bolt, x: target.x, y: target.y - 4, duration: 180 / speed, onComplete: () => bolt.destroy() });
        } else {
          const dx = (target.x - fighter.x) * 0.2;
          const dy = (target.y - fighter.y) * 0.2;
          this.tweens.add({ targets: fighter.image, x: dx, y: dy - 6, duration: 70 / speed, yoyo: true });
        }
        return false;
      }
      case 'hit':
        fighter.hp = event.hp;
        fighter.shield = event.shield;
        fighter.mana = event.mana;
        fighter.drawBars();
        this.floatText(fighter, `${event.amount}`, event.ability ? this.palette.danger : this.palette.label, event.ability ? 16 : 12);
        fighter.image.setTintFill(this.palette.shield);
        this.time.delayedCall(60, () => fighter.image.clearTint());
        if (this.time.now - this.lastHitSound > 60) {
          this.lastHitSound = this.time.now;
          sfx.hit(event.ability);
        }
        return true;
      case 'dodge':
        this.floatText(fighter, 'Miss', this.palette.muted, 11);
        return false;
      case 'heal':
        fighter.hp = event.hp;
        fighter.drawBars();
        this.floatText(fighter, `+${event.amount}`, this.palette.success, 13);
        return true;
      case 'shield':
        fighter.shield = event.shield;
        fighter.drawBars();
        this.floatText(fighter, 'Shield', this.palette.label, 11);
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
          const { x, y } = cellCenter(cell);
          const flash = this.add.graphics().fillStyle(color, 0.35).fillPoints(hexPoints(x, y, R - 3), true);
          this.effects.add(flash);
          this.tweens.add({ targets: flash, alpha: 0, duration: 420 / speed, onComplete: () => flash.destroy() });
        }
        this.tweens.add({ targets: fighter, scale: { from: 1.25, to: 1 }, duration: 240 / speed });
        sfx.cast();
        return false;
      }
      case 'death':
        fighter.hp = 0;
        this.tweens.add({ targets: fighter, alpha: 0, scale: 0.5, duration: 260 / speed });
        this.burst(fighter.x, fighter.y, fighter.info.side === 'a' ? this.palette.mine : this.palette.rival);
        sfx.faint();
        return true;
      default:
        return false;
    }
  }

  private floatText(at: Phaser.GameObjects.Container, text: string, color: string, size: number) {
    const label = this.add
      .text(at.x + Phaser.Math.Between(-6, 6), at.y - 16, text, {
        fontFamily: DISPLAY_FONT,
        fontSize: `${size}px`,
        fontStyle: '700',
        color,
        stroke: this.palette.halo,
        strokeThickness: 3,
      })
      .setResolution(this.textResolution)
      .setOrigin(0.5);
    this.effects.add(label);
    this.tweens.add({ targets: label, y: label.y - 20, alpha: 0, duration: 700, ease: 'Quad.easeOut', onComplete: () => label.destroy() });
  }

  private burst(x: number, y: number, color: number) {
    const ring = this.add.circle(x, y, 6).setStrokeStyle(2, color).setFillStyle();
    this.effects.add(ring);
    this.tweens.add({ targets: ring, radius: 26, alpha: 0, duration: 360, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
  }

  /** A short word across the middle of the board, e.g. when overtime starts. */
  private banner(text: string, color: string) {
    const label = this.add
      .text(BOARD_WIDTH / 2, BOARD_Y + R + 3.5 * ROW_STEP, text, {
        fontFamily: DISPLAY_FONT,
        fontSize: '20px',
        fontStyle: '700',
        color,
        stroke: this.palette.halo,
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
