// Every creature as a crude MS Paint meme: layered paths on a 48x48 grid, standing on the
// bottom edge, in fat black marker over flat colour. CreatureChip draws them as SVG and
// src/game/battle/textures.ts bakes the same parts onto a canvas, so the creature in the
// shop is exactly the one on the board. Every shape passes through wobble(), so lines
// look drawn by hand, the same way on every device.

export const CREATURE_SIZE = 48;

export const INK = '#000000';
export const OUTLINE = 2.3;

type Box = [x0: number, y0: number, x1: number, y1: number];

export interface Part {
  d: string;
  box: Box;
  fill?: string;
  /** Drawn as a line of this colour and width instead of filled. */
  line?: { color: string; width: number };
  outline?: boolean;
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

/** A small, fixed nudge for the i-th number of a path: a hash, not randomness. */
function nudge(i: number, value: number): number {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(Math.round(value * 100), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  return ((h >>> 0) % 1000) / 1000 - 0.5;
}

/**
 * Shakes every coordinate a little, like a mouse-drawn line. Small shapes shake less, so
 * an eye stays an eye.
 */
function wobble(d: string, box: Box): string {
  const amount = Math.min(1.2, Math.max(box[2] - box[0], box[3] - box[1]) * 0.08);
  let i = 0;
  return d.replace(/-?\d*\.?\d+/g, (match) => `${n(Number(match) + nudge(i++, Number(match)) * amount)}`);
}

function geom(d: string): Geom {
  const shaken = wobble(d, boxOf(d));
  return { d: shaken, box: boxOf(shaken) };
}

/** An ellipse as four cubic curves, so the path is coordinate pairs only. */
export function ell(cx: number, cy: number, rx: number, ry: number): Geom {
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

export function rrect(x: number, y: number, w: number, h: number, r: number): Geom {
  return geom(
    `M${n(x + r)} ${n(y)}L${n(x + w - r)} ${n(y)}Q${n(x + w)} ${n(y)} ${n(x + w)} ${n(y + r)}` +
      `L${n(x + w)} ${n(y + h - r)}Q${n(x + w)} ${n(y + h)} ${n(x + w - r)} ${n(y + h)}` +
      `L${n(x + r)} ${n(y + h)}Q${n(x)} ${n(y + h)} ${n(x)} ${n(y + h - r)}` +
      `L${n(x)} ${n(y + r)}Q${n(x)} ${n(y)} ${n(x + r)} ${n(y)}Z`,
  );
}

export type Pt = [number, number];

/** A straight-edged closed shape. */
export const poly = (...pts: Pt[]): Geom => geom(`M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z`);

/** A smooth closed shape through the points (a closed Catmull-Rom curve). */
export function blob(...pts: Pt[]): Geom {
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

// ---------- Parts ----------

/** An outlined flat shape: MS Paint's fill bucket inside a fat black line. */
export const body = (g: Geom, fill: string): Part => ({ ...g, fill, outline: true });
/** A marking painted on: no outline. */
export const paint = (g: Geom, fill: string, opacity?: number): Part => ({ ...g, fill, opacity });
/** A line, e.g. a mouth or a stick limb. */
export const stroke = (d: string, color: string, width: number, opacity?: number): Part => ({
  ...geom(d),
  line: { color, width },
  opacity,
});
/** A coloured line with an ink edge: tails, bats, bones. */
export const cord = (d: string, color: string, width: number): Part[] => [stroke(d, INK, width + OUTLINE * 1.4), stroke(d, color, width)];

/** Two black dots: the dead stare every meme face has. */
const dots = (x1: number, x2: number, y: number, r = 1): Part[] => [x1, x2].map((x) => paint(ell(x, y, r, r), INK));

/** Big outlined white eyes with tiny pupils, pushed toward `look` (-1 left, 1 right). */
const stare = (x1: number, x2: number, y: number, r = 3.4, look = 0): Part[] =>
  [x1, x2].flatMap((x) => [body(ell(x, y, r, r), WHITE), paint(ell(x + look * r * 0.45, y, r * 0.28, r * 0.28), INK)]);

/** Eyes glancing sideways under a flat lid. */
const sideEyes = (x1: number, x2: number, y: number, look: number, r = 2.8): Part[] =>
  [x1, x2].flatMap((x) => [
    body(ell(x, y, r, r * 0.8), WHITE),
    paint(ell(x + look * r * 0.5, y + 0.4, r * 0.4, r * 0.45), INK),
    stroke(`M${n(x - r - 0.4)} ${n(y - r * 0.35)}L${n(x + r + 0.4)} ${n(y - r * 0.35)}`, INK, 1.4),
  ]);

/** Stick legs ending in flat feet. */
const legs = (x1: number, x2: number, top: number, fill: string): Part[] => [
  stroke(`M${x1} ${top}L${x1} 44M${x2} ${top}L${x2} 44`, INK, 1.6),
  body(ell(x1 - 1, 45, 2.6, 1.3), fill),
  body(ell(x2 + 1, 45, 2.6, 1.3), fill),
];

// ---------- Palette ----------
// Straight out of the MS Paint colour box.

const WHITE = '#ffffff';
const GREY = '#c3c3c3';
const DARK_GREY = '#7f7f7f';
const RED = '#ed1c24';
const ORANGE = '#ff7f27';
const YELLOW = '#fff200';
const GOLD = '#ffc90e';
const GREEN = '#22b14c';
const LIME = '#b5e61d';
const SKY = '#99d9ea';
const BLUE = '#00a2e8';
const INDIGO = '#3f48cc';
const STEEL = '#7092be';
const BROWN = '#b97a57';
const DARK_BROWN = '#7a4a2a';
const CREAM = '#efe4b0';
const PINK = '#ffaec9';
const LILAC = '#c8bfe7';
const SKIN = '#f5dcc0';

// ---------- The cast ----------
// Each one is drawn from where its meme started, when nobody owns that: public-domain art,
// Italian brainrot, Meme Man, plain animals. Owned characters are never copied.

const DEFINITIONS: Record<string, Part[]> = {
  // Such wow: a shiba, eyebrows up, side-eyeing you.
  sparkmouse: [
    body(poly([12.5, 21], [13, 6.5], [21, 14.5]), '#e8a04c'),
    body(poly(...mirror([[12.5, 21], [13, 6.5], [21, 14.5]])), '#e8a04c'),
    ...legs(19, 29, 36, CREAM),
    body(blob([10, 25], [13, 14], [24, 11.5], [35, 14], [38, 25], [34, 34], [24, 37], [14, 34]), '#e8a04c'),
    paint(blob([14, 28], [19, 24], [24, 26], [29, 24], [34, 28], [30, 34.5], [24, 36.5], [18, 34.5]), CREAM),
    ...sideEyes(19, 29, 23.5, 1, 2.6),
    stroke('M16 17.5L21 16.5M27 16.5L32 17.5', INK, 1.4),
    paint(ell(24, 28.5, 2, 1.4), INK),
    stroke('M21 32L27 32', INK, 1.2),
  ],
  // Deal with it: a rock in pixel shades.
  chromeshell: [
    body(blob([8, 45], [9, 32], [15, 21], [27, 17.5], [37, 22], [41, 34], [39, 45]), GREY),
    paint(ell(14, 38, 1.6, 1.1), DARK_GREY),
    paint(ell(34, 40, 1.8, 1.2), DARK_GREY),
    paint(ell(31, 23, 1.4, 1), DARK_GREY),
    paint(poly([10, 26], [38, 26], [38, 28], [36, 28], [36, 31], [34, 31], [34, 33], [28, 33], [28, 31], [26, 31], [26, 28], [22, 28], [22, 31], [20, 31], [20, 33], [14, 33], [14, 31], [12, 31], [12, 28], [10, 28]), INK),
    paint(poly([14, 28], [16, 28], [16, 30], [14, 30]), WHITE),
    paint(poly([28, 28], [30, 28], [30, 30], [28, 30]), WHITE),
    stroke('M19 38L29 38', INK, 1.4),
  ],
  // Feels: the bald, sad line-drawn guy.
  glitchtoad: [
    body(blob([8, 46], [10, 37], [17, 32], [31, 32], [38, 37], [40, 46]), GREY),
    body(ell(14, 19, 2.2, 3), SKIN),
    body(ell(34, 19, 2.2, 3), SKIN),
    body(blob([14, 20], [15, 10], [24, 5.5], [33, 10], [34, 20], [31, 29], [24, 33], [17, 29]), SKIN),
    stroke('M17 14.5L21.5 13M26.5 13L31 14.5', INK, 1.3),
    ...dots(19.5, 28.5, 17.5, 0.9),
    stroke('M18 19.5Q19.5 20.5 21 19.5M27 19.5Q28.5 20.5 30 19.5', INK, 0.9),
    paint(blob([29.5, 21], [30.5, 23.5], [29.5, 25.5], [28.5, 23.5]), SKY),
    stroke('M24 19L23 23L24.5 23.4', INK, 0.9),
    stroke('M20.5 27.5Q24 25.8 27.5 27.5', INK, 1.2),
  ],
  // The Scream, after Munch: hands on its face, the sky swirling behind.
  voltmoth: [
    stroke('M2 13Q8 7 14 12Q20 17 24 11', ORANGE, 2.2),
    stroke('M28 8Q34 3 38 9Q42 14 47 9', ORANGE, 2.2),
    stroke('M1 20Q6 17 10 21', RED, 1.6),
    stroke('M38 19Q42 16 47 19', RED, 1.6),
    body(blob([10, 46], [13, 36], [19, 30], [29, 30], [35, 36], [38, 46], [24, 44]), '#2d3561'),
    ...cord('M17 32Q13 27 15 21', '#2d3561', 2.2),
    ...cord('M31 32Q35 27 33 21', '#2d3561', 2.2),
    body(blob([17, 9], [24, 4], [31, 9], [32.5, 19], [29, 28], [24, 31], [19, 28], [15.5, 19]), CREAM),
    body(ell(15.5, 19, 2.6, 3.8), CREAM),
    body(ell(32.5, 19, 2.6, 3.8), CREAM),
    paint(ell(21, 14.5, 1.5, 2.3), INK),
    paint(ell(27, 14.5, 1.5, 2.3), INK),
    paint(ell(23, 19.5, 0.5, 0.7), INK),
    paint(ell(25, 19.5, 0.5, 0.7), INK),
    body(ell(24, 24.5, 2, 3), INK),
  ],
  // A capybara, completely unbothered, orange on its head.
  sporecat: [
    body(ell(14.5, 20, 2.6, 2.2), DARK_BROWN),
    body(ell(33.5, 20, 2.6, 2.2), DARK_BROWN),
    body(blob([8, 39], [10, 27], [17, 19.5], [31, 19.5], [38, 27], [40, 39], [34, 45], [14, 45]), BROWN),
    body(ell(24, 14.5, 5.5, 5), ORANGE),
    body(blob([24, 9.5], [27.5, 6], [29.5, 8.8]), GREEN),
    paint(ell(24, 33, 7.5, 5), '#9a6440'),
    paint(ell(22, 31.5, 0.9, 0.7), INK),
    paint(ell(26, 31.5, 0.9, 0.7), INK),
    ...dots(18.5, 29.5, 26.2, 0.8),
    stroke('M16.5 25L20.5 25M27.5 25L31.5 25', INK, 1.3),
    stroke('M22 36L26 36', INK, 1.1),
  ],
  // The war snail from the margins of medieval manuscripts, and it's angry.
  prismfly: [
    body(blob([6, 45], [7.5, 40.5], [22, 39], [37, 38.5], [41.5, 42], [40.5, 45.5]), '#9fb08a'),
    ...cord('M37 25L35 15', '#9fb08a', 1.6),
    ...cord('M41.5 25L44 15', '#9fb08a', 1.6),
    paint(ell(35, 14.5, 1.3, 1.3), INK),
    paint(ell(44, 14.5, 1.3, 1.3), INK),
    body(blob([33, 41], [33.5, 30], [36, 24], [42, 23.5], [45, 30], [44.5, 41]), '#9fb08a'),
    stroke('M35.5 28.5L38.5 30M44 28.5L41 30', INK, 1.3),
    ...dots(37.8, 41.8, 31.5, 0.8),
    stroke('M37.5 36Q39.5 34.5 42 36', INK, 1.1),
    body(ell(19, 29, 12.5, 11.5), BROWN),
    stroke('M19 29Q22 26.5 24 29Q24 34 19 34Q13 34 13 28.5Q13 21.5 20 21Q28.5 21 29 29', DARK_BROWN, 1.6),
  ],
  // Bombardiro: a crocodile that is also a bomber plane.
  bytebat: [
    body(poly([7, 28], [3.5, 17], [11, 24]), DARK_GREY),
    body(poly([15, 30], [27, 30], [22, 43]), DARK_GREY),
    body(blob([5, 30], [10, 24.5], [28, 23], [36, 26], [36, 33], [24, 35], [10, 34.5]), '#9aa39a'),
    body(ell(21, 40.5, 3.2, 2), INK),
    body(blob([30, 22], [36, 19.5], [44.5, 24.5], [44.5, 29.5], [36, 32], [30, 31]), GREEN),
    stroke('M36 28L38 29.6L40 28L42 29.6L44 28', WHITE, 1),
    stroke('M35 28L46 28', INK, 1),
    body(ell(35, 20.5, 2.6, 2.6), WHITE),
    paint(ell(35.5, 20.5, 0.8, 0.8), INK),
    body(poly([15, 26], [27, 26], [21, 12]), DARK_GREY),
    paint(ell(21, 21.5, 2, 2), RED),
  ],
  // Tung tung tung: a log with a bat, a stare and no plan.
  ironhog: [
    ...legs(18, 28, 40, DARK_BROWN),
    ...cord('M34 36L42 16.5', '#d9a066', 2.4),
    ...cord('M39 24L42.8 14.5', '#d9a066', 4.4),
    body(rrect(13, 9.5, 20, 32, 7), '#c9925a'),
    body(ell(23, 11.5, 9, 3.2), '#e8c08f'),
    stroke(ell(23, 11.5, 5, 1.6).d, '#9a6a3a', 0.9),
    stroke('M16 21L16 30M30.5 25L30.5 36', '#9a6a3a', 1),
    ...stare(18.5, 27.5, 21, 3.3),
    stroke('M17 31Q23 33.5 29 31', INK, 1.3),
    stroke('M31 30L36 33', INK, 1.6),
  ],
  // Tralalero: a shark in blue sneakers.
  surgeeel: [
    stroke('M18 34L17.5 40.5M30 34L30.5 40.5', INK, 1.8),
    body(rrect(11.5, 39.5, 11, 5, 2.5), BLUE),
    body(rrect(25.5, 39.5, 11, 5, 2.5), BLUE),
    paint(rrect(12, 43, 10, 1.4, 0.7), WHITE),
    paint(rrect(26, 43, 10, 1.4, 0.7), WHITE),
    body(poly([9, 26], [2.5, 19], [4.5, 27.5], [2.5, 34]), STEEL),
    body(poly([21, 14.5], [26.5, 4], [30, 15]), STEEL),
    body(blob([8, 26], [15, 16], [28, 13.5], [38.5, 18], [43, 25.5], [37, 33.5], [24, 36.5], [12, 34]), STEEL),
    paint(blob([13, 28.5], [24, 27], [39, 25], [35, 32], [24, 35], [15, 32.5]), WHITE),
    paint(ell(33, 20.5, 1.1, 1.1), INK),
    stroke('M27 28.6L39 25', INK, 1.2),
    stroke('M28.6 28.2L29.8 29.8L31 27.7L32.2 29.2L33.4 27.1L34.6 28.5', INK, 0.8),
  ],
  // O RLY? A snowy owl, deeply unimpressed.
  mirrorowl: [
    body(ell(10.5, 31, 4.5, 9), GREY),
    body(ell(37.5, 31, 4.5, 9), GREY),
    body(ell(24, 28, 14.5, 16), WHITE),
    paint(ell(18, 36, 1, 0.7), DARK_GREY),
    paint(ell(24, 39, 1, 0.7), DARK_GREY),
    paint(ell(30, 36, 1, 0.7), DARK_GREY),
    paint(ell(21, 42, 1, 0.7), DARK_GREY),
    paint(ell(27, 42, 1, 0.7), DARK_GREY),
    body(ell(18.5, 22, 4.4, 4.4), YELLOW),
    body(ell(29.5, 22, 4.4, 4.4), YELLOW),
    paint(ell(18.5, 22.4, 1.8, 1.8), INK),
    paint(ell(29.5, 22.4, 1.8, 1.8), INK),
    stroke('M13.5 19.5L23.5 19.5M24.5 19.5L34.5 19.5', INK, 1.6),
    body(poly([22.5, 26.5], [25.5, 26.5], [24, 30.5]), INK),
    body(ell(20, 45, 2.6, 1.2), DARK_GREY),
    body(ell(28, 45, 2.6, 1.2), DARK_GREY),
  ],
  // Crab rave: claws up, dead inside.
  acidfrog: [
    stroke('M13.5 37.5L8 42M15 40L11 45M34.5 37.5L40 42M33 40L37 45', INK, 1.6),
    ...cord('M15 31L10 21', RED, 2.2),
    ...cord('M33 31L38 21', RED, 2.2),
    body(blob([4, 17.5], [7.5, 10], [13.5, 13], [11.5, 19], [8, 16.5]), RED),
    body(blob(...mirror([[4, 17.5], [7.5, 10], [13.5, 13], [11.5, 19], [8, 16.5]])), RED),
    stroke('M20 28L19 21.5M28 28L29 21.5', INK, 1.6),
    body(ell(24, 34, 12.5, 8.5), RED),
    body(ell(19, 20, 2.4, 2.4), WHITE),
    body(ell(29, 20, 2.4, 2.4), WHITE),
    paint(ell(19, 20, 0.7, 0.7), INK),
    paint(ell(29, 20, 0.7, 0.7), INK),
    stroke('M20 35L28 35', INK, 1.3),
  ],
  // Doot doot: a skeleton and its trumpet.
  lumihare: [
    ...cord('M22 27L22 37', WHITE, 1.4),
    ...cord('M18.5 29.5L25.5 29.5M18.5 32.5L25.5 32.5M19 35.5L25 35.5', WHITE, 1.1),
    ...cord('M22 37L18 45M22 37L26 45', WHITE, 1.4),
    ...cord('M22 29L15 34', WHITE, 1.2),
    ...cord('M22 29L30 23', WHITE, 1.2),
    body(poly([28, 19.5], [38, 18.5], [45, 13], [45, 26], [38, 21.5], [28, 21.5]), GOLD),
    body(blob([13, 15], [15, 7], [22, 4.5], [29, 7], [31, 15], [28, 21], [26, 26], [18, 26], [16, 21]), WHITE),
    body(ell(18.5, 14, 2.4, 2.8), INK),
    body(ell(25.5, 14, 2.4, 2.8), INK),
    paint(poly([22, 18], [23.2, 20.5], [20.8, 20.5]), INK),
    stroke('M18.5 23.5L26 23.5M20.5 22.5L20.5 25M23 22.5L23 25', INK, 0.9),
  ],
  // Chimpanzini bananini: a chimp in a banana.
  staticfox: [
    body(poly([12.5, 32], [4, 40], [8.5, 45], [16.5, 42]), YELLOW),
    body(poly(...mirror([[12.5, 32], [4, 40], [8.5, 45], [16.5, 42]])), YELLOW),
    body(rrect(22, 4.5, 4, 5.5, 1.5), DARK_BROWN),
    body(blob([12, 43.5], [10, 28], [14, 14], [24, 9], [34, 14], [38, 28], [36, 43.5]), YELLOW),
    body(ell(24, 26, 9.5, 9.5), DARK_BROWN),
    body(ell(14.8, 25.5, 2.4, 3), '#e8c29a'),
    body(ell(33.2, 25.5, 2.4, 3), '#e8c29a'),
    paint(blob([16.5, 26.5], [20, 21], [24, 22.5], [28, 21], [31.5, 26.5], [28, 32.5], [24, 33.5], [20, 32.5]), '#e8c29a'),
    ...dots(20.8, 27.2, 24.8, 0.9),
    paint(ell(23, 28.6, 0.6, 0.5), INK),
    paint(ell(25, 28.6, 0.6, 0.5), INK),
    stroke('M21 31L27 31', INK, 1.1),
  ],
  // Ballerina cappuccina: a ballerina with a coffee cup for a head.
  chromemantis: [
    stroke('M21.5 36.5L20.5 43.5M26.5 36.5L27.5 43.5', INK, 1.6),
    body(ell(20.3, 44.8, 2.2, 1.2), PINK),
    body(ell(27.7, 44.8, 2.2, 1.2), PINK),
    stroke('M20 26Q13.5 21 16.5 15.5M28 26Q34.5 21 31.5 15.5', INK, 1.6),
    body(rrect(19, 23.5, 10, 10, 4), PINK),
    body(blob([9.5, 34], [16, 30], [24, 31.5], [32, 30], [38.5, 34], [32, 37.5], [24, 38.5], [16, 37.5]), PINK),
    ...cord('M32 11.5Q37.5 13 31.2 18.5', WHITE, 1.6),
    body(geom('M15 9L33 9L31 21.5Q24 24.5 17 21.5Z'), WHITE),
    body(ell(24, 9, 9, 2.4), '#8b5a3c'),
    paint(ell(24, 9, 3.2, 1), CREAM),
    ...dots(21, 27, 15, 0.8),
    stroke('M22 18.5L26 18.5', INK, 1),
  ],
  // A moth that has found its lamp, and nothing else matters.
  blightmoth: [
    ...cord('M37 23L37 43.5', DARK_GREY, 1.5),
    body(ell(37, 44.5, 5, 1.6), DARK_GREY),
    paint(ell(37, 25, 7, 2.6), YELLOW, 0.8),
    body(poly([31, 23], [43, 23], [40.5, 13], [33.5, 13]), GOLD),
    body(blob([16, 26], [5, 16], [3, 26], [9, 34], [16, 33]), CREAM),
    body(blob([22, 26], [30, 17.5], [32, 26], [28, 33], [22, 32.5]), CREAM),
    stroke('M17.5 21Q15 14 12 12.5M20.5 21Q23 14 26 12.5', INK, 1.1),
    body(ell(19, 29, 5.6, 9), '#e3dccb'),
    ...stare(17, 21.5, 26, 2.2, 1),
    stroke('M18 32L21 32', INK, 1),
    stroke('M23.5 30L31 26.5', INK, 1.4),
    stroke('M17 38L16 44M21 38L22 44', INK, 1.4),
  ],
  // Um, actually: glasses, buck teeth and one raised finger.
  beamray: [
    body(blob([11, 46], [12, 37], [17, 32.5], [28, 32.5], [33, 37], [34, 46]), SKY),
    stroke('M33 38L37 29', INK, 1.8),
    body(rrect(35.2, 10.5, 3, 14, 1.5), GOLD),
    body(rrect(34, 21.5, 7.5, 7, 2.5), GOLD),
    stroke('M34.5 24.5L39 24.5M34.5 26.8L39 26.8', INK, 0.9),
    body(ell(22.5, 20, 12, 11.5), GOLD),
    body(ell(17.5, 18.5, 4.3, 4.3), WHITE),
    body(ell(27.5, 18.5, 4.3, 4.3), WHITE),
    stroke('M21.8 18.5L23.2 18.5', INK, 1.6),
    ...dots(18.2, 28.2, 18.8, 1),
    stroke('M19.5 26Q22.5 27.5 25.5 26', INK, 1.2),
    body(rrect(20.8, 26.4, 3.4, 3.2, 0.6), WHITE),
    stroke('M22.5 26.6L22.5 29.4', INK, 0.8),
  ],
  // Stonks: Meme Man in a suit, and the line only goes up.
  thunderstag: [
    ...cord('M29 35L34 27L38 30.5L43.5 15.5', GREEN, 2.4),
    body(poly([44.5, 9], [46.5, 17], [40.5, 14.5]), GREEN),
    body(blob([9.5, 44.5], [11.5, 34], [18, 29], [30, 29], [36.5, 34], [38.5, 44.5]), '#2f3a56'),
    paint(poly([20.5, 29], [27.5, 29], [24, 36.5]), WHITE),
    body(poly([23, 30.5], [25, 30.5], [25.8, 38.5], [24, 40.5], [22.2, 38.5]), RED),
    body(ell(24, 18, 9.5, 11.5), '#dfe7ef'),
    ...dots(20.5, 27.5, 17, 1),
    stroke('M19 13.5L22 14M26 14L29 13.5', INK, 1),
    stroke('M22.5 20L24 22.5L22.8 22.8', INK, 0.9),
    stroke('M21.5 25L26.5 25', INK, 1.1),
  ],
  // Brr brr patapim: a tree stump on enormous feet.
  sludgebear: [
    stroke('M18 38L16 42M30 38L32 42', INK, 2),
    body(ell(14, 43.8, 7, 2.8), SKIN),
    body(ell(34, 43.8, 7, 2.8), SKIN),
    body(rrect(11, 14, 26, 26, 8), BROWN),
    stroke('M14.5 22L14.5 33M33.5 20L33.5 30', DARK_BROWN, 1),
    body(blob([8, 18], [12, 8], [20, 4], [30, 5], [38, 10], [40, 18], [32, 21], [24, 19], [16, 21]), LIME),
    ...dots(18.5, 29.5, 25.5, 1.1),
    body(ell(24, 29.5, 3, 2.6), '#d49a6a'),
    stroke('M20 35L28 35', INK, 1.3),
  ],
  // La vaca saturno saturnita: a cow whose body is a ringed planet.
  nullserpent: [
    stroke('M17 38L16 44M23 40L23 45M29 38L31 44', INK, 1.8),
    stroke(ell(24, 32, 21, 4.5).d, DARK_BROWN, 2.4),
    body(ell(24, 31.5, 12, 10), '#e8c07a'),
    stroke('M13 30Q24 33 35 30M14 35Q24 38 34 35', '#c9975a', 1.2),
    stroke('M3.5 31Q24 41 44.5 31', DARK_BROWN, 2.4),
    body(poly([15, 12], [11, 4], [18, 10]), CREAM),
    body(poly(...mirror([[15, 12], [11, 4], [18, 10]])), CREAM),
    body(ell(24, 15, 9, 8), WHITE),
    paint(blob([17, 10], [21, 8.5], [20, 13], [16.5, 14]), INK),
    paint(blob([29, 15], [31.5, 12.5], [32.5, 17], [30, 18]), INK),
    body(ell(24, 20, 5.5, 3.4), PINK),
    paint(ell(22, 20, 0.7, 0.9), INK),
    paint(ell(26, 20, 0.7, 0.9), INK),
    ...dots(20, 28, 14, 0.9),
  ],
  // Galaxy brain: a blank head, and the brain has left the building.
  solaris: [
    stroke('M24 2L24 7M8 8L11.5 11.5M40 8L36.5 11.5M3 22L8 22M45 22L40 22', GOLD, 1.8),
    body(blob([12, 44.5], [11, 32], [13, 20], [24, 11], [35, 20], [37, 32], [36, 44.5]), INDIGO),
    paint(ell(18, 36, 0.8, 0.8), WHITE),
    paint(ell(29, 40, 0.7, 0.7), WHITE),
    paint(ell(31, 31, 0.6, 0.6), WHITE),
    paint(ell(16, 42, 0.6, 0.6), WHITE),
    paint(ell(24, 19, 13.5, 11), SKY, 0.55),
    body(blob([13, 19], [15, 11], [21, 8], [24, 9.5], [27, 8], [33, 11], [35, 19], [30, 25], [24, 26], [18, 25]), PINK),
    stroke('M24 10L24 16M17.5 14Q20 13.5 21 11M30.5 14Q28 13.5 27 11M16 20Q18.5 18.5 20.5 20M32 20Q29.5 18.5 27.5 20', '#d9669b', 1.1),
    paint(ell(24, 33, 1.5, 1), LILAC),
  ],
};

export const CREATURE_ART: Record<string, CreatureArt> = Object.fromEntries(
  Object.entries(DEFINITIONS).map(([id, parts]) => [id, { parts, top: Math.max(0, Math.min(...parts.map((part) => part.box[1]))) }]),
);
