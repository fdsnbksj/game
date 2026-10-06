import { BLAST, BODY_H, BODY_W, PLATFORMS, SUB } from '../../games/brawl/stage';
import { hitbox, inPlay, isActive, ITEM_LIFE, skillOf, type Blast, type FighterState, type Item, type Match, type Projectile } from '../../games/brawl/state';
import { aimVector, skillFrames, WEAPON_FRAMES, type WeaponId } from '../../games/brawl/weapons';

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
  bomb: string;
  spark: string;
  itemGlow: string;
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
    bomb: v('--brawl-bomb'),
    spark: v('--brawl-spark'),
    itemGlow: v('--brawl-item-glow'),
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

/** A weapon held out along a direction from the hand. */
function drawWeapon(ctx: CanvasRenderingContext2D, kind: WeaponId, hx: number, hy: number, dx: number, dy: number, p: Palette, colour: string) {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const length = kind === 'spear' ? 54 : kind === 'hammer' ? 34 : kind === 'sword' ? 40 : 14;
  const tx = hx + ux * length;
  const ty = hy + uy * length;
  ctx.lineCap = 'round';
  if (kind === 'fists') {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(tx, ty, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'spear') {
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
  } else if (kind === 'sword') {
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
  } else if (kind === 'bow') {
    // A curve facing the aim, with its string.
    const a = Math.atan2(uy, ux);
    ctx.strokeStyle = p.wood;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hx, hy, 16, a - 1.1, a + 1.1);
    ctx.stroke();
    ctx.strokeStyle = p.steel;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx + Math.cos(a - 1.1) * 16, hy + Math.sin(a - 1.1) * 16);
    ctx.lineTo(hx + Math.cos(a + 1.1) * 16, hy + Math.sin(a + 1.1) * 16);
    ctx.stroke();
  } else {
    ctx.fillStyle = p.bomb;
    ctx.beginPath();
    ctx.arc(hx + ux * 10, hy + uy * 10, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.spark;
    ctx.beginPath();
    ctx.arc(hx + ux * 10 + 4, hy + uy * 10 - 7, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Where the weapon points: resting, winding up, or out along the aim. */
function weaponAim(f: FighterState): [number, number] {
  const skill = skillOf(f);
  if (!skill) return [f.facing * 0.5, -1];
  const [ax, ay] = aimVector(f.aimX, f.aimY);
  if (f.skillFrame <= skill.startup) return [-ax - f.facing * 0.3, -ay - 0.6];
  const out = skill.kind === 'melee' ? skill.startup + skill.active : skill.startup + 4;
  if (f.skillFrame <= out) return [ax, ay];
  const t = (f.skillFrame - out) / Math.max(1, skillFrames(skill) - out);
  return [ax * (1 - t) + f.facing * 0.5 * t, ay * (1 - t) - t];
}

function drawFighter(ctx: CanvasRenderingContext2D, m: Match, seat: number, p: Palette, local: number) {
  const f = m.fighters[seat];
  if (!inPlay(f)) return;
  const x = f.x / SUB;
  const y = f.y / SUB;
  // Your own fighter is always the first colour, gold.
  const colour = p.seats[(seat - local + m.fighters.length) % m.fighters.length];
  const skill = skillOf(f);

  ctx.save();
  const blinking = f.invulnerable > 0 && Math.floor(m.frame / 4) % 2 === 0;
  ctx.globalAlpha = blinking ? 0.55 : 1;

  // The swing: a soft sweep where the hitbox is, while it's out.
  if (isActive(f, skill)) {
    const box = hitbox(f, skill);
    ctx.fillStyle = colour;
    ctx.globalAlpha *= f.skill === 2 ? 0.32 : 0.22;
    roundRect(ctx, box.left / SUB, box.top / SUB, (box.right - box.left) / SUB, (box.bottom - box.top) / SUB, 14);
    ctx.fill();
    ctx.globalAlpha = blinking ? 0.55 : 1;
  }
  // A strong skill winding up glows.
  if (skill && f.skill === 2 && f.skillFrame <= skill.startup) {
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

  const [ax, ay] = weaponAim(f);
  drawWeapon(ctx, f.weapon, x + f.facing * 10, y - BODY_H * 0.55, ax, ay, p, colour);

  // The weapon's time left: a ring over the head that runs down.
  if (f.weapon !== 'fists' && f.weaponLeft > 0) {
    const left = f.weaponLeft / WEAPON_FRAMES;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 3;
    ctx.globalAlpha = left < 0.2 && Math.floor(m.frame / 6) % 2 === 0 ? 0.3 : 0.9;
    ctx.beginPath();
    ctx.arc(x, y - BODY_H - 14, 7, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** A weapon waiting on the ground: bobbing, glowing, blinking as it's about to fade. */
function drawItem(ctx: CanvasRenderingContext2D, it: Item, p: Palette) {
  const x = it.x / SUB;
  const y = it.y / SUB - 18 + Math.sin(it.age / 12) * 3;
  ctx.save();
  if (it.age > ITEM_LIFE - 120 && Math.floor(it.age / 6) % 2 === 0) ctx.globalAlpha = 0.35;
  // It drops in from above.
  const fall = Math.max(0, 20 - it.age) * 6;
  const glow = ctx.createRadialGradient(x, y - fall, 2, x, y - fall, 26);
  glow.addColorStop(0, p.itemGlow);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 28, y - fall - 28, 56, 56);
  drawWeapon(ctx, it.weapon, x - 10, y - fall + 10, 1, -1, p, p.steel);
  ctx.restore();
}

function drawProjectile(ctx: CanvasRenderingContext2D, pr: Projectile, p: Palette) {
  const x = pr.x / SUB;
  const y = pr.y / SUB;
  if (pr.kind === 'arrow' || pr.kind === 'pierce') {
    const len = Math.hypot(pr.vx, pr.vy) || 1;
    const ux = pr.vx / len;
    const uy = pr.vy / len;
    const long = pr.kind === 'pierce' ? 34 : 24;
    ctx.save();
    if (pr.kind === 'pierce') {
      ctx.shadowColor = p.spark;
      ctx.shadowBlur = 10;
    }
    ctx.strokeStyle = p.steel;
    ctx.lineWidth = pr.kind === 'pierce' ? 3 : 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - ux * long, y - uy * long);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const r = pr.kind === 'bigBomb' ? 10 : 7;
  ctx.fillStyle = p.bomb;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // The fuse flickers faster as it burns down.
  if (Math.floor(pr.age / Math.max(2, Math.trunc(pr.life / 8))) % 2 === 0) {
    ctx.fillStyle = p.spark;
    ctx.beginPath();
    ctx.arc(x + r * 0.6, y - r, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBlast(ctx: CanvasRenderingContext2D, b: Blast, p: Palette) {
  const t = b.age / 18;
  ctx.save();
  ctx.globalAlpha = 0.55 * (1 - t);
  ctx.fillStyle = p.spark;
  ctx.beginPath();
  ctx.arc(b.x / SUB, b.y / SUB, b.radius * (0.6 + t * 0.5), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBurst(ctx: CanvasRenderingContext2D, b: Burst, colour: string) {
  const t = b.age / 40;
  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 6 * (1 - t) + 1;
  ctx.beginPath();
  ctx.arc(b.x, b.y, 30 + t * 140, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function draw(ctx: CanvasRenderingContext2D, width: number, height: number, m: Match, cam: Camera, p: Palette, bursts: Burst[], local = 0) {
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
  for (const it of m.items) drawItem(ctx, it, p);
  // You on top, so your own fighter is never lost in a crowd.
  const n = m.fighters.length;
  for (let k = n - 1; k >= 0; k--) drawFighter(ctx, m, (local + k) % n, p, local);
  for (const pr of m.projectiles) drawProjectile(ctx, pr, p);
  for (const b of m.blasts) drawBlast(ctx, b, p);
  for (const b of bursts) drawBurst(ctx, b, p.seats[(b.seat - local + n) % n]);
}
