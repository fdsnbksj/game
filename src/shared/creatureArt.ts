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

// ---------- Palettes ----------

const WHITE = '#ffffff';
const CREAM = '#fff4d6';
const PINK = '#ff9ec0';

const VOLT = '#ffc93c';
const VOLT_DEEP = '#f0a020';
const VOLT_CYAN = '#4fc3f7';
const VOLT_BLUE = '#2a9fd6';

const GLITCH = '#e05bc8';
const GLITCH_PALE = '#f6c2ec';
const GLITCH_DARK = '#6a2f8a';
const GLITCH_LIME = '#9be15d';

const CHROME = '#a9b7cc';
const CHROME_LIGHT = '#dde4ef';
const CHROME_DEEP = '#7c8aa4';
const STEEL = '#5e6b85';
const CHROME_BLUE = '#5aa9ff';

const MOSS = '#8bd450';
const MOSS_DEEP = '#4f8a32';
const MOSS_PALE = '#e3f5c6';
const CAP = '#ff7a9c';

const PEARL = '#f1f0ff';
const TRIM_PINK = '#ff9ad5';
const TRIM_CYAN = '#7fe3ff';
const TRIM_YELLOW = '#ffe27a';
const TRIM_LILAC = '#c9b8ff';

const BEAK = '#ffb347';

// ---------- The creatures ----------

function sunRays(): Part[] {
  const rays: Part[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i - Math.PI / 2;
    const tip: Pt = [24 + Math.cos(a) * 22, 25 + Math.sin(a) * 22];
    const left: Pt = [24 + Math.cos(a - 0.26) * 13, 25 + Math.sin(a - 0.26) * 13];
    const right: Pt = [24 + Math.cos(a + 0.26) * 13, 25 + Math.sin(a + 0.26) * 13];
    rays.push(solid(poly(left, tip, right), i % 2 === 0 ? TRIM_YELLOW : '#ffc86b'));
  }
  return rays;
}

const DEFINITIONS: Record<string, Part[]> = {
  sparkmouse: [
    ...cord('M33 39L40.5 35.5L37.5 32L44.5 27.5', VOLT_CYAN, 2.2),
    piece(ell(15, 18, 7, 7), VOLT),
    piece(ell(33, 18, 7, 7), VOLT),
    paint(ell(15, 18, 4, 4), PINK),
    paint(ell(33, 18, 4, 4), PINK),
    body(ell(24, 31, 13, 12.5), VOLT),
    paint(ell(24, 37, 7.5, 5.5), CREAM),
    ...feet(19, 29, 43.5, VOLT_DEEP),
    ...eyes(19.5, 28.5, 29),
    ...blush(15.5, 32.5, 33),
    paint(ell(24, 32, 1.4, 1), INK),
    smile(24, 33.6, 1.6),
  ],
  chromeshell: [
    stroke('M15 38L10 43M33 38L38 43', INK, 1.6),
    ...cord('M21 17Q19 10 14 9', STEEL, 1.1),
    ...cord('M27 17Q29 10 34 9', STEEL, 1.1),
    body(ell(24, 32, 16, 12), CHROME),
    stroke('M24 22L24 43', CHROME_DEEP, 1.2),
    paint(ell(17, 32, 2.2, 1.8), CHROME_BLUE, 0.85),
    paint(ell(31, 34, 1.8, 1.5), CHROME_BLUE, 0.85),
    body(ell(24, 20, 8.5, 6.5), STEEL),
    ...eyes(21, 27, 19.5, 1.8),
    paint(ell(24, 22.8, 1.5, 0.9), '#ffffff', 0.6),
  ],
  glitchtoad: [
    piece(ell(16, 24, 5.5, 5.5), GLITCH),
    piece(ell(32, 24, 5.5, 5.5), GLITCH),
    body(ell(24, 34, 16, 11), GLITCH),
    paint(ell(24, 38.5, 10, 5), GLITCH_PALE),
    paint(rrect(12, 29, 3, 3, 0.5), GLITCH_LIME),
    paint(rrect(33, 28, 3, 3, 0.5), GLITCH_LIME),
    paint(rrect(30, 33.5, 2.4, 2.4, 0.4), GLITCH_LIME),
    ...eyes(16, 32, 24, 2.6),
    stroke('M17 32Q24 36.5 31 32', INK, 1.2),
    ...blush(13.5, 34.5, 33.5),
    ...feet(14.5, 33.5, 44, GLITCH, 4.5, 2),
  ],
  voltmoth: [
    piece(blob([21, 27], [10, 15], [5, 21], [8, 30], [19, 31]), VOLT_CYAN),
    piece(blob(...mirror([[21, 27], [10, 15], [5, 21], [8, 30], [19, 31]])), VOLT_CYAN),
    piece(blob([21, 32], [12, 35], [14, 40.5], [21, 37]), VOLT_BLUE),
    piece(blob(...mirror([[21, 32], [12, 35], [14, 40.5], [21, 37]])), VOLT_BLUE),
    ...cord('M22 23Q19 16 16 14.5', INK, 0.6),
    ...cord('M26 23Q29 16 32 14.5', INK, 0.6),
    solid(ell(16, 14.5, 1.8, 1.8), VOLT),
    solid(ell(32, 14.5, 1.8, 1.8), VOLT),
    body(ell(24, 31, 7.5, 10), VOLT),
    paint(ell(24, 24.5, 6, 2.2), CREAM),
    ...eyes(21.4, 26.6, 28.5, 1.8),
    ...blush(19.5, 28.5, 31.5, 1.5),
    ...feet(21.5, 26.5, 41.5, VOLT_DEEP, 2.2, 1.5),
  ],
  bytebat: [
    piece(poly([19, 27], [4, 19], [6, 26], [2, 32], [9, 32], [11, 37], [19, 34]), GLITCH_DARK),
    piece(poly(...mirror([[19, 27], [4, 19], [6, 26], [2, 32], [9, 32], [11, 37], [19, 34]])), GLITCH_DARK),
    piece(poly([15, 21], [15.5, 9], [22, 17]), GLITCH),
    piece(poly(...mirror([[15, 21], [15.5, 9], [22, 17]])), GLITCH),
    body(ell(24, 28, 10.5, 10.5), GLITCH),
    paint(ell(24, 33, 6, 4.2), GLITCH_PALE),
    ...eyes(20, 28, 26, 2.3),
    stroke('M20 31Q24 33 28 31', INK, 1.1),
    solid(poly([21, 31.8], [23, 32.4], [22, 34.8]), WHITE),
    solid(poly([27, 31.8], [25, 32.4], [26, 34.8]), WHITE),
    ...feet(20.5, 27.5, 39.5, GLITCH_DARK, 2.4, 1.6),
  ],
  ironhog: [
    piece(blob([10.5, 22], [11, 13], [19.5, 16.5], [18, 21.5]), CHROME_DEEP),
    piece(blob(...mirror([[10.5, 22], [11, 13], [19.5, 16.5], [18, 21.5]])), CHROME_DEEP),
    body(ell(24, 30, 16, 12.5), CHROME),
    solid(rrect(15, 17.5, 18, 5.5, 2.75), STEEL),
    ...eyes(18.5, 29.5, 27, 2),
    solid(poly([16.5, 36], [15, 29], [19.5, 33]), WHITE),
    solid(poly(...mirror([[16.5, 36], [15, 29], [19.5, 33]])), WHITE),
    piece(ell(24, 34, 7, 5), CHROME_LIGHT),
    paint(ell(22, 34, 1.1, 1.5), INK),
    paint(ell(26, 34, 1.1, 1.5), INK),
    ...feet(16, 32, 43.5, STEEL, 4, 2.2),
  ],
  surgeeel: [
    piece(ell(24, 40, 15, 5), VOLT_BLUE),
    paint(ell(24, 39, 9, 2.4), '#1c78a8'),
    solid(poly([27, 14], [31, 5.5], [34.5, 14.5]), VOLT),
    body(blob([17, 40], [17, 30], [20, 21], [26, 14.5], [33, 15], [36, 21.5], [31, 27.5], [27.5, 35], [30, 40]), VOLT_CYAN),
    paint(ell(21, 33, 1.6, 1.6), VOLT),
    paint(ell(22.5, 26, 1.6, 1.6), VOLT),
    paint(ell(21.5, 37.5, 1.3, 1.3), VOLT),
    ...eyes(27.5, 32.5, 19.5, 1.9),
    stroke('M28.5 24Q31 25.6 33.5 24', INK, 1.1),
  ],
  mirrorowl: [
    piece(poly([12, 17], [12.5, 6], [19, 13]), CHROME_DEEP),
    piece(poly(...mirror([[12, 17], [12.5, 6], [19, 13]])), CHROME_DEEP),
    piece(ell(10.5, 30, 4.5, 9), CHROME_DEEP),
    piece(ell(37.5, 30, 4.5, 9), CHROME_DEEP),
    body(ell(24, 28, 14, 15), CHROME),
    paint(ell(24, 22.5, 11, 8), CHROME_LIGHT),
    solid(ell(19, 22.5, 5, 5), WHITE),
    solid(ell(29, 22.5, 5, 5), WHITE),
    paint(ell(19.4, 23, 3, 3), CHROME_BLUE),
    paint(ell(29.4, 23, 3, 3), CHROME_BLUE),
    paint(ell(19.4, 23, 1.6, 1.6), INK),
    paint(ell(29.4, 23, 1.6, 1.6), INK),
    paint(ell(18.4, 21.6, 1, 1), WHITE),
    paint(ell(28.4, 21.6, 1, 1), WHITE),
    solid(poly([22.4, 27], [25.6, 27], [24, 30.6]), BEAK),
    paint(ell(24, 35.5, 7, 6), CHROME_LIGHT),
    stroke('M20.5 34L22.2 35.6L24 34L25.8 35.6L27.5 34', CHROME_DEEP, 1),
    ...feet(20, 28, 43.5, BEAK, 2.6, 1.6),
  ],
  staticfox: [
    piece(blob([29, 41], [37, 32], [43, 22], [45, 33], [39, 42]), GLITCH),
    paint(ell(43.3, 25.5, 2.2, 3), WHITE),
    piece(poly([12.5, 20], [11.5, 5.5], [21, 13.5]), GLITCH),
    piece(poly(...mirror([[12.5, 20], [11.5, 5.5], [21, 13.5]])), GLITCH),
    paint(poly([14, 16.5], [13.6, 9.5], [18.2, 13.5]), GLITCH_DARK),
    paint(poly(...mirror([[14, 16.5], [13.6, 9.5], [18.2, 13.5]])), GLITCH_DARK),
    body(ell(24, 36, 10, 8.5), GLITCH),
    paint(ell(24, 37, 5.2, 6), WHITE),
    body(blob([11.5, 18.5], [24, 13.5], [36.5, 18.5], [31.5, 27.5], [24, 31], [16.5, 27.5]), GLITCH),
    paint(blob([17.5, 25], [24, 23.5], [30.5, 25], [24, 30.5]), WHITE),
    ...eyes(19.5, 28.5, 21.8, 2),
    paint(ell(24, 26.2, 1.5, 1.1), INK),
    ...feet(20, 28, 43.8, WHITE, 3, 1.8),
  ],
  chromemantis: [
    ...cord('M20.5 13Q17.5 6 13 4.5', INK, 0.5),
    ...cord('M27.5 13Q30.5 6 35 4.5', INK, 0.5),
    stroke('M21 41L16.5 45M27 41L31.5 45', INK, 1.6),
    body(ell(24, 34, 6.5, 9.5), '#86d9ad'),
    piece(poly([19.5, 27], [11.5, 16.5], [9, 18], [16, 30.5]), '#86d9ad'),
    piece(poly(...mirror([[19.5, 27], [11.5, 16.5], [9, 18], [16, 30.5]])), '#86d9ad'),
    piece(poly([11.5, 16.5], [8, 16.5], [5.5, 29], [9, 26], [10.5, 19.5]), CHROME_LIGHT),
    piece(poly(...mirror([[11.5, 16.5], [8, 16.5], [5.5, 29], [9, 26], [10.5, 19.5]])), CHROME_LIGHT),
    body(blob([12.5, 13], [24, 11.5], [35.5, 13], [28, 22], [24, 25], [20, 22]), '#86d9ad'),
    solid(ell(16.5, 14.8, 3.5, 3.5), '#d4ff8a'),
    solid(ell(31.5, 14.8, 3.5, 3.5), '#d4ff8a'),
    paint(ell(17, 15, 1.5, 1.5), INK),
    paint(ell(31, 15, 1.5, 1.5), INK),
    stroke('M22.5 21Q24 22.2 25.5 21', INK, 1),
  ],
  thunderstag: [
    ...cord('M18 16L13 6M15 10.5L9.5 9.5M13.8 7.8L15.5 2.5', VOLT_CYAN, 2),
    ...cord('M30 16L35 6M33 10.5L38.5 9.5M34.2 7.8L32.5 2.5', VOLT_CYAN, 2),
    piece(ell(12.5, 19.5, 4.5, 2.6), VOLT),
    piece(ell(35.5, 19.5, 4.5, 2.6), VOLT),
    ...feet(17, 31, 44.5, VOLT_DEEP, 3.4, 1.8),
    body(ell(24, 37.5, 13, 7.5), VOLT_DEEP),
    solid(poly([23, 34.5], [27.5, 34.5], [25, 37.8], [27.5, 37.8], [22, 44], [23.6, 39.2], [21, 39.2]), VOLT_CYAN),
    body(blob([16, 16], [32, 16], [33, 25.5], [28.5, 33], [19.5, 33], [15, 25.5]), VOLT),
    paint(ell(24, 29.2, 5.2, 3.8), CREAM),
    paint(ell(24, 27.6, 1.9, 1.2), INK),
    ...eyes(19.5, 28.5, 22, 2),
  ],
  nullserpent: [
    piece(ell(24, 40.5, 18, 5.5), GLITCH_DARK),
    body(rrect(19, 25, 10, 17, 5), '#8d4cc4'),
    body(blob([9.5, 22], [15, 8.5], [24, 4.5], [33, 8.5], [38.5, 22], [31.5, 29.5], [24, 33], [16.5, 29.5]), '#7b3fb0'),
    paint(ell(24, 19.5, 7, 9.5), '#b98ae8'),
    paint(ell(14.8, 17, 2, 3.2), GLITCH),
    paint(ell(33.2, 17, 2, 3.2), GLITCH),
    paint(ell(20.5, 16.5, 2.5, 1.9), GLITCH_LIME),
    paint(ell(27.5, 16.5, 2.5, 1.9), GLITCH_LIME),
    paint(rrect(20, 14.9, 1, 3.2, 0.5), INK),
    paint(rrect(27, 14.9, 1, 3.2, 0.5), INK),
    stroke('M24 24.5L24 28.5M24 28.5L22.4 30.6M24 28.5L25.6 30.6', '#ff5d8f', 1),
    paint(ell(14, 40.5, 1.5, 1.2), GLITCH_LIME),
    paint(ell(34, 40.5, 1.5, 1.2), GLITCH_LIME),
  ],
  sporecat: [
    body(ell(24, 33.5, 12, 10.5), MOSS),
    piece(geom('M10 23.5Q10 9 24 9Q38 9 38 23.5Q24 26 10 23.5Z'), CAP),
    paint(ell(17.5, 16, 2.4, 1.9), CREAM),
    paint(ell(27, 13, 2.8, 2), CREAM),
    paint(ell(32.5, 19, 1.9, 1.5), CREAM),
    ...eyes(19.5, 30, 30.5, 2.1),
    ...blush(15.8, 32.2, 34.2, 2),
    stroke('M22 35Q23 36.2 24 35Q25 36.2 26 35', INK, 1),
    stroke('M11.5 33L15.5 33.6M11.5 36L15.5 35.2M36.5 33L32.5 33.6M36.5 36L32.5 35.2', INK, 0.8, 0.55),
    ...feet(19, 29, 43.5, MOSS_DEEP),
  ],
  prismfly: [
    piece(blob([22, 29], [10, 15], [5.5, 21], [11, 29]), TRIM_CYAN),
    piece(blob(...mirror([[22, 29], [10, 15], [5.5, 21], [11, 29]])), TRIM_PINK),
    piece(blob([22, 32], [12.5, 36], [15.5, 41], [22, 36]), TRIM_YELLOW),
    piece(blob(...mirror([[22, 32], [12.5, 36], [15.5, 41], [22, 36]])), TRIM_LILAC),
    ...cord('M22 24Q19.5 17 16.5 15', INK, 0.5),
    ...cord('M26 24Q28.5 17 31.5 15', INK, 0.5),
    solid(ell(16.5, 15, 1.7, 1.7), TRIM_YELLOW),
    solid(ell(31.5, 15, 1.7, 1.7), TRIM_PINK),
    body(ell(24, 32, 7, 9.5), PEARL),
    ...eyes(21.5, 26.5, 30, 1.8),
    ...blush(19.6, 28.4, 33, 1.4),
    ...feet(21.5, 26.5, 41.8, TRIM_LILAC, 2.2, 1.4),
  ],
  acidfrog: [
    piece(ell(13.5, 23.5, 6, 6), MOSS),
    piece(ell(34.5, 23.5, 6, 6), MOSS),
    body(ell(24, 33, 17.5, 11), MOSS),
    ...eyes(13.5, 34.5, 23.5, 2.8),
    solid(geom('M12 31Q24 34.5 36 31Q34 42 24 42Q14 42 12 31Z'), '#3a5e22'),
    paint(ell(24, 38.6, 4, 2), '#ff6f91'),
    solid(poly([15.5, 31.8], [18.5, 32.5], [16.6, 35.4]), WHITE),
    solid(poly(...mirror([[15.5, 31.8], [18.5, 32.5], [16.6, 35.4]])), WHITE),
    paint(ell(9.5, 34, 1.8, 1.4), MOSS_DEEP),
    paint(ell(38.5, 34.5, 1.5, 1.2), MOSS_DEEP),
    ...feet(11.5, 36.5, 44, MOSS_DEEP, 5, 2),
  ],
  lumihare: [
    piece(ell(17, 14.5, 4.5, 11), PEARL),
    piece(ell(31, 14.5, 4.5, 11), PEARL),
    paint(ell(17, 15.5, 2, 7.5), TRIM_PINK),
    paint(ell(31, 15.5, 2, 7.5), TRIM_CYAN),
    body(ell(24, 33, 12, 10.5), PEARL),
    ...eyes(19.5, 28.5, 31, 2),
    ...blush(15.8, 32.2, 34.5, 2),
    paint(ell(24, 34, 1.4, 1), '#ff7aa8'),
    smile(24, 35.4, 1.5),
    ...feet(18, 30, 43.6, TRIM_LILAC, 4, 2.2),
  ],
  blightmoth: [
    piece(blob([21, 25], [7, 10], [2.5, 20], [7, 30], [19, 30]), MOSS_DEEP),
    piece(blob(...mirror([[21, 25], [7, 10], [2.5, 20], [7, 30], [19, 30]])), MOSS_DEEP),
    paint(ell(9, 20, 2.6, 2.6), '#c8ff7a'),
    paint(ell(39, 20, 2.6, 2.6), '#c8ff7a'),
    paint(ell(9, 20, 1.1, 1.1), INK),
    paint(ell(39, 20, 1.1, 1.1), INK),
    piece(blob([21, 30], [10.5, 38], [15, 43], [21, 36]), MOSS),
    piece(blob(...mirror([[21, 30], [10.5, 38], [15, 43], [21, 36]])), MOSS),
    ...cord('M22 20Q18 11 13.5 8.5', MOSS_PALE, 1),
    ...cord('M26 20Q30 11 34.5 8.5', MOSS_PALE, 1),
    body(ell(24, 29, 7, 11), '#3f6b2a'),
    paint(ell(24, 21.5, 6, 2.6), MOSS_PALE),
    paint(ell(21.5, 26, 2, 2.3), '#c8ff7a'),
    paint(ell(26.5, 26, 2, 2.3), '#c8ff7a'),
    paint(ell(21.8, 26.4, 0.9, 1.1), INK),
    paint(ell(26.8, 26.4, 0.9, 1.1), INK),
    ...feet(21.5, 26.5, 40.8, '#2f5220', 2.2, 1.5),
  ],
  beamray: [
    ...cord('M24 36Q26.5 41.5 31 44.5', TRIM_LILAC, 1),
    body(blob([2.5, 30], [14, 20], [24, 14.5], [34, 20], [45.5, 30], [34, 32], [24, 37.5], [14, 32]), PEARL),
    paint(blob([3, 29.8], [10, 25], [12.5, 30.8]), TRIM_CYAN),
    paint(blob(...mirror([[3, 29.8], [10, 25], [12.5, 30.8]])), TRIM_PINK),
    solid(poly([19, 18.5], [18, 13.5], [21.5, 16.5]), TRIM_YELLOW),
    solid(poly(...mirror([[19, 18.5], [18, 13.5], [21.5, 16.5]])), TRIM_YELLOW),
    ...eyes(20, 28, 25, 1.9),
    ...blush(17, 31, 28, 1.6),
    smile(24, 29, 1.8),
  ],
  sludgebear: [
    piece(ell(12, 15.5, 5, 5), '#6fb53c'),
    piece(ell(36, 15.5, 5, 5), '#6fb53c'),
    paint(ell(12, 15.5, 2.5, 2.5), '#3f6b2a'),
    paint(ell(36, 15.5, 2.5, 2.5), '#3f6b2a'),
    body(ell(24, 30, 17, 14.5), '#6fb53c'),
    paint(
      blob([9, 26], [13.5, 18], [24, 15.5], [34.5, 18], [39, 26], [36.5, 29], [33.5, 24.5], [29.5, 29.5], [24, 24.5], [19, 30.5], [15.5, 24.5], [12, 29]),
      '#a8e05f',
    ),
    paint(ell(24, 33, 6.8, 5), MOSS_PALE),
    paint(ell(24, 31, 2.1, 1.4), INK),
    smile(24, 34.2, 1.8),
    ...eyes(17.5, 30.5, 26.5, 2.2),
    ...feet(15, 33, 44, MOSS_DEEP, 5, 2.4),
  ],
  solaris: [
    ...sunRays(),
    body(ell(24, 25, 14.5, 14.5), '#ffd76a'),
    paint(ell(24, 27, 10, 9), '#fff3c4'),
    ...eyes(19.5, 28.5, 24, 2.1),
    ...blush(16.5, 31.5, 28, 2),
    stroke('M20.5 29Q24 32.6 27.5 29', INK, 1.2),
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
