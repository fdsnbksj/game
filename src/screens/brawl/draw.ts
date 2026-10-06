import { FIGHTERS, totalFrames, type Move } from '../../games/brawl/fighters';
import { BLAST, BODY_H, BODY_W, PLATFORMS, SUB } from '../../games/brawl/stage';
import { hitbox, inPlay, isActive, moveOf, type Match } from '../../games/brawl/state';

/** The colours, read once from the tokens in index.css. */
export interface Palette {
  skyTop: string;
  skyBottom: string;
  glow: string;
  stage: string;
  stageTop: string;
  stageEdge: string;
  ledge: string;
  seats: string[];
  flash: string;
  steel: string;
  wood: string;
  eye: string;
}

export function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    skyTop: v('--brawl-sky-top'),
    skyBottom: v('--brawl-sky-bottom'),
    glow: v('--brawl-glow'),
    stage: v('--brawl-stage'),
    stageTop: v('--brawl-stage-top'),
    stageEdge: v('--brawl-stage-edge'),
    ledge: v('--brawl-ledge'),
    seats: [v('--brawl-p1'), v('--brawl-p2'), v('--brawl-p3'), v('--brawl-p4')],
    flash: v('--brawl-flash'),
    steel: v('--brawl-steel'),
    wood: v('--brawl-wood'),
    eye: v('--brawl-eye'),
  };
}

/** What the view shows: a centre and a width, in world pixels. */
export interface Camera {
  x: number;
  y: number;
  w: number;
}

const MIN_W = 660;
const MAX_W = 1500;

/** Frames everyone in play plus the island, easing toward it so the view never jumps. */
export function follow(m: Match, cam: Camera | null, aspect: number): Camera {
  let left = -300;
  let right = 300;
  let top = -320;
  let bottom = 70;
  for (const f of m.fighters) {
    if (!inPlay(f)) continue;
    const x = f.x / SUB;
    const y = f.y / SUB;
    left = Math.min(left, x - 70);
    right = Math.max(right, x + 70);
    top = Math.min(top, y - BODY_H - 60);
    bottom = Math.max(bottom, y + 40);
  }
  left = Math.max(left, BLAST.left);
  right = Math.min(right, BLAST.right);
  top = Math.max(top, BLAST.top);
  bottom = Math.min(bottom, BLAST.bottom);
  const w = Math.min(MAX_W, Math.max(MIN_W, right - left, (bottom - top) * aspect));
  const target = { x: (left + right) / 2, y: (top + bottom) / 2, w };
  if (!cam) return target;
  const ease = 0.1;
  return { x: cam.x + (target.x - cam.x) * ease, y: cam.y + (target.y - cam.y) * ease, w: cam.w + (target.w - cam.w) * ease };
}

/** A burst where someone left the arena, drawn for a few frames. */
export interface Burst {
  x: number;
  y: number;
  seat: number;
  age: number;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawStage(ctx: CanvasRenderingContext2D, p: Palette) {
  const ground = PLATFORMS[0];
  roundRect(ctx, ground.left, ground.top, ground.right - ground.left, ground.bottom - ground.top, 10);
  const fill = ctx.createLinearGradient(0, ground.top, 0, ground.bottom);
  fill.addColorStop(0, p.stage);
  fill.addColorStop(1, p.stageEdge);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.fillStyle = p.stageTop;
  ctx.fillRect(ground.left + 6, ground.top, ground.right - ground.left - 12, 3);
  for (const ledge of PLATFORMS.slice(1)) {
    roundRect(ctx, ledge.left, ledge.top, ledge.right - ledge.left, 7, 3.5);
    ctx.fillStyle = p.ledge;
    ctx.fill();
  }
}

/** The weapon, held out along a direction from the hand: a sword, a hammer or a spear. */
function drawWeapon(ctx: CanvasRenderingContext2D, kind: 'sword' | 'hammer' | 'spear', hx: number, hy: number, dx: number, dy: number, p: Palette, length: number) {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const tx = hx + ux * length;
  const ty = hy + uy * length;
  ctx.lineCap = 'round';
  if (kind === 'spear') {
    ctx.strokeStyle = p.wood;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hx - ux * 12, hy - uy * 12);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.fillStyle = p.steel;
    ctx.beginPath();
    ctx.moveTo(tx + ux * 12, ty + uy * 12);
    ctx.lineTo(tx - uy * 5, ty + ux * 5);
    ctx.lineTo(tx + uy * 5, ty - ux * 5);
    ctx.fill();
  } else if (kind === 'hammer') {
    ctx.strokeStyle = p.wood;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(Math.atan2(uy, ux));
    ctx.fillStyle = p.steel;
    roundRect(ctx, -6, -11, 16, 22, 3);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.strokeStyle = p.steel;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(hx + ux * 6, hy + uy * 6);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.strokeStyle = p.wood;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hx - uy * 7 + ux * 5, hy + ux * 7 + uy * 5);
    ctx.lineTo(hx + uy * 7 + ux * 5, hy - ux * 7 + uy * 5);
    ctx.stroke();
  }
}

/** Where the weapon points: resting, winding up, or out at the hitbox. */
function weaponAim(move: Move | null, frame: number, facing: number): [number, number] {
  if (!move) return [facing * 0.5, -1];
  const box = move.box;
  const reach: [number, number] = [facing * (box.x + box.w / 2), box.y + box.h / 2 + BODY_H * 0.55];
  if (frame <= move.startup) return [-facing * 0.6, -1];
  if (frame <= move.startup + move.active) return reach;
  const t = (frame - move.startup - move.active) / Math.max(1, totalFrames(move) - move.startup - move.active);
  return [reach[0] * (1 - t) + facing * 0.5 * t, reach[1] * (1 - t) - t];
}

function drawFighter(ctx: CanvasRenderingContext2D, m: Match, seat: number, p: Palette) {
  const f = m.fighters[seat];
  if (!inPlay(f)) return;
  const fighter = FIGHTERS[m.seats[seat].fighter];
  const x = f.x / SUB;
  const y = f.y / SUB;
  const colour = p.seats[seat % p.seats.length];
  const move = moveOf(m, seat);

  ctx.save();
  const blinking = f.invulnerable > 0 && f.dodge === 0 && Math.floor(m.frame / 4) % 2 === 0;
  ctx.globalAlpha = f.dodge > 0 ? 0.4 : blinking ? 0.55 : 1;

  // The swing: a soft sweep where the hitbox is, while it's out.
  if (move && isActive(f, move)) {
    const box = hitbox(f, move);
    ctx.fillStyle = colour;
    ctx.globalAlpha *= move.heavy ? 0.32 : 0.22;
    roundRect(ctx, box.left / SUB, box.top / SUB, (box.right - box.left) / SUB, (box.bottom - box.top) / SUB, 14);
    ctx.fill();
    ctx.globalAlpha = f.dodge > 0 ? 0.4 : 1;
  }
  // A heavy winding up glows.
  if (move?.heavy && f.moveFrame <= move.startup) {
    ctx.shadowColor = colour;
    ctx.shadowBlur = 18;
  }

  const hurt = f.hitstun > 0 && f.freeze > 0;
  const w = BODY_W - 6;
  ctx.fillStyle = hurt ? p.flash : colour;
  roundRect(ctx, x - w / 2, y - BODY_H + 18, w, BODY_H - 22, 10);
  ctx.fill();
  // Legs, a little apart when running.
  const stride = f.platform >= 0 && Math.abs(f.vx) > 100 ? Math.sin(m.frame / 4) * 4 : 0;
  ctx.fillRect(x - 9 + stride, y - 8, 6, 8);
  ctx.fillRect(x + 3 - stride, y - 8, 6, 8);
  ctx.beginPath();
  ctx.arc(x, y - BODY_H + 9, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = p.eye;
  ctx.beginPath();
  ctx.arc(x + f.facing * 4.5, y - BODY_H + 8, 2.2, 0, Math.PI * 2);
  ctx.fill();

  const [ax, ay] = weaponAim(move, f.moveFrame, f.facing);
  const length = fighter.weapon === 'spear' ? 54 : fighter.weapon === 'hammer' ? 34 : 40;
  drawWeapon(ctx, fighter.weapon, x + f.facing * 10, y - BODY_H * 0.55, ax, ay, p, length);
  ctx.restore();
}

function drawBurst(ctx: CanvasRenderingContext2D, b: Burst, p: Palette) {
  const t = b.age / 40;
  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.strokeStyle = p.seats[b.seat % p.seats.length];
  ctx.lineWidth = 6 * (1 - t) + 1;
  ctx.beginPath();
  ctx.arc(b.x, b.y, 30 + t * 140, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function draw(ctx: CanvasRenderingContext2D, width: number, height: number, m: Match, cam: Camera, p: Palette, bursts: Burst[]) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, p.skyTop);
  sky.addColorStop(1, p.skyBottom);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const scale = width / cam.w;
  ctx.setTransform(scale, 0, 0, scale, width / 2 - cam.x * scale, height / 2 - cam.y * scale);

  // A gold glow over the island, behind everything.
  const glow = ctx.createRadialGradient(0, -120, 20, 0, -120, 520);
  glow.addColorStop(0, p.glow);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(-720, -700, 1440, 1000);

  drawStage(ctx, p);
  // You on top, so your own fighter is never lost in a crowd.
  for (let seat = m.fighters.length - 1; seat >= 0; seat--) drawFighter(ctx, m, seat, p);
  for (const b of bursts) drawBurst(ctx, b, p);
}
