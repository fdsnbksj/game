import { H, W, type Enemy, type SkyState } from '../../games/sky/sim';

// Draws a Sky Ace world on a canvas in flat shapes: the ground scrolling under, things on
// the ground, pickups, planes, shots, bullets, blasts, then the score along the top. Every
// colour comes from a --sky-* token in :root.

const TOKENS = [
  'ground-0', 'ground-0-mark', 'ground-1', 'ground-1-mark', 'ground-2', 'ground-2-mark',
  'ship', 'ship-wing', 'flame', 'vulcan', 'laser', 'missile',
  'enemy', 'enemy-dark', 'tank', 'turret', 'boss', 'boss-part', 'shield',
  'bullet', 'bullet-core', 'blast', 'blast-core', 'flash',
  'item-red', 'item-blue', 'item-missile', 'item-bomb', 'medal', 'text', 'text-shade', 'warn',
] as const;

export type Palette = Record<(typeof TOKENS)[number], string>;

export function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(TOKENS.map((t) => [t, style.getPropertyValue(`--sky-${t}`).trim() || '#888'])) as Palette;
}

/** A steady pseudo-random number per ground row, so buildings stay put as they scroll. */
function hash(n: number) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function ground(ctx: CanvasRenderingContext2D, s: SkyState, c: Palette, view: View) {
  const look = s.stage % 3;
  const base = [c['ground-0'], c['ground-1'], c['ground-2']][look];
  const mark = [c['ground-0-mark'], c['ground-1-mark'], c['ground-2-mark']][look];
  ctx.fillStyle = base;
  ctx.fillRect(0, view.top, W, view.bottom - view.top);
  const row = 80;
  const scroll = s.clock;
  const first = Math.floor((scroll + H - view.bottom) / row) - 1;
  ctx.fillStyle = mark;
  for (let i = first; i < first + (view.bottom - view.top) / row + 2; i++) {
    // Row i sits i rows along the course; the course slides down the screen.
    const top = H - row - (i * row - scroll);
    if (look === 0) {
      // A city: a road down the middle, blocks either side.
      ctx.fillRect(W / 2 - 30, top, 4, row);
      ctx.fillRect(W / 2 + 26, top, 4, row);
      for (let k = 0; k < 4; k++) {
        const r = hash(i * 7 + k);
        if (r < 0.35) continue;
        const x = k < 2 ? 12 + k * 64 + r * 10 : W / 2 + 46 + (k - 2) * 64 + r * 10;
        ctx.globalAlpha = 0.5 + r * 0.5;
        ctx.fillRect(x, top + 10, 44, 54 * r + 10);
      }
      ctx.globalAlpha = 1;
    } else if (look === 1) {
      // The sea: short wave marks.
      for (let k = 0; k < 6; k++) {
        const r = hash(i * 11 + k);
        ctx.globalAlpha = 0.4 + r * 0.4;
        ctx.fillRect(r * (W - 40), top + k * 13, 26 + r * 20, 2);
      }
      ctx.globalAlpha = 1;
    } else {
      // A base: deck plates and rivets.
      ctx.fillRect(0, top, W, 2);
      for (let k = 0; k < 3; k++) {
        const r = hash(i * 13 + k);
        ctx.globalAlpha = 0.35 + r * 0.4;
        ctx.fillRect(20 + k * 116, top + 16, 90, 48);
      }
      ctx.globalAlpha = 1;
    }
  }
}

function plane(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, body: string, wing: string, up: boolean) {
  const d = up ? -1 : 1;
  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.moveTo(x - r, y - d * r * 0.1);
  ctx.lineTo(x + r, y - d * r * 0.1);
  ctx.lineTo(x + r * 0.2, y - d * r * 0.5);
  ctx.lineTo(x - r * 0.2, y - d * r * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(x, y + d * r);
  ctx.lineTo(x + r * 0.28, y - d * r * 0.6);
  ctx.lineTo(x, y - d * r * 0.8);
  ctx.lineTo(x - r * 0.28, y - d * r * 0.6);
  ctx.closePath();
  ctx.fill();
}

function enemy(ctx: CanvasRenderingContext2D, e: Enemy, s: SkyState, c: Palette) {
  // A hit blinks, so a target under steady fire still shows its colour.
  const lit = e.flash > 0 && s.clock % 4 < 2;
  switch (e.kind) {
    case 'tank':
    case 'turret': {
      ctx.fillStyle = lit ? c.flash : e.kind === 'tank' ? c.tank : c.turret;
      if (e.kind === 'tank') ctx.fillRect(e.x - 11, e.y - 14, 22, 28);
      else {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // The barrel points at the ship.
      const dx = s.player.x - e.x;
      const dy = s.player.y - e.y;
      const len = Math.hypot(dx, dy) || 1;
      ctx.strokeStyle = c['enemy-dark'];
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + (dx / len) * 18, e.y + (dy / len) * 18);
      ctx.stroke();
      ctx.fillStyle = c['enemy-dark'];
      ctx.beginPath();
      ctx.arc(e.x, e.y, 6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'core': {
      const shielded = s.enemies.some((g) => g.anchor === e.id);
      ctx.fillStyle = lit && !shielded ? c.flash : c.boss;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y + e.r * 1.2);
      ctx.lineTo(e.x + e.r * 1.9, e.y - e.r * 0.2);
      ctx.lineTo(e.x + e.r * 1.2, e.y - e.r);
      ctx.lineTo(e.x - e.r * 1.2, e.y - e.r);
      ctx.lineTo(e.x - e.r * 1.9, e.y - e.r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = c['enemy-dark'];
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      if (shielded) {
        ctx.strokeStyle = c.shield;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.5 + (s.clock % 20) / 40;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 0.62, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'gun':
      ctx.fillStyle = lit ? c.flash : c['boss-part'];
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c['enemy-dark'];
      ctx.fillRect(e.x - 4, e.y, 8, e.r + 6);
      break;
    case 'gunship':
      plane(ctx, e.x, e.y, e.r, lit ? c.flash : c.enemy, c['enemy-dark'], false);
      ctx.fillStyle = c['enemy-dark'];
      ctx.fillRect(e.x - e.r * 0.7, e.y - 8, e.r * 1.4, 10);
      break;
    case 'carrier':
      ctx.fillStyle = lit ? c.flash : c['item-red'];
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, e.r, e.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c['enemy-dark'];
      ctx.fillRect(e.x - e.r - 6, e.y - 2, (e.r + 6) * 2, 4);
      break;
    default:
      plane(ctx, e.x, e.y, e.r, lit ? c.flash : c.enemy, c['enemy-dark'], false);
  }
}

const ITEM_LETTER = { red: 'V', blue: 'L', missile: 'M', bomb: 'B' } as const;

/** How much of the world the screen shows above and below the field (a tall phone shows more). */
export interface View {
  top: number;
  bottom: number;
}

export function draw(ctx: CanvasRenderingContext2D, s: SkyState, c: Palette, best: number, view: View) {
  ground(ctx, s, c, view);

  for (const e of s.enemies) if (e.ground) enemy(ctx, e, s, c);

  for (const item of s.items) {
    if (item.kind === 'medal') {
      ctx.fillStyle = c.medal;
      ctx.beginPath();
      ctx.arc(item.x, item.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c['enemy-dark'];
      ctx.fillRect(item.x - 1.5, item.y - 4, 3, 8);
      continue;
    }
    const colour = { red: c['item-red'], blue: c['item-blue'], missile: c['item-missile'], bomb: c['item-bomb'] }[item.kind];
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.roundRect(item.x - 12, item.y - 10, 24, 20, 6);
    ctx.fill();
    ctx.fillStyle = c.text;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ITEM_LETTER[item.kind], item.x, item.y + 1);
  }

  for (const e of s.enemies) if (!e.ground) enemy(ctx, e, s, c);

  // Our shots.
  for (const shot of s.shots) {
    if (shot.kind === 'laser') {
      ctx.fillStyle = c.laser;
      ctx.fillRect(shot.x - shot.r, shot.y - 14, shot.r * 2, 28);
    } else if (shot.kind === 'missile') {
      ctx.fillStyle = c.missile;
      ctx.fillRect(shot.x - 2, shot.y - 6, 4, 12);
    } else {
      ctx.fillStyle = c.vulcan;
      ctx.fillRect(shot.x - 2, shot.y - 7, 4, 14);
    }
  }

  // The ship: blinking while it can't be hit.
  const p = s.player;
  if (p.down === 0 && !(p.invuln > 0 && s.clock % 8 < 4)) {
    ctx.fillStyle = c.flame;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 18 + (s.clock % 4), 4, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    plane(ctx, p.x, p.y, 20, c.ship, c['ship-wing'], true);
  }

  // Their bullets: bright, with a pale core, so they read on any ground.
  for (const b of s.bullets) {
    ctx.fillStyle = c.bullet;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c['bullet-core'];
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const blast of s.blasts) {
    if (blast.age < 0) continue;
    const t = blast.age / 30;
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = c.blast;
    ctx.beginPath();
    ctx.arc(blast.x, blast.y, blast.size * (0.4 + t), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c['blast-core'];
    ctx.beginPath();
    ctx.arc(blast.x, blast.y, blast.size * (0.4 + t) * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (s.bomb > 0) {
    const t = 1 - s.bomb / 90;
    ctx.globalAlpha = (1 - t) * 0.5;
    ctx.fillStyle = c.flash;
    ctx.fillRect(0, view.top, W, view.bottom - view.top);
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = c.flash;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(p.x, p.y, t * H, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const popup of s.popups) {
    ctx.globalAlpha = 1 - popup.age / 60;
    const big = popup.text.startsWith('STAGE');
    shaded(ctx, popup.text, popup.x, popup.y - popup.age * (big ? 0 : 0.5), big ? 30 : 13, c);
    ctx.globalAlpha = 1;
  }

  if (s.phase === 'warning' && s.phaseTick % 40 < 28) {
    ctx.fillStyle = c.warn;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, H / 2 - 40, W, 80);
    ctx.globalAlpha = 1;
    shaded(ctx, 'WARNING', W / 2, H / 2 - 8, 34, c);
    shaded(ctx, 'A big one is coming', W / 2, H / 2 + 22, 13, c);
  }

  // The score along the very top of the screen.
  const y0 = view.top + 6;
  ctx.textAlign = 'left';
  shaded(ctx, `SCORE ${s.score}`, 10, y0 + 12, 14, c, 'left');
  ctx.textAlign = 'right';
  shaded(ctx, `BEST ${Math.max(best, s.score)}`, W - 10, y0 + 12, 14, c, 'right');
  ctx.textAlign = 'left';
  const ships = '▲'.repeat(Math.max(0, p.lives));
  shaded(ctx, ships, 10, y0 + 32, 13, c, 'left');
  ctx.textAlign = 'right';
  shaded(ctx, `MEDAL ${s.medal}`, W - 10, y0 + 32, 12, c, 'right');

  const boss = s.enemies.find((e) => e.kind === 'core');
  if (boss) {
    const parts = s.enemies.filter((g) => g.anchor === boss.id);
    const hp = parts.length ? parts.reduce((n, g) => n + g.hp, 0) / parts.reduce((n, g) => n + g.maxHp, 0) : boss.hp / boss.maxHp;
    ctx.fillStyle = c['text-shade'];
    ctx.fillRect(60, y0 + 46, W - 120, 6);
    ctx.fillStyle = parts.length ? c['boss-part'] : c.warn;
    ctx.fillRect(60, y0 + 46, (W - 120) * Math.max(0, hp), 6);
  }
}

function shaded(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, c: Palette, align: CanvasTextAlign = 'center') {
  ctx.textAlign = align;
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  ctx.fillStyle = c['text-shade'];
  ctx.fillText(text, x + 1.5, y + 1.5);
  ctx.fillStyle = c.text;
  ctx.fillText(text, x, y);
}
