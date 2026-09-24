// Every creature as a small vinyl toy: layered paths on a 48x48 grid, standing on the
// bottom edge. CreatureChip draws them as SVG and src/game/battle/textures.ts bakes the
// same parts onto a canvas, so the creature in the shop is exactly the one on the board.
// The renderers add the shared style (ink outline, shaded underside, one highlight), so
// each definition only says what goes where.

export const CREATURE_SIZE = 48;

export const INK = '#1d1f2b';
export const OUTLINE = 1.6;
/** The underside shade and the highlight, drawn inside a part. */
export const GLOSS = 'rgba(255, 255, 255, 0.45)';

type Box = [x0: number, y0: number, x1: number, y1: number];

export interface Part {
  d: string;
  box: Box;
  fill?: string;
  /** Drawn as a line of this colour and width instead of filled. */
  line?: { color: string; width: number };
  outline?: boolean;
  /** A darker underside, clipped to the part. */
  shade?: string;
  /** One soft highlight, clipped to the part. */
  gloss?: boolean;
  opacity?: number;
}

export interface CreatureArt {
  parts: readonly Part[];
  /** Where the top of the head is, for placing things above it. */
  top: number;
}

// ---------- Geometry ----------

const n = (v: number) => Math.round(v * 100) / 100;

/** The bounding box of absolute path data made of coordinate pairs only (M, L, Q, C, Z). */
function boxOf(d: string): Box {
  const values = d.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
  const box: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 1 < values.length; i += 2) {
    box[0] = Math.min(box[0], values[i]);
    box[1] = Math.min(box[1], values[i + 1]);
    box[2] = Math.max(box[2], values[i]);
    box[3] = Math.max(box[3], values[i + 1]);
  }
  return box;
}

interface Geom {
  d: string;
  box: Box;
}

const geom = (d: string): Geom => ({ d, box: boxOf(d) });

/** An ellipse as four cubic curves, so the path is coordinate pairs only. */
function ell(cx: number, cy: number, rx: number, ry: number): Geom {
  const k = 0.5523;
  const ox = rx * k;
  const oy = ry * k;
  return geom(
    `M${n(cx - rx)} ${n(cy)}C${n(cx - rx)} ${n(cy - oy)} ${n(cx - ox)} ${n(cy - ry)} ${n(cx)} ${n(cy - ry)}` +
      `C${n(cx + ox)} ${n(cy - ry)} ${n(cx + rx)} ${n(cy - oy)} ${n(cx + rx)} ${n(cy)}` +
      `C${n(cx + rx)} ${n(cy + oy)} ${n(cx + ox)} ${n(cy + ry)} ${n(cx)} ${n(cy + ry)}` +
      `C${n(cx - ox)} ${n(cy + ry)} ${n(cx - rx)} ${n(cy + oy)} ${n(cx - rx)} ${n(cy)}Z`,
  );
}

function rrect(x: number, y: number, w: number, h: number, r: number): Geom {
  return geom(
    `M${n(x + r)} ${n(y)}L${n(x + w - r)} ${n(y)}Q${n(x + w)} ${n(y)} ${n(x + w)} ${n(y + r)}` +
      `L${n(x + w)} ${n(y + h - r)}Q${n(x + w)} ${n(y + h)} ${n(x + w - r)} ${n(y + h)}` +
      `L${n(x + r)} ${n(y + h)}Q${n(x)} ${n(y + h)} ${n(x)} ${n(y + h - r)}` +
      `L${n(x)} ${n(y + r)}Q${n(x)} ${n(y)} ${n(x + r)} ${n(y)}Z`,
  );
}

type Pt = [number, number];

/** A straight-edged closed shape. */
const poly = (...pts: Pt[]): Geom => geom(`M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z`);

/** A smooth closed shape through the points (a closed Catmull-Rom curve). */
function blob(...pts: Pt[]): Geom {
  const count = pts.length;
  let d = `M${n(pts[0][0])} ${n(pts[0][1])}`;
  for (let i = 0; i < count; i++) {
    const p0 = pts[(i - 1 + count) % count];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % count];
    const p3 = pts[(i + 2) % count];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p2[0])} ${n(p2[1])}`;
  }
  return geom(`${d}Z`);
}

/** Mirrors points across the creature's centre line. */
const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [CREATURE_SIZE - x, y]);

// ---------- Colour ----------

function mix(a: string, b: string, t: number) {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const channel = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`;
}

/** The underside of a colour: darker, and a little cooler, as on a lit toy. */
const shadeOf = (color: string) => mix(color, '#3b2a5c', 0.3);

// ---------- Parts ----------

/** A main shape: outlined, shaded underneath and highlighted. */
const body = (g: Geom, fill: string): Part => ({ ...g, fill, outline: true, shade: shadeOf(fill), gloss: true });
/** An outlined shape with shading but no highlight: ears, wings, feet. */
const piece = (g: Geom, fill: string): Part => ({ ...g, fill, outline: true, shade: shadeOf(fill) });
/** An outlined flat shape, for small bits the shading would muddy. */
const solid = (g: Geom, fill: string): Part => ({ ...g, fill, outline: true });
/** A marking painted on: no outline, no shading. */
const paint = (g: Geom, fill: string, opacity?: number): Part => ({ ...g, fill, opacity });
/** A line, e.g. a mouth or whiskers. */
const stroke = (d: string, color: string, width: number, opacity?: number): Part => ({
  ...geom(d),
  line: { color, width },
  opacity,
});
/** A coloured line with an ink edge: antennae, tails, antlers. */
const cord = (d: string, color: string, width: number): Part[] => [stroke(d, INK, width + OUTLINE * 1.4), stroke(d, color, width)];

/** Glossy ink eyes, each with a glint. */
const eyes = (x1: number, x2: number, y: number, r = 2.2): Part[] =>
  [x1, x2].flatMap((x) => [paint(ell(x, y, r * 0.86, r), INK), paint(ell(x - r * 0.28, y - r * 0.38, r * 0.36, r * 0.36), '#ffffff')]);

const blush = (x1: number, x2: number, y: number, r = 2.2): Part[] =>
  [x1, x2].map((x) => paint(ell(x, y, r, r * 0.62), '#ff7d9c', 0.45));

const smile = (x: number, y: number, w = 2.2): Part => stroke(`M${n(x - w)} ${n(y)}Q${n(x)} ${n(y + w * 0.9)} ${n(x + w)} ${n(y)}`, INK, 1.1);

const feet = (x1: number, x2: number, y: number, fill: string, rx = 3.2, ry = 2): Part[] =>
  [x1, x2].map((x) => piece(ell(x, y, rx, ry), fill));

// ---------- More parts ----------

/** Eyes glancing sideways: whites with the pupils pushed toward `look` (-1 left, 1 right). */
const sideEyes = (x1: number, x2: number, y: number, look: number, r = 2.8): Part[] =>
  [x1, x2].flatMap((x) => [
    solid(ell(x, y, r, r * 0.8), WHITE),
    paint(ell(x + look * r * 0.5, y + 0.3, r * 0.46, r * 0.56), INK),
  ]);

/** A four-point sparkle. */
const sparkle = (cx: number, cy: number, r: number, fill: string): Part =>
  solid(poly([cx, cy - r], [cx + r * 0.3, cy - r * 0.3], [cx + r, cy], [cx + r * 0.3, cy + r * 0.3], [cx, cy + r], [cx - r * 0.3, cy + r * 0.3], [cx - r, cy], [cx - r * 0.3, cy - r * 0.3]), fill);

// ---------- Palettes ----------

const WHITE = '#ffffff';
const CREAM = '#fff1dc';
const PINK = '#ff9ec0';

// ---------- The cast ----------
// Every one riffs on a meme type rather than copying anyone's drawing.

const DEFINITIONS: Record<string, Part[]> = {
  // A side-eyeing shiba.
  sparkmouse: [
    body(ell(24, 41, 8, 4.5), '#f0a04b'),
    piece(poly([12.5, 20], [13.5, 6.5], [21, 14.5]), '#f0a04b'),
    piece(poly(...mirror([[12.5, 20], [13.5, 6.5], [21, 14.5]])), '#f0a04b'),
    paint(poly([14.6, 17], [15.2, 10], [18.8, 14.6]), CREAM),
    paint(poly(...mirror([[14.6, 17], [15.2, 10], [18.8, 14.6]])), CREAM),
    body(blob([10, 24], [14, 14], [24, 11.5], [34, 14], [38, 24], [34, 33], [24, 36], [14, 33]), '#f0a04b'),
    paint(blob([13.5, 27], [19, 22.5], [24, 24.5], [29, 22.5], [34.5, 27], [30, 34], [24, 36], [18, 34]), CREAM),
    paint(ell(18.5, 19, 1.7, 1.1), CREAM),
    paint(ell(29.5, 19, 1.7, 1.1), CREAM),
    ...sideEyes(19, 29, 24, 1),
    paint(ell(24, 29, 2, 1.4), INK),
    stroke('M20.5 32.2Q24 33.6 28 31', INK, 1.2),
    ...blush(15, 33, 30, 1.8),
    ...feet(19.5, 28.5, 45, CREAM, 3, 1.7),
  ],
  // A cat vibing to its headphones.
  voltmoth: [
    body(ell(24, 40.5, 9, 4.8), '#ffcf66'),
    piece(poly([12, 21], [13, 9], [20.5, 15]), '#ffcf66'),
    piece(poly(...mirror([[12, 21], [13, 9], [20.5, 15]])), '#ffcf66'),
    ...cord('M10.5 23Q24 3 37.5 23', '#5a5f73', 2),
    body(ell(24, 26.5, 13, 11), '#ffcf66'),
    paint(ell(24, 21, 3, 4), '#f2a93b'),
    piece(rrect(7.5, 20, 6, 10, 3), '#ff5d8f'),
    piece(rrect(34.5, 20, 6, 10, 3), '#ff5d8f'),
    stroke('M17.5 26Q19.5 23.6 21.5 26M26.5 26Q28.5 23.6 30.5 26', INK, 1.4),
    ...blush(16.5, 31.5, 29.5, 1.8),
    stroke('M22 30Q23 31.5 24 30Q25 31.5 26 30', INK, 1),
    solid(ell(41, 12, 2, 1.6), INK),
    stroke('M42.8 12L42.8 5L45.5 6.2', INK, 1.1),
    ...feet(19, 29, 45, '#f2a93b', 3, 1.7),
  ],
  // A smug round toad, eyes half shut.
  glitchtoad: [
    piece(ell(16, 22, 6, 5.5), '#7fc97a'),
    piece(ell(32, 22, 6, 5.5), '#7fc97a'),
    body(ell(24, 33, 16, 11), '#7fc97a'),
    paint(ell(24, 38.5, 9.5, 4.5), '#d9f2c6'),
    ...[16, 32].flatMap((x) => [
      solid(ell(x, 22.4, 3.8, 3.2), WHITE),
      paint(ell(x + 0.9, 23.4, 1.4, 1.4), INK),
      paint(geom(`M${x - 4.2} 22.4Q${x} 17.2 ${x + 4.2} 22.4Z`), '#7fc97a'),
      stroke(`M${x - 3.8} 22.4L${x + 3.8} 22.4`, INK, 1.2),
    ]),
    stroke('M17 32.5Q22.5 35 29.5 31', INK, 1.4),
    stroke('M29.5 31L30.8 30.2', INK, 1.1),
    ...blush(12.5, 35.5, 31, 1.8),
    ...feet(14.5, 33.5, 44, '#5fae5a', 4.5, 2),
  ],
  // A pet rock that thinks it's cool.
  chromeshell: [
    ...feet(18, 30, 45, '#7d8492', 3, 1.6),
    body(blob([9, 40], [10, 29], [17, 20], [28, 18], [37, 23.5], [40, 36], [36, 43.5], [14, 43.5]), '#9aa0ad'),
    paint(ell(14, 36, 1.3, 1), '#7d8492'),
    paint(ell(34, 38, 1.5, 1.1), '#7d8492'),
    paint(ell(31, 23.5, 1.2, 0.9), '#7d8492'),
    solid(rrect(13.5, 25.5, 9.5, 6, 2.6), INK),
    solid(rrect(25, 25.5, 9.5, 6, 2.6), INK),
    stroke('M23 27.2L25 27.2', INK, 1.4),
    paint(rrect(15.2, 26.6, 3.4, 1.4, 0.7), WHITE, 0.55),
    paint(rrect(26.7, 26.6, 3.4, 1.4, 0.7), WHITE, 0.55),
    stroke('M20.5 35.5Q24 37.2 27.5 35', INK, 1.2),
  ],
  // A capybara, unbothered, orange on its head.
  sporecat: [
    piece(ell(14.5, 20, 2.6, 2.2), '#8f6240'),
    piece(ell(33.5, 20, 2.6, 2.2), '#8f6240'),
    body(blob([8, 38], [10, 27], [17, 19.5], [31, 19.5], [38, 27], [40, 38], [34, 43.5], [14, 43.5]), '#b07a4f'),
    body(ell(24, 14.5, 5.5, 5), '#ff9d2e'),
    piece(blob([24, 9.5], [27.5, 6], [29.5, 8.8]), '#5fb34a'),
    paint(ell(24, 32, 7.5, 5), '#9a6a44'),
    paint(ell(22.2, 30.4, 0.9, 0.7), INK),
    paint(ell(25.8, 30.4, 0.9, 0.7), INK),
    stroke('M16.5 26.2L20.5 26.2M27.5 26.2L31.5 26.2', INK, 1.4),
    stroke('M22.4 34.6Q24 35.6 25.6 34.6', INK, 1.1),
    ...feet(16, 32, 45, '#7a5234', 3.4, 1.7),
  ],
  // A pastel blob going "uwu".
  prismfly: [
    ...cord('M24 18.5Q22.5 13 26.5 12.5', '#ffc2e2', 1.3),
    body(blob([9, 42], [9, 30], [15, 21.5], [24, 18.5], [33, 21.5], [39, 30], [39, 42], [24, 45]), '#ffc2e2'),
    stroke('M16.5 28.5Q18.25 32 20 28.5M28 28.5Q29.75 32 31.5 28.5', INK, 1.5),
    stroke('M21.3 33Q22.65 35 24 33Q25.35 35 26.7 33', INK, 1.2),
    ...blush(14.5, 33.5, 32.5, 2.4),
    sparkle(38, 17, 3, '#ffe27a'),
  ],
  // A shark in sneakers.
  surgeeel: [
    ...cord('M18 34L17.5 40.5M30 34L30.5 40.5', '#7fa6c9', 2.2),
    solid(rrect(11.5, 39.5, 11, 5, 2.5), '#3d7cff'),
    solid(rrect(25.5, 39.5, 11, 5, 2.5), '#3d7cff'),
    paint(rrect(11.5, 43, 11, 1.6, 0.8), WHITE),
    paint(rrect(25.5, 43, 11, 1.6, 0.8), WHITE),
    piece(poly([9, 26], [2.5, 19], [4.5, 27.5], [2.5, 34]), '#7fa6c9'),
    piece(poly([21, 14.5], [26.5, 4], [30, 15]), '#7fa6c9'),
    body(blob([8, 26], [15, 16], [28, 13.5], [38.5, 18], [43, 25.5], [37, 33.5], [24, 36.5], [12, 34]), '#7fa6c9'),
    paint(blob([12.5, 28], [24, 26.5], [39, 24.5], [35, 32], [24, 35], [14.5, 32.5]), WHITE),
    paint(ell(33, 20.5, 1.7, 1.9), INK),
    paint(ell(32.5, 19.8, 0.6, 0.6), WHITE),
    stroke('M27 28.6L39 25', INK, 1.2),
    stroke('M28.6 28.2L29.8 29.8L31 27.7L32.2 29.2L33.4 27.1L34.6 28.5', WHITE, 1),
  ],
  // A crocodile with bomber wings.
  bytebat: [
    piece(poly([13, 27], [2, 22.5], [2.5, 27.5], [13, 32]), '#8a9bb0'),
    piece(poly(...mirror([[13, 27], [2, 22.5], [2.5, 27.5], [13, 32]])), '#8a9bb0'),
    solid(ell(24, 43.5, 5, 2.8), '#3a3f4f'),
    piece(ell(18.5, 20.5, 4, 4), '#5bb05b'),
    piece(ell(29.5, 20.5, 4, 4), '#5bb05b'),
    body(ell(24, 30, 11.5, 10.5), '#5bb05b'),
    ...eyes(18.5, 29.5, 20.5, 1.8),
    solid(rrect(15, 26.5, 18, 9, 4.5), '#6fc46b'),
    paint(ell(21.5, 29, 0.9, 0.7), INK),
    paint(ell(26.5, 29, 0.9, 0.7), INK),
    stroke('M16.5 34.6L18 33.2L19.5 34.6L21 33.2L22.5 34.6L24 33.2L25.5 34.6L27 33.2L28.5 34.6L30 33.2L31.5 34.6', WHITE, 1),
  ],
  // A log, a bat, and a wake-up call.
  ironhog: [
    ...cord('M34 36L42 16.5', '#c08a55', 2.4),
    ...cord('M39 24L42.8 14.5', '#c08a55', 4.4),
    ...feet(18, 28, 45, '#8a5a36', 3.6, 1.8),
    body(rrect(13, 10.5, 20, 33.5, 8), '#c9925a'),
    solid(ell(23, 12.5, 9, 3.2), '#e8c08f'),
    stroke(ell(23, 12.5, 5, 1.6).d, '#b27a44', 0.8),
    stroke('M16 21L16 30M30.5 25L30.5 37', '#a8733f', 1),
    stroke('M16.5 20L21 21.5M31 20L26.5 21.5', INK, 1.3),
    ...eyes(19, 27, 24.5, 2.3),
    paint(ell(23, 31.5, 2.2, 2.7), INK),
    ...cord('M31 32L36.5 34.5', '#c9925a', 2.2),
  ],
  // "O RLY?" — an owl, very surprised.
  mirrorowl: [
    piece(poly([12, 17], [12.5, 6], [19, 13]), '#8a6a4f'),
    piece(poly(...mirror([[12, 17], [12.5, 6], [19, 13]])), '#8a6a4f'),
    piece(ell(10.5, 30, 4.5, 9), '#8a6a4f'),
    piece(ell(37.5, 30, 4.5, 9), '#8a6a4f'),
    body(ell(24, 28, 14, 15), '#b08a6a'),
    paint(ell(24, 23, 11.5, 8.5), '#efe0cf'),
    solid(ell(18.8, 22.5, 5.4, 5.4), WHITE),
    solid(ell(29.2, 22.5, 5.4, 5.4), WHITE),
    paint(ell(18.8, 22.8, 1.9, 1.9), INK),
    paint(ell(29.2, 22.8, 1.9, 1.9), INK),
    stroke('M13.5 15.5L20 17M34.5 15.5L28 17', INK, 1.3),
    solid(poly([22.4, 27.5], [25.6, 27.5], [24, 31]), '#ffb347'),
    paint(ell(24, 36, 7, 5.5), '#efe0cf'),
    stroke('M20.5 34.5L22.2 36.1L24 34.5L25.8 36.1L27.5 34.5', '#8a6a4f', 1),
    ...feet(20, 28, 43.6, '#ffb347', 2.6, 1.6),
  ],
  // A crab at a rave, claws up.
  acidfrog: [
    stroke('M13.5 37.5L8 42M15 40L11 45M34.5 37.5L40 42M33 40L37 45', INK, 1.6),
    ...cord('M15 31L10 21', '#ff6b4a', 2.2),
    ...cord('M33 31L38 21', '#ff6b4a', 2.2),
    piece(blob([4, 17.5], [7.5, 10], [13.5, 13], [11.5, 19], [8, 16.5]), '#ff6b4a'),
    piece(blob(...mirror([[4, 17.5], [7.5, 10], [13.5, 13], [11.5, 19], [8, 16.5]])), '#ff6b4a'),
    ...cord('M20 28L19 21.5', '#ff6b4a', 1.5),
    ...cord('M28 28L29 21.5', '#ff6b4a', 1.5),
    body(ell(24, 34, 12.5, 8.5), '#ff6b4a'),
    solid(ell(19, 20, 2.6, 2.6), WHITE),
    solid(ell(29, 20, 2.6, 2.6), WHITE),
    paint(ell(19.5, 20.3, 1.2, 1.3), INK),
    paint(ell(29.5, 20.3, 1.2, 1.3), INK),
    solid(geom('M20 34.5Q24 40.5 28 34.5Z'), INK),
    ...blush(16, 32, 34, 1.8),
  ],
  // A shy little ghost.
  lumihare: [
    piece(ell(10, 32, 2.8, 2.2), '#eef0ff'),
    piece(ell(38, 32, 2.8, 2.2), '#eef0ff'),
    body(geom('M10 44L10 26Q10 11.5 24 11.5Q38 11.5 38 26L38 44L34 41L30 44L26 41L22 44L18 41L14 44Z'), '#eef0ff'),
    ...eyes(19.5, 28.5, 25, 2.3),
    ...blush(16, 32, 29.5, 2.4),
    paint(ell(24, 30.8, 1.3, 1.6), INK),
  ],
  // A chimp peeking out of a banana.
  staticfox: [
    piece(poly([12.5, 32], [4, 40], [8.5, 44.5], [16.5, 42]), '#ffd84a'),
    piece(poly(...mirror([[12.5, 32], [4, 40], [8.5, 44.5], [16.5, 42]])), '#ffd84a'),
    solid(rrect(22, 4.5, 4, 5.5, 1.5), '#7a5a2a'),
    body(blob([12, 44], [10, 28], [14, 14], [24, 9], [34, 14], [38, 28], [36, 44]), '#ffd84a'),
    paint(ell(24, 26, 9.5, 9.5), '#6b4a33'),
    paint(ell(14.8, 25.5, 2.4, 3), '#e8c29a'),
    paint(ell(33.2, 25.5, 2.4, 3), '#e8c29a'),
    paint(blob([16.5, 26.5], [20, 21], [24, 22.5], [28, 21], [31.5, 26.5], [28, 32.5], [24, 33.5], [20, 32.5]), '#e8c29a'),
    ...eyes(20.8, 27.2, 24.8, 1.8),
    paint(ell(23, 28.6, 0.7, 0.6), INK),
    paint(ell(25, 28.6, 0.7, 0.6), INK),
    smile(24, 30.6, 2.2),
  ],
  // A ballerina with a cappuccino for a head.
  chromemantis: [
    ...cord('M21.5 36.5L20.5 43.5M26.5 36.5L27.5 43.5', '#f2d2b6', 1.6),
    paint(ell(20.3, 44.6, 2.2, 1.2), '#ff8fbf'),
    paint(ell(27.7, 44.6, 2.2, 1.2), '#ff8fbf'),
    ...cord('M20 26Q13.5 21 16.5 15.5', '#f2d2b6', 1.4),
    ...cord('M28 26Q34.5 21 31.5 15.5', '#f2d2b6', 1.4),
    body(rrect(19, 23.5, 10, 10, 4), '#ffb3d1'),
    piece(blob([9.5, 34], [16, 30], [24, 31.5], [32, 30], [38.5, 34], [32, 37.5], [24, 38.5], [16, 37.5]), '#ffb3d1'),
    ...cord('M32 11.5Q37.5 13 31.2 18.5', WHITE, 1.6),
    body(geom('M15 9L33 9L31 21.5Q24 24.5 17 21.5Z'), WHITE),
    solid(ell(24, 9, 9, 2.4), '#8b5a3c'),
    paint(ell(24, 9, 3.2, 1), '#f3e1c9'),
    ...eyes(21, 27, 15, 1.7),
    ...blush(18.5, 29.5, 18, 1.5),
    smile(24, 18.2, 1.6),
  ],
  // A moth that has found its lamp.
  blightmoth: [
    ...cord('M37 23L37 43.5', '#8a8f9e', 1.5),
    solid(ell(37, 44.5, 5, 1.6), '#6d7282'),
    paint(ell(37, 25, 7, 2.6), '#fff4b0', 0.85),
    body(poly([31, 23], [43, 23], [40.5, 13], [33.5, 13]), '#ffe27a'),
    piece(blob([16, 26], [5, 16], [3, 26], [9, 34], [16, 33]), '#d9cbb3'),
    piece(blob([22, 26], [30, 17.5], [32, 26], [28, 33], [22, 32.5]), '#d9cbb3'),
    ...cord('M17.5 21Q15 14 12 12.5', '#8c7a5e', 1),
    ...cord('M20.5 21Q23 14 26 12.5', '#8c7a5e', 1),
    body(ell(19, 29, 5.6, 9), '#efe6d6'),
    paint(ell(19, 23.5, 5, 2), WHITE),
    ...eyes(17, 21, 27, 1.7),
    ...blush(15.5, 22.5, 30, 1.3),
    ...cord('M23.5 30L31 26.5', '#efe6d6', 1.4),
    ...feet(17, 21.5, 40, '#c9b99a', 1.8, 1.2),
  ],
  // A cat mid "pop".
  beamray: [
    body(ell(24, 41, 9, 4.5), '#f3e0c8'),
    piece(poly([11.5, 20], [12.5, 7.5], [20.5, 13.5]), '#f3e0c8'),
    piece(poly(...mirror([[11.5, 20], [12.5, 7.5], [20.5, 13.5]])), '#f3e0c8'),
    paint(poly([13.6, 17], [14, 11], [18.4, 14]), PINK),
    paint(poly(...mirror([[13.6, 17], [14, 11], [18.4, 14]])), PINK),
    body(ell(24, 26, 14, 12.5), '#f3e0c8'),
    paint(ell(24, 15, 4, 2.4), '#e0a86e'),
    paint(ell(15, 19, 2.4, 1.6), '#e0a86e'),
    ...eyes(18, 30, 21.5, 2),
    solid(ell(24, 31, 6.2, 6.8), '#3a1f2a'),
    paint(ell(24, 34.8, 3.4, 2), '#ff7a9c'),
    ...feet(19, 29, 45, '#e0a86e', 3, 1.7),
  ],
  // Stonks: a mannequin in a suit, and the line only goes up.
  thunderstag: [
    ...cord('M29 35L34 27L38 30.5L43.5 15.5', '#34c759', 2.4),
    solid(poly([44.5, 9], [46.5, 17], [40.5, 14.5]), '#34c759'),
    body(blob([9.5, 45], [11.5, 33.5], [18, 29], [30, 29], [36.5, 33.5], [38.5, 45]), '#2f3a56'),
    paint(poly([20.5, 29], [27.5, 29], [24, 36.5]), WHITE),
    solid(poly([23, 30.5], [25, 30.5], [25.8, 38.5], [24, 40.5], [22.2, 38.5]), '#e0453a'),
    body(ell(24, 18.5, 9, 11), '#9cc0e6'),
    paint(ell(20.5, 18, 1.3, 1.6), INK),
    paint(ell(27.5, 18, 1.3, 1.6), INK),
    stroke('M21.5 23.5Q24 24.6 26.5 23.5', INK, 1),
  ],
  // A walking tree stump with enormous feet.
  sludgebear: [
    ...cord('M18 38L16 42M30 38L32 42', '#7a4f2f', 2.4),
    solid(ell(14, 43.6, 7, 3), '#8a5a36'),
    solid(ell(34, 43.6, 7, 3), '#8a5a36'),
    body(rrect(11, 14, 26, 26, 9), '#9a6a42'),
    stroke('M14.5 22L14.5 33M33.5 20L33.5 30', '#7a4f2f', 1),
    body(blob([8, 18], [12, 8], [20, 4], [30, 5], [38, 10], [40, 18], [32, 21], [24, 19], [16, 21]), '#6fbf4a'),
    ...eyes(18.5, 29.5, 26, 2.4),
    paint(ell(24, 30.2, 2.4, 2), '#7a4f2f'),
    smile(24, 33.8, 2.4),
    ...blush(15.5, 32.5, 30, 1.8),
  ],
  // A hooded wizard with glowing eyes and a staff.
  nullserpent: [
    ...cord('M40.5 17L40.5 45', '#9a6a42', 1.8),
    body(blob([8, 45], [11.5, 32], [17, 22.5], [31, 22.5], [36.5, 32], [40, 45]), '#4b3a8c'),
    sparkle(16, 36, 2.2, '#ffe27a'),
    sparkle(30.5, 40, 1.8, '#ffe27a'),
    body(blob([11.5, 25], [16, 12], [26, 2.5], [29.5, 8.5], [34.5, 16], [36.5, 25], [24, 28.5]), '#5b47a8'),
    paint(ell(24, 22, 7.5, 5.8), '#1d1433'),
    paint(ell(21, 22, 1.9, 1.2), '#9be15d'),
    paint(ell(27, 22, 1.9, 1.2), '#9be15d'),
    body(ell(40.5, 13.5, 3.4, 3.4), '#7fe3ff'),
  ],
  // A galaxy brain, glowing.
  solaris: [
    paint(ell(24, 22, 21.5, 19.5), '#c9b8ff', 0.3),
    paint(ell(24, 22, 17.5, 15.5), '#e3d9ff', 0.45),
    body(blob([8, 24], [10, 13.5], [18, 7.5], [24, 9.5], [30, 7.5], [38, 13.5], [40, 24], [34, 31.5], [24, 33.5], [14, 31.5]), '#ff9ec7'),
    stroke('M24 10L24 16M24 29L24 33M13.5 15Q17 14.5 18 11M34.5 15Q31 14.5 30 11M11 24.5Q13.5 22.5 12.8 19.5M37 24.5Q34.5 22.5 35.2 19.5M16 30Q18 28 20.5 29.5M32 30Q30 28 27.5 29.5', '#d9669b', 1.2),
    ...eyes(19, 29, 20.5, 2),
    smile(24, 25.5, 2),
    ...cord('M24 33.5L24 40', '#c9b8ff', 1.6),
    solid(ell(24, 43, 6, 2.4), '#c9b8ff'),
    sparkle(6, 8, 3, '#ffe27a'),
    sparkle(42, 38, 2.5, '#ffe27a'),
  ],
};

export const CREATURE_ART: Record<string, CreatureArt> = Object.fromEntries(
  Object.entries(DEFINITIONS).map(([id, parts]) => [id, { parts, top: Math.max(0, Math.min(...parts.map((part) => part.box[1]))) }]),
);

/** Where a part's underside shade and highlight go, as ellipses in grid units. */
export function shadeEllipse([x0, y0, x1, y1]: Box) {
  const w = x1 - x0;
  const h = y1 - y0;
  return { cx: x0 + w * 0.58, cy: y1 + h * 0.12, rx: w * 0.78, ry: h * 0.5 };
}

export function glossEllipse([x0, y0, x1, y1]: Box) {
  const w = x1 - x0;
  const h = y1 - y0;
  return { cx: x0 + w * 0.32, cy: y0 + h * 0.26, rx: Math.max(1, w * 0.16), ry: Math.max(0.8, h * 0.1) };
}
