import { COLS, COOK_TICKS, CHOP_TICKS, GAME_TICKS, ROWS, TICKS_PER_SECOND, UNIT, isCooked, tileAt, type Item, type KitchenState } from '../../games/kitchen/sim';

// Draws Short Order's kitchen in flat shapes: the orders and the clock along the top, then
// the 7 × 9 tiles (floor, counters, crates, boards, stoves with their pots, plates, the
// hatch and the bin), what's set down on them, and the chefs with what they carry.
// Every colour comes from a --kitchen-* token.

/** A tile is 50 units; the orders strip above the kitchen is HUD units tall. */
export const TILE = 50;
export const HUD = 78;
export const W = COLS * TILE;
export const H = HUD + ROWS * TILE;

const TOKENS = [
  'floor',
  'floor-2',
  'counter',
  'counter-edge',
  'board',
  'stove',
  'pot',
  'plate',
  'plate-edge',
  'hatch',
  'bin',
  'tomato',
  'onion',
  'mushroom',
  'chef-1',
  'chef-2',
  'chef-3',
  'chef-4',
  'hat',
  'ink',
  'panel',
  'good',
  'warn',
  'late',
  'tap',
] as const;

export type Palette = Record<(typeof TOKENS)[number], string>;

export function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(TOKENS.map((t) => [t, style.getPropertyValue(`--kitchen-${t}`).trim() || '#888'])) as Palette;
}

export interface View {
  /** This phone's seat. */
  me: number;
  /** Server ms until the kitchen opens, while counting down; else null. */
  countdown: number | null;
  /** Tiles this phone has tapped that haven't taken effect yet. */
  taps: [number, number][];
}

const ingredientColour = (c: Palette, letter: string) => (letter.toUpperCase() === 'T' ? c.tomato : letter.toUpperCase() === 'O' ? c.onion : c.mushroom);

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  // By hand: ctx.roundRect is missing on older phones.
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

/** A bar from 0 to 1, under a tile or an order. */
function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, part: number, colour: string, c: Palette) {
  ctx.fillStyle = c.panel;
  rounded(ctx, x, y, w, 6, 3);
  ctx.fill();
  ctx.fillStyle = colour;
  rounded(ctx, x, y, Math.max(6, w * Math.min(1, part)), 6, 3);
  ctx.fill();
}

/** An item at a spot: an ingredient (whole, or chopped in three), a plate, a plate of soup. */
export function drawItem(ctx: CanvasRenderingContext2D, item: Item, x: number, y: number, size: number, c: Palette) {
  if (item.startsWith('P')) {
    ctx.fillStyle = c.plate;
    circle(ctx, x, y, size);
    ctx.fill();
    ctx.strokeStyle = c['plate-edge'];
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (item.length > 2) soup(ctx, item.slice(2), x, y, size * 0.72, c);
    return;
  }
  const colour = ingredientColour(c, item);
  ctx.fillStyle = colour;
  if (item === item.toUpperCase()) {
    circle(ctx, x, y, size * 0.8);
    ctx.fill();
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    for (const [dx, dy] of [
      [-0.45, 0.25],
      [0.45, 0.25],
      [0, -0.4],
    ]) {
      circle(ctx, x + dx * size, y + dy * size, size * 0.42);
      ctx.fill();
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

/** A soup's three ingredients as wedges of colour in a bowl. */
function soup(ctx: CanvasRenderingContext2D, letters: string, x: number, y: number, r: number, c: Palette) {
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
    ctx.fillStyle = ingredientColour(c, letters[i] ?? letters[0]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, a, a + (Math.PI * 2) / 3);
    ctx.closePath();
    ctx.fill();
  }
}

function drawTile(ctx: CanvasRenderingContext2D, s: KitchenState, x: number, y: number, c: Palette) {
  const tile = tileAt(s.kitchen, x, y);
  const px = x * TILE;
  const py = HUD + y * TILE;
  const cx = px + TILE / 2;
  const cy = py + TILE / 2;
  const i = y * COLS + x;
  if (tile === '.' || (tile >= '1' && tile <= '9')) {
    ctx.fillStyle = (x + y) % 2 ? c.floor : c['floor-2'];
    ctx.fillRect(px, py, TILE, TILE);
    return;
  }
  ctx.fillStyle = c['counter-edge'];
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = c.counter;
  ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
  switch (tile) {
    case 'T':
    case 'O':
    case 'M':
      ctx.fillStyle = c.board;
      rounded(ctx, px + 7, py + 7, TILE - 14, TILE - 14, 6);
      ctx.fill();
      drawItem(ctx, tile, cx - 7, cy + 2, 9, c);
      drawItem(ctx, tile, cx + 7, cy + 4, 9, c);
      drawItem(ctx, tile, cx, cy - 6, 9, c);
      break;
    case 'B':
      ctx.fillStyle = c.board;
      rounded(ctx, px + 6, py + 9, TILE - 12, TILE - 18, 5);
      ctx.fill();
      if (s.chopped[i] > 0) bar(ctx, px + 8, py + TILE - 9, TILE - 16, s.chopped[i] / CHOP_TICKS, c.good, c);
      break;
    case 'S': {
      ctx.fillStyle = c.stove;
      rounded(ctx, px + 4, py + 4, TILE - 8, TILE - 8, 6);
      ctx.fill();
      ctx.fillStyle = c.pot;
      circle(ctx, cx, cy, 16);
      ctx.fill();
      const pot = s.pots[i];
      if (pot.length === 3) soup(ctx, pot, cx, cy, 12, c);
      else for (let k = 0; k < pot.length; k++) drawItem(ctx, pot[k].toLowerCase(), cx - 7 + k * 7, cy, 5, c);
      if (pot.length === 3) {
        if (isCooked(s, i)) {
          ctx.strokeStyle = c.good;
          ctx.lineWidth = 4;
          circle(ctx, cx, cy, 18);
          ctx.stroke();
        } else bar(ctx, px + 8, py + TILE - 9, TILE - 16, s.cooked[i] / COOK_TICKS, c.warn, c);
      }
      break;
    }
    case 'P':
      for (let k = 0; k < 3; k++) drawItem(ctx, 'P', cx, cy + 4 - k * 4, 15, c);
      break;
    case 'H':
      ctx.fillStyle = c.hatch;
      rounded(ctx, px + 4, py + 4, TILE - 8, TILE - 8, 6);
      ctx.fill();
      ctx.fillStyle = c.plate;
      ctx.beginPath();
      ctx.moveTo(cx, py + 12);
      ctx.lineTo(cx + 10, cy + 2);
      ctx.lineTo(cx + 4, cy + 2);
      ctx.lineTo(cx + 4, py + TILE - 12);
      ctx.lineTo(cx - 4, py + TILE - 12);
      ctx.lineTo(cx - 4, cy + 2);
      ctx.lineTo(cx - 10, cy + 2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'X':
      ctx.fillStyle = c.bin;
      circle(ctx, cx, cy, 16);
      ctx.fill();
      ctx.fillStyle = c.counter;
      circle(ctx, cx, cy, 10);
      ctx.fill();
      break;
  }
  const item = s.items[i];
  if (item) drawItem(ctx, item, cx, cy, 12, c);
}

function drawHud(ctx: CanvasRenderingContext2D, s: KitchenState, c: Palette) {
  ctx.fillStyle = c.panel;
  ctx.fillRect(0, 0, W, HUD);
  const left = Math.max(0, Math.ceil((GAME_TICKS - s.tick) / TICKS_PER_SECOND));
  ctx.fillStyle = left <= 20 ? c.late : c.ink;
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, 8, 12);
  ctx.textAlign = 'right';
  ctx.fillStyle = c.ink;
  ctx.fillText(`${s.score} points`, W - 8, 12);

  // The orders, oldest first: each its soup and how much patience is left.
  const cardW = (W - 8 * 5) / 4;
  s.orders.forEach((order, k) => {
    const x = 8 + k * (cardW + 8);
    const y = 26;
    ctx.fillStyle = c.plate;
    rounded(ctx, x, y, cardW, 46, 8);
    ctx.fill();
    ctx.strokeStyle = c['plate-edge'];
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let j = 0; j < 3; j++) drawItem(ctx, order.soup[j], x + cardW / 2 - 18 + j * 18, y + 16, 8, c);
    const part = (order.until - s.tick) / (order.until - order.born);
    bar(ctx, x + 6, y + 34, cardW - 12, part, part > 0.5 ? c.good : part > 0.25 ? c.warn : c.late, c);
  });
}

function drawChef(ctx: CanvasRenderingContext2D, s: KitchenState, seat: number, me: number, c: Palette) {
  const chef = s.chefs[seat];
  const x = (chef.x / UNIT) * TILE + TILE / 2;
  const y = HUD + (chef.y / UNIT) * TILE + TILE / 2;
  const colour = c[`chef-${seat + 1}` as 'chef-1'];
  if (seat === me) {
    ctx.fillStyle = c.tap;
    circle(ctx, x, y + 4, 20);
    ctx.fill();
  }
  ctx.fillStyle = colour;
  circle(ctx, x, y + 4, 15);
  ctx.fill();
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  // The hat.
  ctx.fillStyle = c.hat;
  rounded(ctx, x - 9, y - 16, 18, 12, 5);
  ctx.fill();
  ctx.stroke();
  if (chef.chop >= 0) {
    // Chopping: a knife going up and down.
    const up = Math.floor(s.tick / 8) % 2;
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + chef.face[0] * 14, y + chef.face[1] * 14 - up * 6);
    ctx.lineTo(x + chef.face[0] * 24, y + chef.face[1] * 24 - up * 6);
    ctx.stroke();
  }
  if (chef.hand) drawItem(ctx, chef.hand, x + chef.face[0] * 17, y + 6 + chef.face[1] * 14, chef.hand.startsWith('P') ? 12 : 9, c);
}

export function draw(ctx: CanvasRenderingContext2D, s: KitchenState, c: Palette, view: View) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = c['counter-edge'];
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();

  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) drawTile(ctx, s, x, y, c);
  ctx.strokeStyle = c.tap;
  ctx.lineWidth = 3;
  for (const [x, y] of view.taps) {
    rounded(ctx, x * TILE + 3, HUD + y * TILE + 3, TILE - 6, TILE - 6, 8);
    ctx.stroke();
  }
  // Others first, so your own chef is always on top.
  for (let seat = 0; seat < s.chefs.length; seat++) if (seat !== view.me) drawChef(ctx, s, seat, view.me, c);
  if (view.me >= 0 && view.me < s.chefs.length) drawChef(ctx, s, view.me, view.me, c);
  drawHud(ctx, s, c);

  if (view.countdown !== null) {
    ctx.fillStyle = c.panel;
    rounded(ctx, W / 2 - 60, H / 2 - 40, 120, 80, 16);
    ctx.fill();
    ctx.fillStyle = c.ink;
    ctx.font = '800 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(Math.max(1, Math.ceil(view.countdown / 1000))), W / 2, H / 2 + 2);
  }
}
