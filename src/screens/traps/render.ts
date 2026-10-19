import { arrowAt, BOX_H, BOX_W, sawAt, SAW_R, type Runner } from '../../games/traps/sim';
import { cellsOf, COLS, ROWS, TILE, type Placed, type World } from '../../games/traps/world';

// Draws Trap Tower on a canvas in world units (a cell is 256), from --traps-* tokens: the
// tower, its items, the saws and arrows where they are at a tick, and stick figures.

const TOKENS = ['sky', 'grid', 'rock', 'rock-top', 'ice', 'ice-shine', 'honey', 'honey-drip', 'spring', 'spring-coil', 'spikes', 'saw', 'saw-hub', 'track', 'bow', 'bow-tip', 'arrow', 'flag', 'pole', 'start', 'ok', 'bad', 'seat-0', 'seat-1', 'seat-2', 'seat-3'] as const;
export type Palette = Record<(typeof TOKENS)[number], string>;

export function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(TOKENS.map((t) => [t, style.getPropertyValue(`--traps-${t}`).trim() || '#888'])) as Palette;
}

export const seatColour = (c: Palette, seat: number) => c[`seat-${seat % 4}` as 'seat-0'];

export interface Figure {
  r: Runner;
  seat: number;
  ghost?: boolean;
}

export interface Scene {
  world: World;
  tick: number;
  figures?: Figure[];
  /** An item being placed, drawn see-through in green or red. */
  preview?: { item: Placed; ok: boolean } | null;
  grid?: boolean;
}

const U = TILE;

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colour: string) {
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
}

function cellGround(ctx: CanvasRenderingContext2D, c: Palette, kind: string, x: number, y: number) {
  const px = x * U;
  const py = y * U;
  if (kind === 'rock') {
    rect(ctx, px, py, U, U, c.rock);
    rect(ctx, px, py, U, 36, c['rock-top']);
  } else if (kind === 'ice') {
    rect(ctx, px, py, U, U, c.ice);
    ctx.strokeStyle = c['ice-shine'];
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(px + 50, py + 190);
    ctx.lineTo(px + 120, py + 70);
    ctx.stroke();
  } else if (kind === 'honey') {
    rect(ctx, px, py, U, U * 0.7, c.honey);
    ctx.fillStyle = c['honey-drip'];
    for (const [dx, len] of [
      [40, 60],
      [120, 100],
      [200, 40],
    ]) {
      ctx.beginPath();
      ctx.roundRect(px + dx - 18, py + U * 0.6, 36, len, 18);
      ctx.fill();
    }
  } else if (kind === 'spring') {
    rect(ctx, px + 20, py + U - 50, U - 40, 50, c.spring);
    ctx.strokeStyle = c['spring-coil'];
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(px + 70, py + U - 50);
    for (let k = 0; k < 5; k++) ctx.lineTo(px + (k % 2 ? 70 : 186), py + U - 80 - k * 26);
    ctx.stroke();
    rect(ctx, px + 10, py + 50, U - 20, 40, c.spring);
  } else if (kind === 'bow') {
    rect(ctx, px + 16, py + 16, U - 32, U - 32, c.bow);
  }
}

function bowTip(ctx: CanvasRenderingContext2D, c: Palette, x: number, y: number, rot: number) {
  ctx.save();
  ctx.translate(x * U + U / 2, y * U + U / 2);
  ctx.rotate((rot * Math.PI) / 2);
  ctx.fillStyle = c['bow-tip'];
  ctx.beginPath();
  ctx.moveTo(U / 2, 0);
  ctx.lineTo(10, -70);
  ctx.lineTo(10, 70);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function spikes(ctx: CanvasRenderingContext2D, c: Palette, x: number, y: number) {
  ctx.fillStyle = c.spikes;
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const left = x * U + 16 + k * 75;
    ctx.moveTo(left, (y + 1) * U);
    ctx.lineTo(left + 37, y * U + 70);
    ctx.lineTo(left + 75, (y + 1) * U);
  }
  ctx.fill();
}

function saw(ctx: CanvasRenderingContext2D, c: Palette, cx: number, cy: number, tick: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tick * 0.25);
  ctx.fillStyle = c.saw;
  ctx.beginPath();
  const teeth = 10;
  for (let k = 0; k < teeth * 2; k++) {
    const a = (k * Math.PI) / teeth;
    const r = k % 2 ? SAW_R + 6 : SAW_R + 34;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.fill();
  ctx.fillStyle = c['saw-hub'];
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function flag(ctx: CanvasRenderingContext2D, c: Palette, x: number, y: number) {
  rect(ctx, x * U + 70, y * U + 10, 18, U - 10, c.pole);
  ctx.fillStyle = c.flag;
  ctx.beginPath();
  ctx.moveTo(x * U + 88, y * U + 14);
  ctx.lineTo(x * U + 230, y * U + 60);
  ctx.lineTo(x * U + 88, y * U + 110);
  ctx.closePath();
  ctx.fill();
}

/** A stick figure filling a runner's box: legs swing as it runs, spread in the air, and it lies flat once out. */
export function stickFigure(ctx: CanvasRenderingContext2D, colour: string, r: Runner, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(r.x + BOX_W / 2, r.y + BOX_H);
  if (r.status === 'dead') ctx.rotate((r.face * Math.PI) / 2);
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  const swing = r.on && r.vx !== 0 ? Math.sin(r.tick * 0.45) * 40 : r.on ? 0 : 45;
  ctx.beginPath();
  // Legs, body, arms.
  ctx.moveTo(-swing, -4);
  ctx.lineTo(0, -80);
  ctx.lineTo(swing, -4);
  ctx.moveTo(0, -80);
  ctx.lineTo(0, -150);
  ctx.moveTo(-50 * r.face, r.on ? -100 : -170);
  ctx.lineTo(0, -135);
  ctx.lineTo(50 * r.face, r.on ? -110 + swing / 3 : -170);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -186, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function item(ctx: CanvasRenderingContext2D, c: Palette, p: Placed, tick: number) {
  const ground = p.item === 'block' || p.item === 'plank' ? 'rock' : p.item;
  if (p.item === 'spikes') return spikes(ctx, c, p.x, p.y);
  if (p.item === 'saw') {
    const cells = cellsOf(p);
    ctx.strokeStyle = c.track;
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(cells[0].x * U + U / 2, cells[0].y * U + U / 2);
    ctx.lineTo(cells[2].x * U + U / 2, cells[2].y * U + U / 2);
    ctx.stroke();
    const at = sawAt({ owner: p.by, x: p.x, y: p.y, flat: p.rot % 2 === 0 }, tick);
    return saw(ctx, c, at.x, at.y, tick);
  }
  if (p.item === 'bomb') {
    ctx.fillStyle = c.bad;
    ctx.fillRect((p.x - 1) * U, (p.y - 1) * U, U * 3, U * 3);
    ctx.fillStyle = c.spikes;
    ctx.beginPath();
    ctx.arc(p.x * U + U / 2, p.y * U + U / 2 + 20, 90, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  for (const cell of cellsOf(p)) cellGround(ctx, c, ground, cell.x, cell.y);
  if (p.item === 'bow') bowTip(ctx, c, p.x, p.y, p.rot);
}

/** The whole scene, in world units: call with the context already scaled to the canvas. */
export function draw(ctx: CanvasRenderingContext2D, c: Palette, scene: Scene, items: readonly Placed[]) {
  const { world, tick } = scene;
  rect(ctx, 0, 0, COLS * U, ROWS * U, c.sky);
  if (scene.grid) {
    ctx.strokeStyle = c.grid;
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) {
      ctx.moveTo(x * U, 0);
      ctx.lineTo(x * U, ROWS * U);
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.moveTo(0, y * U);
      ctx.lineTo(COLS * U, y * U);
    }
    ctx.stroke();
  }
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (world.tower.rows[y][x] === '#') cellGround(ctx, c, 'rock', x, y);
  rect(ctx, world.start.x * U + 30, (world.start.y + 1) * U - 24, U - 60, 24, c.start);
  flag(ctx, c, world.flag.x, world.flag.y);
  for (const p of items) item(ctx, c, p, tick);

  // Arrows in flight.
  ctx.strokeStyle = c.arrow;
  ctx.lineWidth = 18;
  ctx.lineCap = 'round';
  for (const bow of world.bows) {
    const tip = arrowAt(bow, tick);
    if (!tip) continue;
    ctx.beginPath();
    ctx.moveTo(tip.x - bow.dx * 128, tip.y - bow.dy * 128);
    ctx.lineTo(tip.x, tip.y);
    ctx.moveTo(tip.x - bow.dx * 40 - bow.dy * 30, tip.y - bow.dy * 40 - bow.dx * 30);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(tip.x - bow.dx * 40 + bow.dy * 30, tip.y - bow.dy * 40 + bow.dx * 30);
    ctx.stroke();
  }

  if (scene.preview) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    item(ctx, c, scene.preview.item, tick);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = scene.preview.ok ? c.ok : c.bad;
    for (const cell of cellsOf(scene.preview.item)) ctx.fillRect(cell.x * U, cell.y * U, U, U);
    ctx.restore();
  }

  for (const f of scene.figures ?? []) if (f.ghost) stickFigure(ctx, seatColour(c, f.seat), f.r, 0.4);
  for (const f of scene.figures ?? []) if (!f.ghost) stickFigure(ctx, seatColour(c, f.seat), f.r);
}
