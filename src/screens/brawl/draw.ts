import { BODY_H, moverAt, sawAt, SUB } from '../../games/brawl/stages';
import {
  attackOf,
  CRACK,
  hitbox,
  ICE_HALF,
  inPlay,
  isActive,
  ITEM_LIFE,
  MAX_CHARGE,
  stageOf,
  windAt,
  type Blast,
  type FighterState,
  type Ice,
  type Item,
  type Match,
  type Projectile,
} from '../../games/brawl/state';
import { aimVector, attackFrames, MAX_HP, type WeaponId } from '../../games/brawl/weapons';

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
  gun: string;
  wood: string;
  bomb: string;
  spark: string;
  itemGlow: string;
  ice: string;
  iceEdge: string;
  frost: string;
  lava: string;
  lavaGlow: string;
  spike: string;
  pad: string;
  wind: string;
  hpGood: string;
  hpMid: string;
  hpLow: string;
  hpBack: string;
  belt: string;
  rink: string;
  saw: string;
  chicken: string;
  bread: string;
  banana: string;
  bubble: string;
  moon: string;
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
    gun: v('--brawl-gun'),
    wood: v('--brawl-wood'),
    bomb: v('--brawl-bomb'),
    spark: v('--brawl-spark'),
    itemGlow: v('--brawl-item-glow'),
    ice: v('--brawl-ice'),
    iceEdge: v('--brawl-ice-edge'),
    frost: v('--brawl-frost'),
    lava: v('--brawl-lava'),
    lavaGlow: v('--brawl-lava-glow'),
    spike: v('--brawl-spike'),
    pad: v('--brawl-pad'),
    wind: v('--brawl-wind'),
    hpGood: v('--brawl-hp-good'),
    hpMid: v('--brawl-hp-mid'),
    hpLow: v('--brawl-hp-low'),
    hpBack: v('--brawl-hp-back'),
    belt: v('--brawl-belt'),
    rink: v('--brawl-rink'),
    saw: v('--brawl-saw'),
    chicken: v('--brawl-chicken'),
    bread: v('--brawl-bread'),
    banana: v('--brawl-banana'),
    bubble: v('--brawl-bubble'),
    moon: v('--brawl-moon'),
  };
}

/** What the view shows: a centre and a width, in world pixels. */
export interface Camera {
  x: number;
  y: number;
  w: number;
}

const MIN_W = 700;

/** Frames the stage's ground and everyone still up, easing toward it so the view never jumps. */
export function follow(m: Match, cam: Camera | null, aspect: number): Camera {
  const stage = stageOf(m);
  let left = Math.min(...stage.platforms.map((p) => p.left)) - 40;
  let right = Math.max(...stage.platforms.map((p) => p.right)) + 40;
  let top = Math.min(...stage.platforms.map((p) => p.top)) - 140;
  let bottom = Math.max(Math.max(...stage.safe.map((s) => s.top)) + 120, Math.max(...stage.platforms.map((p) => p.top)) + 80);
  // Show the danger below: the lava's surface, the spike bed.
  if (stage.hazard.kind === 'lava') bottom = Math.max(bottom, stage.hazard.top + 70);
  if (stage.hazard.kind === 'spikes') bottom = Math.max(bottom, ...stage.hazard.strips.map((s) => s.bottom + 50));
  for (const f of m.fighters) {
    if (!inPlay(f)) continue;
    const x = f.x / SUB;
    const y = f.y / SUB;
    left = Math.min(left, x - 70);
    right = Math.max(right, x + 70);
    top = Math.min(top, y - BODY_H - 60);
    bottom = Math.max(bottom, y + 40);
  }
  // Room over everyone for the score chips, which sit on top of the arena.
  top -= 90;
  const b = stage.blast;
  left = Math.max(left, b.left);
  right = Math.min(right, b.right);
  top = Math.max(top, b.top);
  bottom = Math.min(bottom, b.bottom);
  const w = Math.min(b.right - b.left, Math.max(MIN_W, right - left, (bottom - top) * aspect));
  const target = { x: (left + right) / 2, y: (top + bottom) / 2, w };
  // A new stage: jump straight there rather than drifting across.
  if (!cam || Math.abs(cam.x - target.x) > 600) return target;
  const ease = 0.1;
  return { x: cam.x + (target.x - cam.x) * ease, y: cam.y + (target.y - cam.y) * ease, w: cam.w + (target.w - cam.w) * ease };
}

/** A burst where someone went down, drawn for a few frames. */
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

function block(ctx: CanvasRenderingContext2D, left: number, top: number, right: number, bottom: number, p: Palette) {
  roundRect(ctx, left, top, right - left, bottom - top, 8);
  const fill = ctx.createLinearGradient(0, top, 0, Math.min(bottom, top + 160));
  fill.addColorStop(0, p.stage);
  fill.addColorStop(1, p.stageEdge);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.fillStyle = p.stageTop;
  ctx.fillRect(left + 6, top, right - left - 12, 3);
}

function drawStage(ctx: CanvasRenderingContext2D, m: Match, p: Palette) {
  const stage = stageOf(m);
  const hazard = stage.hazard;

  // The Moon: a big pale disc low in the sky.
  if (stage.id === 'moon') {
    ctx.fillStyle = p.moon;
    ctx.beginPath();
    ctx.arc(-420, -520, 120, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lava glows beneath it all.
  if (hazard.kind === 'lava') {
    const top = hazard.top;
    const glow = ctx.createLinearGradient(0, top - 120, 0, top);
    glow.addColorStop(0, 'transparent');
    glow.addColorStop(1, p.lavaGlow);
    ctx.fillStyle = glow;
    ctx.fillRect(stage.blast.left, top - 120, stage.blast.right - stage.blast.left, 120);
    ctx.fillStyle = p.lava;
    ctx.beginPath();
    ctx.moveTo(stage.blast.left, stage.blast.bottom);
    for (let x = stage.blast.left; x <= stage.blast.right; x += 20) ctx.lineTo(x, top + Math.sin(x / 40 + m.frame / 12) * 4);
    ctx.lineTo(stage.blast.right, stage.blast.bottom);
    ctx.closePath();
    ctx.fill();
  }

  stage.platforms.forEach((pl, i) => {
    const c = m.crumble[i] ?? 0;
    if (c >= CRACK) return;
    ctx.save();
    // A cracking block shakes, more as it goes.
    if (c > 0) ctx.translate(Math.sin(m.frame * 1.7) * (c / CRACK) * 3, 0);
    if (pl.soft) {
      roundRect(ctx, pl.left, pl.top, pl.right - pl.left, 7, 3.5);
      ctx.fillStyle = p.ledge;
      ctx.fill();
    } else block(ctx, pl.left, pl.top, pl.right, pl.bottom, p);
    if (pl.crumbles && c > 0) {
      ctx.strokeStyle = p.stageEdge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pl.left + 30, pl.top + 2);
      ctx.lineTo(pl.left + 45, pl.top + 16);
      ctx.lineTo(pl.left + 38, pl.bottom);
      ctx.moveTo(pl.right - 25, pl.top + 2);
      ctx.lineTo(pl.right - 40, pl.bottom - 6);
      ctx.stroke();
    }
    if (pl.belt) {
      // Chevrons running the way the belt carries.
      ctx.strokeStyle = p.belt;
      ctx.lineWidth = 2;
      const dir = Math.sign(pl.belt);
      const offset = (((m.frame * Math.abs(pl.belt)) / 100) % 24) * dir;
      ctx.save();
      ctx.beginPath();
      ctx.rect(pl.left, pl.top, pl.right - pl.left, 12);
      ctx.clip();
      ctx.beginPath();
      for (let x = pl.left - 24; x < pl.right + 24; x += 24) {
        const cx = x + offset;
        ctx.moveTo(cx - dir * 4, pl.top + 3);
        ctx.lineTo(cx + dir * 4, pl.top + 7);
        ctx.lineTo(cx - dir * 4, pl.top + 11);
      }
      ctx.stroke();
      ctx.restore();
    }
    if (pl.slippery) {
      // A sheen of ice along the top.
      ctx.fillStyle = p.rink;
      ctx.fillRect(pl.left + 4, pl.top, pl.right - pl.left - 8, pl.soft ? 3 : 6);
    }
    if (pl.bounce) {
      // A spring pad on top.
      ctx.fillStyle = p.pad;
      roundRect(ctx, pl.left + 10, pl.top - 6, pl.right - pl.left - 20, 6, 3);
      ctx.fill();
    }
    ctx.restore();
  });

  // Moving platforms, where they are now.
  for (const mover of stage.movers) {
    const pl = moverAt(mover, m.frame);
    roundRect(ctx, pl.left, pl.top, pl.right - pl.left, 9, 4);
    ctx.fillStyle = p.stageTop;
    ctx.fill();
  }

  if (hazard.kind === 'saws') {
    for (const saw of hazard.saws) {
      const c = sawAt(saw, m.frame);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(m.frame * 0.4);
      ctx.fillStyle = p.saw;
      ctx.beginPath();
      // Teeth round the rim.
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const b = a + Math.PI / 12;
        ctx.lineTo(Math.cos(a) * saw.radius, Math.sin(a) * saw.radius);
        ctx.lineTo(Math.cos(b) * (saw.radius - 6), Math.sin(b) * (saw.radius - 6));
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = p.stageEdge;
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  if (hazard.kind === 'spikes') {
    ctx.fillStyle = p.spike;
    for (const s of hazard.strips) {
      // Pointing away from whatever they're fixed to: up from the bed, down from a block's underside.
      const up = s.top > 0;
      const base = up ? s.bottom : s.top;
      const tip = up ? s.top : s.bottom;
      ctx.beginPath();
      for (let x = s.left; x < s.right; x += 12) {
        ctx.moveTo(x, base);
        ctx.lineTo(x + 6, tip);
        ctx.lineTo(Math.min(x + 12, s.right), base);
      }
      ctx.fill();
    }
  }
}

/** Gusts: streaks across the sky while it blows, and an arrow at the edge while it's coming. */
function drawWind(ctx: CanvasRenderingContext2D, m: Match, cam: Camera, p: Palette, width: number, height: number) {
  const wind = windAt(m);
  if (wind.dir === 0) return;
  if (wind.warning) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = p.wind;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(m.frame / 4);
    const x = wind.dir > 0 ? 40 : width - 40;
    const y = height * 0.4;
    ctx.beginPath();
    ctx.moveTo(x + wind.dir * 24, y);
    ctx.lineTo(x - wind.dir * 10, y - 22);
    ctx.lineTo(x - wind.dir * 10, y + 22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.strokeStyle = p.wind;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5;
  const span = cam.w * 1.2;
  for (let i = 0; i < 14; i++) {
    const y = cam.y - 300 + ((i * 97) % 600);
    const x = cam.x - span / 2 + ((((i * 211 + m.frame * 18 * wind.dir) % span) + span) % span);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - wind.dir * 60, y);
    ctx.stroke();
  }
  ctx.restore();
}

/** Turns the canvas to point along (ux, uy), flipped so things never hang upside down. */
function along(ctx: CanvasRenderingContext2D, x: number, y: number, ux: number, uy: number) {
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(uy, ux));
  if (ux < 0) ctx.scale(1, -1);
}

/** A weapon held out along a direction from the hand. */
function drawWeapon(ctx: CanvasRenderingContext2D, kind: WeaponId, hx: number, hy: number, dx: number, dy: number, p: Palette) {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  ctx.save();
  ctx.lineCap = 'round';
  along(ctx, hx, hy, ux, uy);
  const line = (colour: string, width: number, x0: number, x1: number, y0 = 0, y1 = y0) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  switch (kind) {
    case 'fists':
      break;
    case 'sword':
      line(p.wood, 3, 0, 6, -6, 6);
      line(p.steel, 4, 4, 40);
      break;
    case 'hammer':
      line(p.wood, 4, -4, 32);
      ctx.fillStyle = p.steel;
      roundRect(ctx, 28, -11, 14, 22, 3);
      ctx.fill();
      break;
    case 'spear':
      line(p.wood, 3, -12, 50);
      ctx.fillStyle = p.steel;
      ctx.beginPath();
      ctx.moveTo(62, 0);
      ctx.lineTo(48, -5);
      ctx.lineTo(48, 5);
      ctx.fill();
      break;
    case 'axe':
      line(p.wood, 4, -4, 34);
      ctx.fillStyle = p.steel;
      ctx.beginPath();
      ctx.moveTo(32, 0);
      ctx.lineTo(24, -16);
      ctx.quadraticCurveTo(36, -14, 40, -2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'scythe':
      line(p.wood, 3, -10, 52);
      ctx.strokeStyle = p.steel;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(38, 0, 16, -Math.PI / 2, 0.3);
      ctx.stroke();
      break;
    case 'pistol':
      ctx.fillStyle = p.gun;
      roundRect(ctx, 0, -5, 18, 6, 2);
      ctx.fill();
      roundRect(ctx, 0, -1, 6, 9, 2);
      ctx.fill();
      break;
    case 'rifle':
      ctx.fillStyle = p.gun;
      roundRect(ctx, -6, -5, 38, 7, 2);
      ctx.fill();
      roundRect(ctx, 6, 1, 6, 9, 2);
      ctx.fill();
      break;
    case 'shotgun':
      ctx.fillStyle = p.gun;
      roundRect(ctx, -4, -6, 34, 9, 3);
      ctx.fill();
      ctx.fillStyle = p.wood;
      roundRect(ctx, -12, -4, 10, 9, 3);
      ctx.fill();
      break;
    case 'sniper':
      ctx.fillStyle = p.gun;
      roundRect(ctx, -8, -4, 50, 5, 2);
      ctx.fill();
      roundRect(ctx, 8, -10, 14, 5, 2);
      ctx.fill();
      break;
    case 'rocket':
      ctx.fillStyle = p.gun;
      roundRect(ctx, -14, -7, 46, 13, 5);
      ctx.fill();
      ctx.fillStyle = p.spark;
      ctx.fillRect(30, -5, 4, 9);
      break;
    case 'bow':
      ctx.strokeStyle = p.wood;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 16, -1.1, 1.1);
      ctx.stroke();
      line(p.steel, 1, Math.cos(-1.1) * 16, Math.cos(1.1) * 16, Math.sin(-1.1) * 16, Math.sin(1.1) * 16);
      break;
    case 'grenades':
      ctx.fillStyle = p.bomb;
      ctx.beginPath();
      ctx.arc(10, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.spark;
      ctx.fillRect(8, -11, 4, 4);
      break;
    case 'knives':
      line(p.steel, 3, 0, 14);
      break;
    case 'boomerang':
      drawBoomerang(ctx, 12, 0, 0, 1, p);
      break;
    case 'chicken':
      // A floppy yellow bird held by the neck.
      ctx.fillStyle = p.chicken;
      ctx.beginPath();
      ctx.ellipse(28, 0, 14, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      line(p.chicken, 4, 0, 16, 0, 2);
      ctx.fillStyle = p.hpLow;
      ctx.fillRect(40, -3, 5, 4);
      break;
    case 'baguette':
      ctx.fillStyle = p.bread;
      roundRect(ctx, 0, -5, 62, 10, 5);
      ctx.fill();
      line(p.wood, 1.5, 14, 20, -3, 3);
      line(p.wood, 1.5, 30, 36, -3, 3);
      line(p.wood, 1.5, 46, 52, -3, 3);
      break;
    case 'banana':
      ctx.strokeStyle = p.banana;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(10, 10, 12, -Math.PI * 0.9, -Math.PI * 0.2);
      ctx.stroke();
      break;
    case 'bubbles':
      ctx.fillStyle = p.chicken;
      roundRect(ctx, 0, -5, 20, 9, 4);
      ctx.fill();
      ctx.strokeStyle = p.bubble;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(26, -2, 5, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'blower':
      ctx.fillStyle = p.hpGood;
      roundRect(ctx, -8, -8, 22, 16, 5);
      ctx.fill();
      ctx.fillStyle = p.gun;
      roundRect(ctx, 12, -3, 26, 6, 2);
      ctx.fill();
      break;
    case 'frost':
      line(p.wood, 3, -10, 44);
      ctx.shadowColor = p.frost;
      ctx.shadowBlur = 10;
      ctx.fillStyle = p.frost;
      ctx.beginPath();
      ctx.arc(46, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  ctx.restore();
}

/** A boomerang: a bent bar, turned to an angle. */
function drawBoomerang(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale: number, p: Palette) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.strokeStyle = p.wood;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-9, -9);
  ctx.lineTo(0, 0);
  ctx.lineTo(-9, 9);
  ctx.stroke();
  ctx.restore();
}

/** Where the hand points: resting, winding up, or out along the aim. */
function handAim(f: FighterState): [number, number] {
  const a = attackOf(f);
  if (!a || f.move === 2) return [f.facing, 0.25];
  const [ax, ay] = aimVector(f.aimX, f.aimY);
  if (a.kind === 'shot') return [ax, ay];
  if (f.moveFrame <= a.startup) return [-ax - f.facing * 300, -ay - 600];
  const out = a.startup + a.active;
  if (f.moveFrame <= out) return [ax, ay];
  const t = (f.moveFrame - out) / Math.max(1, attackFrames(a) - out);
  return [ax * (1 - t) + f.facing * 1000 * t, ay * (1 - t) + 250 * t];
}

function limb(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

/** A stick figure: head, spine, arms and legs in the fighter's colour, posed by what they're doing. */
function drawFighter(ctx: CanvasRenderingContext2D, m: Match, seat: number, p: Palette, local: number) {
  const f = m.fighters[seat];
  if (!f.alive && f.deadFor > 90) return;
  const x = f.x / SUB;
  const y = f.y / SUB;
  // Your own fighter is always the first colour, gold.
  const colour = p.seats[(seat - local + m.fighters.length) % m.fighters.length];
  const move = attackOf(f);

  ctx.save();
  if (!f.alive) {
    // Down: tipping over and fading.
    ctx.globalAlpha = Math.max(0, 1 - f.deadFor / 90);
    ctx.translate(x, y);
    ctx.rotate(-f.facing * Math.min(Math.PI / 2, f.deadFor * 0.12));
    ctx.translate(-x, -y);
  } else if (f.dodge > 0) ctx.globalAlpha = 0.45;
  else if (f.invulnerable > 0 && Math.floor(m.frame / 4) % 2 === 0) ctx.globalAlpha = 0.55;

  // The swing: a soft sweep where the hitbox is, while it's out.
  if (f.alive && isActive(f, move)) {
    const box = hitbox(f, move);
    ctx.save();
    ctx.fillStyle = colour;
    ctx.globalAlpha *= f.move === 2 ? 0.3 : 0.2;
    roundRect(ctx, box.left / SUB, box.top / SUB, (box.right - box.left) / SUB, (box.bottom - box.top) / SUB, 14);
    ctx.fill();
    ctx.restore();
  }

  // A heavy being charged: a ring that closes as it builds, and a glow that grows, pulsing when full.
  if (f.charge > 0) {
    const t = Math.min(1, (f.charge - 1) / MAX_CHARGE);
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.lineWidth = t >= 1 ? 4 : 3;
    ctx.globalAlpha = t >= 1 ? 0.6 + 0.4 * Math.sin(m.frame / 3) : 0.85;
    ctx.beginPath();
    ctx.arc(x, y - BODY_H / 2, 38, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.shadowColor = colour;
    ctx.shadowBlur = 6 + t * 26;
  }

  const hurt = f.hitstun > 0 && f.freeze > 0;
  ctx.strokeStyle = hurt ? p.flash : colour;
  ctx.fillStyle = hurt ? p.flash : colour;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const neck = y - 48;
  const hip = y - 24;
  const face = f.facing;
  // Legs: a running stride, tucked in the air, one kicked out along the aim when kicking.
  const grounded = f.platform >= 0;
  const stride = grounded && Math.abs(f.vx) > 100 ? Math.sin(m.frame / 4) * 10 : 0;
  const kicking = f.move === 2 && move?.kind === 'melee' && f.moveFrame > move.startup && f.moveFrame <= move.startup + move.active + 4;
  if (kicking) {
    const [kx, ky] = aimVector(f.aimX, f.aimY);
    limb(ctx, x, hip, x + (kx / 1000) * 30, hip + (ky / 1000) * 30 - 4);
    limb(ctx, x, hip, x - face * 8, y);
  } else if (!grounded && f.alive) {
    limb(ctx, x, hip, x + face * 8, hip + 13);
    limb(ctx, x + face * 8, hip + 13, x - face * 2, y - 4);
    limb(ctx, x, hip, x - face * 10, y - 6);
  } else {
    limb(ctx, x, hip, x + stride, y);
    limb(ctx, x, hip, x - stride, y);
  }
  // Spine and head.
  limb(ctx, x, hip, x, neck);
  ctx.beginPath();
  ctx.arc(x, neck - 10, 9, 0, Math.PI * 2);
  ctx.fill();

  // Arms: the front one holds the weapon out, the back one swings.
  const [hx, hy] = handAim(f);
  const hl = Math.hypot(hx, hy) || 1;
  const shoulder = neck + 4;
  const handX = x + (hx / hl) * 20;
  const handY = shoulder + (hy / hl) * 20;
  limb(ctx, x, shoulder, handX, handY);
  limb(ctx, x, shoulder, x - face * 10 - stride * 0.4, shoulder + 16);
  ctx.shadowBlur = 0;
  if (f.alive) drawWeapon(ctx, f.weapon, handX, handY, hx, hy, p);

  // A flash at the muzzle as a gun fires.
  if (f.alive && f.move === 1 && move?.kind === 'shot' && f.moveFrame > move.startup && f.moveFrame <= move.startup + 3) {
    ctx.fillStyle = p.spark;
    ctx.beginPath();
    ctx.arc(handX + (hx / hl) * 34, handY + (hy / hl) * 34, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // HP over the head.
  if (f.alive) {
    const w = 34;
    const left = x - w / 2;
    const top = y - BODY_H - 18;
    const share = f.hp / MAX_HP;
    ctx.fillStyle = p.hpBack;
    roundRect(ctx, left, top, w, 4, 2);
    ctx.fill();
    ctx.fillStyle = share > 0.5 ? p.hpGood : share > 0.25 ? p.hpMid : p.hpLow;
    roundRect(ctx, left, top, Math.max(2, w * share), 4, 2);
    ctx.fill();
  }
}

/** A weapon waiting on the ground: bobbing, glowing, blinking as it's about to fade. */
function drawItem(ctx: CanvasRenderingContext2D, it: Item, p: Palette) {
  const x = it.x / SUB;
  const y = it.y / SUB - 18 + Math.sin(it.age / 12) * 3;
  ctx.save();
  if (it.age > ITEM_LIFE - 120 && Math.floor(it.age / 6) % 2 === 0) ctx.globalAlpha = 0.35;
  // It drops in from above.
  const fall = Math.max(0, 20 - it.age) * 6;
  const glow = ctx.createRadialGradient(x, y - fall, 2, x, y - fall, 28);
  glow.addColorStop(0, p.itemGlow);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 30, y - fall - 30, 60, 60);
  drawWeapon(ctx, it.weapon, x - 16, y - fall, 1, -0.35, p);
  ctx.restore();
}

function drawProjectile(ctx: CanvasRenderingContext2D, pr: Projectile, p: Palette) {
  const x = pr.x / SUB;
  const y = pr.y / SUB;
  const speed = Math.hypot(pr.vx, pr.vy) || 1;
  const ux = pr.vx / speed;
  const uy = pr.vy / speed;
  switch (pr.kind) {
    case 'bullet':
    case 'slug':
    case 'pellet': {
      // A tracer: a streak behind the shot.
      const long = pr.kind === 'slug' ? 90 : pr.kind === 'bullet' ? 40 : 18;
      ctx.save();
      ctx.strokeStyle = p.spark;
      ctx.lineWidth = pr.kind === 'slug' ? 3 : 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - ux * long, y - uy * long);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'rocket':
      ctx.save();
      along(ctx, x, y, ux, uy);
      ctx.fillStyle = p.gun;
      roundRect(ctx, -14, -5, 22, 10, 4);
      ctx.fill();
      ctx.fillStyle = p.spark;
      ctx.beginPath();
      ctx.arc(-18 - Math.sin(pr.age) * 3, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    case 'arrow':
    case 'knife': {
      const long = pr.kind === 'arrow' ? 24 : 12;
      ctx.save();
      ctx.strokeStyle = p.steel;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - ux * long, y - uy * long);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'boomerang':
      drawBoomerang(ctx, x, y, pr.age * 0.6, 1.2, p);
      return;
    case 'frost':
      ctx.save();
      ctx.shadowColor = p.frost;
      ctx.shadowBlur = 14;
      ctx.fillStyle = p.frost;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    case 'grenade':
      ctx.fillStyle = p.bomb;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      // The fuse flickers faster as it burns down.
      if (Math.floor(pr.age / Math.max(2, Math.trunc(pr.life / 8))) % 2 === 0) {
        ctx.fillStyle = p.spark;
        ctx.beginPath();
        ctx.arc(x + 4, y - 7, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    case 'peel':
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = p.banana;
      ctx.beginPath();
      ctx.ellipse(0, -3, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-12, -3, 6, 3);
      ctx.fillRect(6, -3, 6, 3);
      ctx.restore();
      return;
    case 'bubble':
      ctx.save();
      ctx.strokeStyle = p.bubble;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(x, y, 13 + Math.sin(pr.age / 5) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = p.bubble;
      ctx.beginPath();
      ctx.arc(x - 5, y - 5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    case 'puff':
      ctx.save();
      ctx.globalAlpha = 0.35 * (1 - pr.age / 10);
      ctx.fillStyle = p.wind;
      ctx.beginPath();
      ctx.arc(x, y, 10 + pr.age * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    case 'thrown':
      // A thrown weapon tumbles end over end.
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(pr.age * 0.35);
      if (pr.weapon) drawWeapon(ctx, pr.weapon, -16, 0, 1, 0, p);
      ctx.restore();
      return;
  }
}

/** An ice floor: clear blue, fading as it melts. */
function drawIce(ctx: CanvasRenderingContext2D, ice: Ice, p: Palette) {
  const x = ice.x / SUB;
  const y = ice.y / SUB;
  ctx.save();
  ctx.globalAlpha = Math.min(1, ice.life / 30);
  roundRect(ctx, x - ICE_HALF, y, ICE_HALF * 2, 9, 4);
  ctx.fillStyle = p.ice;
  ctx.fill();
  ctx.fillStyle = p.iceEdge;
  ctx.fillRect(x - ICE_HALF + 4, y, ICE_HALF * 2 - 8, 2);
  ctx.restore();
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
  ctx.arc(b.x, b.y, 20 + t * 90, 0, Math.PI * 2);
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

  // A gold glow over the middle of the stage, behind everything.
  const glow = ctx.createRadialGradient(0, -120, 20, 0, -120, 520);
  glow.addColorStop(0, p.glow);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(-760, -760, 1520, 1240);

  drawStage(ctx, m, p);
  for (const ice of m.ice) drawIce(ctx, ice, p);
  for (const it of m.items) drawItem(ctx, it, p);
  // You on top, so your own fighter is never lost in a crowd.
  const n = m.fighters.length;
  for (let k = n - 1; k >= 0; k--) drawFighter(ctx, m, (local + k) % n, p, local);
  for (const pr of m.projectiles) drawProjectile(ctx, pr, p);
  for (const b of m.blasts) drawBlast(ctx, b, p);
  for (const b of bursts) drawBurst(ctx, b, p.seats[(b.seat - local + n) % n]);
  drawWind(ctx, m, cam, p, width, height);
}
