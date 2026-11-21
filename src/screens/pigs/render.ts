import { ANCHOR_X, ANCHOR_Y, GAME_TICKS, H, loopAt, PEN_BOTTOM, PEN_TOP, PIG_SPEC, TICKS_PER_SECOND, W, type Pig, type PigState } from '../../games/pigs/sim';

// Draws Pig Lasso's pen in flat shapes: grass, two fences, each farmer and their rope, the
// pigs, the clock and both scores. The pen is the same on both phones, but each phone turns
// it so its own farmer stands at the bottom. Every colour comes from a --pigs-* token.

const TOKENS = ['grass', 'grass-mark', 'mud', 'fence', 'farmer', 'rope', 'pink', 'pink-dark', 'black', 'black-dark', 'ink', 'text', 'gain', 'loss', 'clock', 'clock-low', 'panel'] as const;

export type Palette = Record<(typeof TOKENS)[number], string>;

export function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(TOKENS.map((t) => [t, style.getPropertyValue(`--pigs-${t}`).trim() || '#888'])) as Palette;
}

export interface View {
  /** The seat at the bottom of this screen. */
  me: number;
  names: [string, string];
  /** Server ms until the pen opens, while counting down; else null. */
  countdown: number | null;
}

export function draw(ctx: CanvasRenderingContext2D, s: PigState, c: Palette, view: View) {
  const flip = view.me === 1;
  const X = (x: number) => (flip ? W - x : x);
  const Y = (y: number) => (flip ? H - y : y);

  // Grass, with a few muddy patches (the same either way up). The whole canvas first, in
  // case the screen's shape leaves a margin round the pen; then nothing draws outside it.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = c.grass;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  ctx.fillStyle = c.mud;
  for (const [x, y, rx, ry] of [
    [90, 210, 50, 22],
    [270, 350, 50, 22],
    [250, 190, 28, 12],
    [110, 370, 28, 12],
  ])
    ellipse(ctx, x, y, rx, ry);
  ctx.fillStyle = c['grass-mark'];
  for (let i = 0; i < 26; i++) {
    const x = (i * 97) % W;
    const y = PEN_TOP + ((i * 151) % (PEN_BOTTOM - PEN_TOP));
    ctx.fillRect(x, y, 2, 6);
    ctx.fillRect(x + 4, y + 2, 2, 5);
  }

  // The fences, each farmer behind theirs.
  for (const y of [PEN_TOP - 16, PEN_BOTTOM + 16]) fence(ctx, y, c);
  for (const seat of [0, 1]) farmer(ctx, X(ANCHOR_X), Y(ANCHOR_Y[seat]), Y(ANCHOR_Y[seat]) > H / 2, c);

  // Free pigs, then the ropes and the pigs on them.
  for (const pig of s.pigs) if (pig.held < 0) drawPig(ctx, pig, X(pig.x), Y(pig.y), flip ? -pig.vx : pig.vx, s.tick, c);
  for (const seat of [0, 1]) {
    const [lx, ly] = loopAt(s, seat);
    const ax = X(ANCHOR_X);
    const ay = Y(ANCHOR_Y[seat]) + (Y(ANCHOR_Y[seat]) > H / 2 ? -14 : 14);
    ctx.strokeStyle = c.rope;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(X(lx), Y(ly));
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(X(lx), Y(ly), 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const pig of s.pigs) if (pig.held >= 0) drawPig(ctx, pig, X(pig.x), Y(pig.y), 0, 0, c);

  // Points won or lost float up from the farmer for a second.
  ctx.textAlign = 'center';
  ctx.font = '700 22px system-ui, sans-serif';
  for (const got of s.catches) {
    const age = s.tick - got.tick;
    if (age > TICKS_PER_SECOND) continue;
    const bottom = got.seat === view.me;
    const rise = (age / TICKS_PER_SECOND) * 36;
    ctx.globalAlpha = 1 - age / TICKS_PER_SECOND;
    ctx.fillStyle = got.points > 0 ? c.gain : c.loss;
    ctx.fillText(got.points > 0 ? `+${got.points}` : `−${-got.points}`, W / 2 - 80, bottom ? H - 30 - rise : 46 + rise);
  }
  ctx.globalAlpha = 1;

  // Scores: theirs along the top, yours along the bottom, and the clock in the middle.
  const them = 1 - view.me;
  scoreTag(ctx, 8, view.names[them], s.scores[them], c);
  scoreTag(ctx, H - 36, 'You', s.scores[view.me], c);
  const left = Math.max(0, Math.ceil((GAME_TICKS - s.tick) / TICKS_PER_SECOND));
  ctx.fillStyle = c.panel;
  roundRect(ctx, W - 74, H / 2 - 18, 66, 36, 18);
  ctx.fillStyle = left <= 10 ? c['clock-low'] : c.clock;
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, W - 41, H / 2 + 1);

  if (view.countdown !== null) {
    ctx.fillStyle = c.panel;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.text;
    ctx.font = '800 56px system-ui, sans-serif';
    ctx.fillText(String(Math.max(1, Math.ceil(view.countdown / 1000))), W / 2, H / 2 + 3);
  }
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

/** A name and score in the corner on the right, clear of the farmer on the left of the rope. */
function scoreTag(ctx: CanvasRenderingContext2D, y: number, name: string, score: number, c: Palette) {
  ctx.font = '600 15px system-ui, sans-serif';
  const label = `${name.slice(0, 12)}  ${score}`;
  const w = ctx.measureText(label).width + 22;
  const x = W - 8 - w;
  ctx.fillStyle = c.panel;
  roundRect(ctx, x, y, w, 28, 14);
  ctx.fillStyle = c.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 11, y + 15);
  ctx.textBaseline = 'alphabetic';
}

function fence(ctx: CanvasRenderingContext2D, y: number, c: Palette) {
  ctx.fillStyle = c.fence;
  ctx.fillRect(0, y - 6, W, 4);
  ctx.fillRect(0, y + 3, W, 4);
  for (let x = 6; x < W; x += 30) ctx.fillRect(x, y - 11, 5, 22);
}

/** A stick farmer with a hat; `bottom` says which way they face (towards the pen). */
function farmer(ctx: CanvasRenderingContext2D, x: number, y: number, bottom: boolean, c: Palette) {
  const d = bottom ? 1 : -1;
  ctx.strokeStyle = c.farmer;
  ctx.fillStyle = c.farmer;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const head = y + 12 * d;
  ctx.beginPath();
  ctx.arc(x - 26, head, 7, 0, Math.PI * 2);
  ctx.stroke();
  // Hat brim and crown.
  ctx.fillRect(x - 37, head - 8 * d - 1.5, 22, 3);
  ctx.fillRect(x - 31, head - 8 * d - (bottom ? 8 : -5), 10, 6);
  ctx.beginPath();
  ctx.moveTo(x - 26, head + 7 * d);
  ctx.lineTo(x - 26, head + 22 * d);
  // An arm up to the rope.
  ctx.moveTo(x - 26, head + 11 * d);
  ctx.lineTo(x, y - 14 * d);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawPig(ctx: CanvasRenderingContext2D, pig: Pig, x: number, y: number, vx: number, tick: number, c: Palette) {
  const r = PIG_SPEC[pig.kind].radius;
  const black = pig.kind === 'black';
  const face = vx < 0 ? -1 : 1;
  const body = black ? c.black : c.pink;
  const dark = black ? c['black-dark'] : c['pink-dark'];
  // Legs trot while it walks.
  const step = vx === 0 ? 0 : Math.round(tick / (black ? 4 : 8)) % 2 ? 2 : -2;
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(3, r / 5);
  ctx.beginPath();
  for (const [lx, sway] of [
    [-0.6, step],
    [-0.25, -step],
    [0.3, step],
    [0.6, -step],
  ]) {
    ctx.moveTo(x + lx * r * face, y + r * 0.5);
    ctx.lineTo(x + lx * r * face + sway, y + r * 0.95);
  }
  ctx.stroke();
  // Tail: a little curl at the back.
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x - r * 1.25 * face, y - r * 0.3, r * 0.18, 0, Math.PI * 1.6);
  ctx.stroke();
  // Body and head.
  ctx.fillStyle = body;
  ellipse(ctx, x, y, r * 1.2, r * 0.78);
  ctx.beginPath();
  ctx.arc(x + r * 1.05 * face, y - r * 0.2, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  // Ear.
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(x + r * 0.85 * face, y - r * 0.6);
  ctx.lineTo(x + r * 1.0 * face, y - r * 1.05);
  ctx.lineTo(x + r * 1.2 * face, y - r * 0.62);
  ctx.fill();
  // Snout and eye.
  ellipse(ctx, x + r * 1.55 * face, y - r * 0.12, r * 0.2, r * 0.26);
  ctx.fillStyle = black ? c.pink : c.ink;
  ctx.beginPath();
  ctx.arc(x + r * 1.15 * face, y - r * 0.38, Math.max(1.6, r * 0.09), 0, Math.PI * 2);
  ctx.fill();
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
