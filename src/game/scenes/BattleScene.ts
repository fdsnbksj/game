import Phaser from 'phaser';
import { useRunStore, type Battle } from '../../runStore';
import { COLORS, DISPLAY_FONT, HEX } from '../../shared/theme';
import { BENCH_SIZE, MOVE_TICKS, OVERTIME_TICK, TICKS_PER_SECOND, type Star } from '../../sim/balance';
import type { BattleEvent, FighterInfo } from '../../sim/combat';
import { COLS, ROWS, SIDE_CELLS, toBattleCell } from '../../sim/hex';
import { move, type OwnedUnit, type Slot } from '../../sim/planning';
import { sfx, vibrate } from '../audio';
import { creatureKey, creatureScale, ensureCreatureTextures } from '../battle/textures';

// The board and bench, in world units. The canvas is twice this size and the camera zooms
// 2x, so everything drawn stays sharp on high-density screens.
export const BOARD_WIDTH = 360;
export const BOARD_HEIGHT = 400;
export const CANVAS_ZOOM = 2;

const R = 26;
const HEX_W = Math.sqrt(3) * R;
const ROW_STEP = 1.5 * R;
const BOARD_X = (BOARD_WIDTH - 7.5 * HEX_W) / 2;
const BOARD_Y = 6;
const BENCH_SLOT = 38;
const BENCH_GAP = 1;
const BENCH_X = (BOARD_WIDTH - (BENCH_SIZE * BENCH_SLOT + (BENCH_SIZE - 1) * BENCH_GAP)) / 2;
const BENCH_Y = BOARD_Y + 7 * ROW_STEP + 2 * R + 12 + BENCH_SLOT / 2;

const UNIT_SIZE = 40;
const MS_PER_TICK = 1000 / TICKS_PER_SECOND;
/** Pause on the final frame before handing back to planning. */
const END_PAUSE_TICKS = 30;

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

/** A creature with star pips; fighters also get health and mana bars. */
class UnitView extends Phaser.GameObjects.Container {
  readonly image: Phaser.GameObjects.Image;
  private pips: Phaser.GameObjects.Graphics;
  star: Star = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, unitId: string, star: Star) {
    super(scene, x, y);
    const glow = scene.add.ellipse(0, UNIT_SIZE * 0.38, UNIT_SIZE * 0.8, 8, 0x000000, 0.35);
    this.image = scene.add.image(0, -2, creatureKey(unitId)).setScale(creatureScale(UNIT_SIZE));
    this.pips = scene.add.graphics();
    this.add([glow, this.image, this.pips]);
    this.setStar(star);
    this.setSize(UNIT_SIZE, UNIT_SIZE);
    scene.add.existing(this);
  }

  setStar(star: Star) {
    this.star = star;
    const color = star === 3 ? HEX.cyan : star === 2 ? 0xd9e2f2 : 0xe59a5c;
    this.pips.clear();
    for (let i = 0; i < star; i++) {
      const x = (i - (star - 1) / 2) * 7;
      this.pips.fillStyle(0x000000, 0.6).fillCircle(x, UNIT_SIZE / 2 - 1, 3.4);
      this.pips.fillStyle(color).fillCircle(x, UNIT_SIZE / 2 - 1, 2.4);
    }
  }
}

class FighterView extends UnitView {
  hp: number;
  shield = 0;
  mana: number;
  private readonly bars: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, readonly info: FighterInfo) {
    const { x, y } = cellCenter(info.cell);
    super(scene, x, y, info.unitId, info.star);
    this.hp = info.hp;
    this.mana = info.mana;
    this.bars = scene.add.graphics();
    this.add(this.bars);
    this.drawBars();
  }

  drawBars() {
    const width = 30;
    const x = -width / 2;
    const y = -UNIT_SIZE / 2 - 4;
    const total = this.info.maxHp + this.shield;
    const hpWidth = (width * this.hp) / total;
    this.bars.clear();
    this.bars.fillStyle(0x000000, 0.7).fillRect(x - 1, y - 1, width + 2, 7);
    this.bars.fillStyle(this.info.side === 'a' ? HEX.lime : HEX.danger).fillRect(x, y, hpWidth, 3);
    if (this.shield > 0) this.bars.fillStyle(0xffffff).fillRect(x + hpWidth, y, (width * this.shield) / total, 3);
    this.bars.fillStyle(HEX.cyan).fillRect(x, y + 4, (width * this.mana) / this.info.maxMana, 1.5);
  }
}

interface Replay {
  battle: Battle;
  elapsed: number;
  next: number;
  bannerShown: boolean;
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
  private effects!: Phaser.GameObjects.Layer;
  private lastHitSound = 0;
  /** The unit under the player's finger; sync leaves it where it is. */
  private dragging: UnitView | null = null;

  constructor() {
    super('battle');
  }

  create() {
    this.cameras.main.setZoom(CANVAS_ZOOM).centerOn(BOARD_WIDTH / 2, BOARD_HEIGHT / 2);
    ensureCreatureTextures(this);
    this.drawBoard();
    this.highlight = this.add.graphics().setDepth(1);
    this.effects = this.add.layer().setDepth(40);
    this.input.dragDistanceThreshold = 6;
    this.setUpDragging();

    this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) useRunStore.getState().select(null);
    });

    const unsubscribe = useRunStore.subscribe((state, previous) => {
      if (state.battle !== previous.battle) {
        if (state.battle) this.startReplay(state.battle);
        else this.stopReplay();
      }
      // Ending a replay changes only the battle, but the planning units have to reappear.
      if (state.battle !== previous.battle || state.run !== previous.run || state.selected !== previous.selected) {
        this.syncPlanning();
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);

    const { battle } = useRunStore.getState();
    if (battle) this.startReplay(battle);
    this.syncPlanning();
  }

  private drawBoard() {
    const g = this.add.graphics().setDepth(0);
    for (let cell = 0; cell < ROWS * COLS; cell++) {
      const { x, y } = cellCenter(cell);
      const mine = cell >= SIDE_CELLS;
      g.fillStyle(mine ? HEX.cyan : HEX.magenta, mine ? 0.07 : 0.04);
      g.fillPoints(hexPoints(x, y, R - 2), true);
      g.lineStyle(1, mine ? HEX.cyan : HEX.magenta, mine ? 0.35 : 0.18);
      g.strokePoints(hexPoints(x, y, R - 2), true);
    }
    // A glowing line where the two halves meet.
    const midY = BOARD_Y + R + 3.5 * ROW_STEP;
    g.lineStyle(1, HEX.magenta, 0.4).lineBetween(BOARD_X, midY, BOARD_WIDTH - BOARD_X, midY);
    for (let i = 0; i < BENCH_SIZE; i++) {
      const { x, y } = slotCenter({ area: 'bench', index: i });
      g.fillStyle(HEX.panel, 0.9).fillRoundedRect(x - BENCH_SLOT / 2, y - BENCH_SLOT / 2 - 3, BENCH_SLOT, BENCH_SLOT + 6, 6);
      g.lineStyle(1, HEX.line, 1).strokeRoundedRect(x - BENCH_SLOT / 2, y - BENCH_SLOT / 2 - 3, BENCH_SLOT, BENCH_SLOT + 6, 6);
    }
  }

  // ---------- Planning ----------

  private setUpDragging() {
    this.input.on('dragstart', (_pointer: Phaser.Input.Pointer, view: UnitView) => {
      this.dragging = view;
      view.setDepth(30).setScale(1.15);
      useRunStore.getState().select(null);
    });
    this.input.on('drag', (_pointer: Phaser.Input.Pointer, view: UnitView, x: number, y: number) => {
      view.setPosition(x, y);
      this.drawHighlight(this.dropSlot(x, y));
    });
    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, view: UnitView) => {
      this.dragging = null;
      view.setDepth(10).setScale(1);
      this.highlight.clear();
      const from = view.getData('slot') as Slot;
      const to = this.dropSlot(view.x, view.y);
      const store = useRunStore.getState();
      const level = store.run?.level ?? 1;
      if (to && (to.area !== from.area || to.index !== from.index)) {
        store.act((run) => move(run, from, to), `Level ${level} fits ${level} unit${level === 1 ? '' : 's'} on the board`);
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

  private drawHighlight(slot: Slot | null) {
    this.highlight.clear();
    if (!slot) return;
    const { x, y } = slotCenter(slot);
    this.highlight.lineStyle(2, HEX.cyan, 0.9);
    if (slot.area === 'board') this.highlight.strokePoints(hexPoints(x, y, R - 2), true);
    else this.highlight.strokeRoundedRect(x - BENCH_SLOT / 2, y - BENCH_SLOT / 2 - 3, BENCH_SLOT, BENCH_SLOT + 6, 6);
  }

  /** Makes the sprites match the run: new units pop in, moved ones slide, sold ones fade. */
  private syncPlanning() {
    const { run, battle, selected } = useRunStore.getState();
    const planning = !battle;
    const seen = new Set<number>();
    const place = (unit: OwnedUnit | null, slot: Slot) => {
      if (!unit) return;
      seen.add(unit.uid);
      const target = slotCenter(slot);
      let view = this.views.get(unit.uid);
      if (!view) {
        view = new UnitView(this, target.x, target.y, unit.unitId, unit.star).setDepth(10);
        view.setInteractive({ draggable: true, useHandCursor: true });
        view.on('pointerup', (pointer: Phaser.Input.Pointer) => {
          if (pointer.getDistance() < 6) useRunStore.getState().select(view!.getData('slot') as Slot);
        });
        view.setScale(0.4);
        this.tweens.add({ targets: view, scale: 1, duration: 220, ease: 'Back.easeOut' });
        this.views.set(unit.uid, view);
      } else if (view.star !== unit.star) {
        view.setStar(unit.star);
        this.tweens.add({ targets: view, scale: { from: 1.5, to: 1 }, duration: 380, ease: 'Back.easeOut' });
        this.burst(target.x, target.y, unit.star === 3 ? HEX.cyan : 0xffffff);
        sfx.combine();
      }
      view.setData('slot', slot);
      view.setVisible(planning);
      if (view === this.dragging) return;
      if (view.x !== target.x || view.y !== target.y) {
        this.tweens.add({ targets: view, x: target.x, y: target.y, duration: 160, ease: 'Quad.easeOut' });
      }
      const isSelected = selected?.area === slot.area && selected.index === slot.index;
      view.image.setTint(isSelected ? 0xbff6ff : 0xffffff);
    };
    run?.board.forEach((unit, index) => place(unit, { area: 'board', index }));
    run?.bench.forEach((unit, index) => place(unit, { area: 'bench', index }));
    for (const [uid, view] of this.views) {
      if (seen.has(uid)) continue;
      this.views.delete(uid);
      view.disableInteractive();
      this.tweens.add({ targets: view, alpha: 0, scale: 0.3, duration: 180, onComplete: () => view.destroy() });
    }
    this.drawSelection(planning ? selected : null);
  }

  private drawSelection(slot: Slot | null) {
    this.highlight.clear();
    if (!slot) return;
    const { x, y } = slotCenter(slot);
    this.highlight.lineStyle(2, HEX.cyan, 1);
    if (slot.area === 'board') this.highlight.strokePoints(hexPoints(x, y, R - 3), true);
    else this.highlight.strokeRoundedRect(x - BENCH_SLOT / 2, y - BENCH_SLOT / 2 - 3, BENCH_SLOT, BENCH_SLOT + 6, 6);
  }

  // ---------- Combat replay ----------

  private startReplay(battle: Battle) {
    this.stopReplay();
    for (const view of this.views.values()) view.setVisible(false);
    this.highlight.clear();
    this.fighters = battle.result.fighters.map((info) => new FighterView(this, info).setDepth(10));
    for (const fighter of this.fighters) {
      fighter.setScale(0);
      this.tweens.add({ targets: fighter, scale: 1, duration: 260, delay: fighter.info.side === 'b' ? 120 : 0, ease: 'Back.easeOut' });
    }
    // Opponents sit on the half that was empty during planning; let them land before anything moves.
    this.replay = { battle, elapsed: -500, next: 0, bannerShown: false, overtimeShown: false };
  }

  private stopReplay() {
    this.replay = null;
    this.tweens.killTweensOf(this.fighters);
    for (const fighter of this.fighters) fighter.destroy();
    this.fighters = [];
    this.effects.removeAll(true);
  }

  update(_time: number, delta: number) {
    const replay = this.replay;
    if (!replay) return;
    const speed = useRunStore.getState().speed;
    replay.elapsed += delta * speed;
    const tick = Math.floor(replay.elapsed / MS_PER_TICK);
    const { events, ticks, winner } = replay.battle.result;
    while (replay.next < events.length && events[replay.next].t <= tick) this.apply(events[replay.next++], speed);
    if (!replay.overtimeShown && tick > OVERTIME_TICK && tick <= ticks) {
      replay.overtimeShown = true;
      this.banner('OVERTIME', COLORS.gold, true);
    }
    if (!replay.bannerShown && tick > ticks) {
      replay.bannerShown = true;
      this.banner(winner === 'a' ? 'VICTORY' : winner === 'b' ? 'DEFEAT' : 'DRAW', winner === 'a' ? COLORS.lime : winner === 'b' ? COLORS.danger : COLORS.muted);
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

  private apply(event: BattleEvent, speed: number) {
    const fighter = this.fighters[event.id];
    if (!fighter) return;
    switch (event.k) {
      case 'move': {
        const { x, y } = cellCenter(event.cell);
        this.tweens.add({ targets: fighter, x, y, duration: (MOVE_TICKS * MS_PER_TICK) / speed, ease: 'Sine.easeInOut' });
        break;
      }
      case 'attack': {
        const target = this.fighters[event.target];
        fighter.mana = event.mana;
        fighter.drawBars();
        if (!target) break;
        if (Phaser.Math.Distance.Between(fighter.x, fighter.y, target.x, target.y) > HEX_W * 1.5) {
          const bolt = this.add.circle(fighter.x, fighter.y - 4, 2.5, fighter.info.side === 'a' ? HEX.cyan : HEX.magenta);
          this.effects.add(bolt);
          this.tweens.add({ targets: bolt, x: target.x, y: target.y - 4, duration: 180 / speed, onComplete: () => bolt.destroy() });
        } else {
          const dx = (target.x - fighter.x) * 0.2;
          const dy = (target.y - fighter.y) * 0.2;
          this.tweens.add({ targets: fighter.image, x: dx, y: dy - 2, duration: 70 / speed, yoyo: true });
        }
        break;
      }
      case 'hit':
        fighter.hp = event.hp;
        fighter.shield = event.shield;
        fighter.mana = event.mana;
        fighter.drawBars();
        this.floatText(fighter, `${event.amount}`, event.ability ? COLORS.magenta : COLORS.text, event.ability ? 13 : 10);
        fighter.image.setTintFill(0xffffff);
        this.time.delayedCall(60, () => fighter.image.clearTint());
        if (this.time.now - this.lastHitSound > 60) {
          this.lastHitSound = this.time.now;
          sfx.hit();
        }
        break;
      case 'dodge':
        this.floatText(fighter, 'MISS', COLORS.muted, 9);
        break;
      case 'heal':
        fighter.hp = event.hp;
        fighter.drawBars();
        this.floatText(fighter, `+${event.amount}`, COLORS.lime, 12);
        break;
      case 'shield':
        fighter.shield = event.shield;
        fighter.drawBars();
        this.floatText(fighter, 'SHIELD', '#ffffff', 9);
        break;
      case 'stun':
        fighter.image.setTint(0x8a93b8);
        this.floatText(fighter, 'STUN', COLORS.gold, 9);
        this.time.delayedCall((event.ticks * MS_PER_TICK) / speed, () => fighter.active && fighter.image.clearTint());
        break;
      case 'cast': {
        fighter.mana = 0;
        fighter.drawBars();
        const color = fighter.info.side === 'a' ? HEX.cyan : HEX.magenta;
        for (const cell of event.cells) {
          const { x, y } = cellCenter(cell);
          const flash = this.add.graphics().fillStyle(color, 0.45).fillPoints(hexPoints(x, y, R - 3), true);
          this.effects.add(flash);
          this.tweens.add({ targets: flash, alpha: 0, duration: 420 / speed, onComplete: () => flash.destroy() });
        }
        this.tweens.add({ targets: fighter, scale: { from: 1.25, to: 1 }, duration: 240 / speed });
        sfx.cast();
        break;
      }
      case 'death':
        this.tweens.add({ targets: fighter, alpha: 0, scale: 0.5, duration: 260 / speed });
        this.burst(fighter.x, fighter.y, fighter.info.side === 'a' ? HEX.cyan : HEX.magenta);
        sfx.faint();
        break;
    }
  }

  private floatText(at: Phaser.GameObjects.Container, text: string, color: string, size: number) {
    const label = this.add
      .text(at.x + Phaser.Math.Between(-6, 6), at.y - 14, text, {
        fontFamily: DISPLAY_FONT,
        fontSize: `${size}px`,
        fontStyle: '800',
        color,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setResolution(CANVAS_ZOOM)
      .setOrigin(0.5);
    this.effects.add(label);
    this.tweens.add({ targets: label, y: label.y - 18, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => label.destroy() });
  }

  private burst(x: number, y: number, color: number) {
    const ring = this.add.circle(x, y, 6).setStrokeStyle(2, color).setFillStyle();
    this.effects.add(ring);
    this.tweens.add({ targets: ring, radius: 26, alpha: 0, duration: 360, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
  }

  private banner(text: string, color: string, brief = false) {
    const label = this.add
      .text(BOARD_WIDTH / 2, BOARD_Y + R + 3.5 * ROW_STEP, text, {
        fontFamily: DISPLAY_FONT,
        fontSize: '34px',
        fontStyle: '900',
        color,
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setResolution(CANVAS_ZOOM)
      .setOrigin(0.5)
      .setLetterSpacing(4)
      .setShadow(0, 0, color, 14, false, true)
      .setScale(0.6)
      .setAlpha(0);
    this.effects.add(label);
    this.tweens.add({ targets: label, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    if (brief) {
      label.setFontSize(22);
      this.tweens.add({ targets: label, alpha: 0, delay: 900, duration: 400, onComplete: () => label.destroy() });
    }
  }
}
