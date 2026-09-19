// Every creature as plain shapes on a 48x48 grid. Phaser bakes them into textures
// (src/game/battle/textures.ts) and CreatureChip draws them as SVG, so the creature in
// the shop is exactly the one on the board.

export type Shape =
  | { type: 'circle'; x: number; y: number; r: number; color: number }
  | { type: 'ellipse'; x: number; y: number; width: number; height: number; color: number }
  | { type: 'polygon'; points: number[]; color: number }
  | { type: 'rect'; x: number; y: number; width: number; height: number; color: number }
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number; width: number; color: number };

export const CREATURE_SIZE = 48;

const INK = 0x10131a;
const WHITE = 0xffffff;

// Origin palettes.
const VOLT = 0xffd23f;
const VOLT_DARK = 0xe0a810;
const CYAN = 0x36e2ff;
const GLITCH = 0xff3df0;
const GLITCH_DARK = 0xb8229f;
const LIME = 0x5cff87;
const CHROME = 0xc9d4e8;
const CHROME_DARK = 0x7d8aa8;
const STEEL = 0x4a5878;

const circle = (x: number, y: number, r: number, color: number): Shape => ({ type: 'circle', x, y, r, color });
const ellipse = (x: number, y: number, width: number, height: number, color: number): Shape => ({ type: 'ellipse', x, y, width, height, color });
const polygon = (color: number, ...points: number[]): Shape => ({ type: 'polygon', points, color });
const rect = (x: number, y: number, width: number, height: number, color: number): Shape => ({ type: 'rect', x, y, width, height, color });
const line = (x1: number, y1: number, x2: number, y2: number, width: number, color: number): Shape => ({ type: 'line', x1, y1, x2, y2, width, color });
/** A white eye with a pupil looking slightly forward. */
const eye = (x: number, y: number, r = 4): Shape[] => [circle(x, y, r, WHITE), circle(x + r * 0.25, y + r * 0.1, r * 0.5, INK)];

export const CREATURE_SHAPES: Record<string, readonly Shape[]> = {
  sparkmouse: [
    polygon(CYAN, 36, 34, 46, 26, 40, 32, 47, 20),
    circle(14, 14, 7, VOLT), circle(34, 14, 7, VOLT),
    circle(14, 14, 4, 0xff9ec7), circle(34, 14, 4, 0xff9ec7),
    circle(24, 28, 14, VOLT),
    ...eye(19, 25), ...eye(29, 25),
    circle(24, 32, 2, 0xff6fa8),
  ],
  chromeshell: [
    line(18, 18, 16, 10, 2, CHROME_DARK), line(30, 18, 32, 10, 2, CHROME_DARK),
    circle(7, 26, 6, CHROME_DARK), circle(41, 26, 6, CHROME_DARK),
    ellipse(24, 30, 34, 22, CHROME),
    rect(10, 30, 28, 3, CHROME_DARK),
    ...eye(16, 9, 3.5), ...eye(32, 9, 3.5),
  ],
  glitchtoad: [
    ellipse(24, 32, 36, 22, LIME),
    circle(15, 18, 7, LIME), circle(33, 18, 7, LIME),
    ...eye(15, 17, 4.5), ...eye(33, 17, 4.5),
    rect(12, 30, 4, 4, GLITCH), rect(30, 34, 4, 4, GLITCH), rect(22, 38, 3, 3, GLITCH),
    line(17, 28, 31, 28, 2, 0x2f9e55),
  ],
  voltmoth: [
    polygon(CYAN, 22, 22, 3, 8, 6, 30), polygon(CYAN, 26, 22, 45, 8, 42, 30),
    polygon(0x1fa9c4, 22, 26, 8, 40, 20, 34), polygon(0x1fa9c4, 26, 26, 40, 40, 28, 34),
    ellipse(24, 26, 10, 24, VOLT),
    line(22, 15, 17, 5, 1.5, VOLT_DARK), line(26, 15, 31, 5, 1.5, VOLT_DARK),
    ...eye(21.5, 19, 2.5), ...eye(26.5, 19, 2.5),
  ],
  bytebat: [
    polygon(0x5b2270, 20, 22, 2, 14, 6, 24, 1, 30, 18, 32),
    polygon(0x5b2270, 28, 22, 46, 14, 42, 24, 47, 30, 30, 32),
    polygon(GLITCH, 15, 16, 17, 6, 22, 14), polygon(GLITCH, 33, 16, 31, 6, 26, 14),
    circle(24, 25, 11, GLITCH),
    ...eye(19.5, 22, 3.5), ...eye(28.5, 22, 3.5),
    polygon(WHITE, 20, 30, 22, 30, 21, 34), polygon(WHITE, 26, 30, 28, 30, 27, 34),
  ],
  ironhog: [
    polygon(CHROME_DARK, 11, 16, 14, 8, 18, 15), polygon(CHROME_DARK, 37, 16, 34, 8, 30, 15),
    ellipse(24, 28, 38, 28, CHROME_DARK),
    ellipse(24, 32, 16, 11, CHROME),
    circle(21, 32, 1.8, STEEL), circle(27, 32, 1.8, STEEL),
    polygon(WHITE, 14, 34, 12, 26, 17, 32), polygon(WHITE, 34, 34, 36, 26, 31, 32),
    ...eye(17, 22, 3), ...eye(31, 22, 3),
  ],
  surgeeel: [
    circle(9, 36, 5, 0x1fa9c4), circle(15, 31, 6, CYAN), circle(22, 30, 7, CYAN),
    circle(29, 26, 8, CYAN), circle(34, 18, 9, CYAN),
    circle(15, 31, 1.6, VOLT), circle(22, 30, 1.8, VOLT), circle(29, 26, 2, VOLT),
    polygon(VOLT, 34, 8, 38, 3, 37, 10),
    ...eye(37, 16, 3.5),
    line(39, 22, 43, 21, 1.5, INK),
  ],
  mirrorowl: [
    polygon(CHROME_DARK, 11, 16, 13, 4, 19, 13), polygon(CHROME_DARK, 37, 16, 35, 4, 29, 13),
    ellipse(24, 28, 30, 36, CHROME),
    ellipse(24, 34, 18, 16, WHITE),
    circle(17, 20, 7, WHITE), circle(31, 20, 7, WHITE),
    circle(17, 20, 4.5, 0x4aa3ff), circle(31, 20, 4.5, 0x4aa3ff),
    circle(17.5, 20, 2, INK), circle(31.5, 20, 2, INK),
    polygon(0xffa42b, 22, 25, 26, 25, 24, 30),
  ],
  staticfox: [
    polygon(GLITCH_DARK, 30, 40, 46, 30, 42, 42),
    polygon(GLITCH, 8, 6, 18, 16, 10, 20), polygon(GLITCH, 40, 6, 30, 16, 38, 20),
    polygon(GLITCH, 8, 14, 40, 14, 24, 40),
    polygon(WHITE, 14, 26, 34, 26, 24, 40),
    polygon(LIME, 15, 20, 21, 21, 16, 23), polygon(LIME, 33, 20, 27, 21, 32, 23),
    circle(24, 37, 2.2, INK),
  ],
  chromemantis: [
    polygon(CHROME, 4, 12, 16, 20, 14, 24, 6, 18), polygon(CHROME, 44, 12, 32, 20, 34, 24, 42, 18),
    ellipse(24, 34, 12, 22, 0x7fd6a8),
    polygon(0x7fd6a8, 14, 10, 34, 10, 24, 24),
    line(19, 11, 14, 3, 1.5, CHROME_DARK), line(29, 11, 34, 3, 1.5, CHROME_DARK),
    circle(17, 13, 3.5, LIME), circle(31, 13, 3.5, LIME),
    circle(17.5, 13.5, 1.5, INK), circle(31.5, 13.5, 1.5, INK),
  ],
  thunderstag: [
    line(17, 16, 9, 4, 2.5, CYAN), line(12, 9, 6, 9, 2, CYAN), line(14, 12, 9, 15, 2, CYAN),
    line(31, 16, 39, 4, 2.5, CYAN), line(36, 9, 42, 9, 2, CYAN), line(34, 12, 39, 15, 2, CYAN),
    ellipse(24, 36, 30, 18, VOLT_DARK),
    ellipse(24, 24, 18, 22, VOLT),
    ellipse(24, 32, 10, 7, 0xfff1b0),
    circle(22, 32, 1.4, INK), circle(26, 32, 1.4, INK),
    ...eye(19, 22, 3), ...eye(29, 22, 3),
  ],
  nullserpent: [
    ellipse(24, 39, 40, 14, 0x3a1450),
    ellipse(24, 37, 30, 8, 0x4d1a6b),
    polygon(0x4d1a6b, 17, 38, 31, 38, 30, 20, 20, 20),
    ellipse(25, 17, 28, 20, 0x5b2270),
    ellipse(25, 15, 16, 13, 0x7a2f99),
    circle(21, 14, 2.8, GLITCH), circle(29, 14, 2.8, GLITCH),
    circle(21.5, 14, 1.1, WHITE), circle(29.5, 14, 1.1, WHITE),
    line(25, 21, 25, 26, 1.2, LIME), line(25, 26, 23, 28, 1, LIME), line(25, 26, 27, 28, 1, LIME),
    circle(12, 39, 1.6, LIME), circle(36, 39, 1.6, LIME), circle(18, 30, 1.4, LIME), circle(30, 30, 1.4, LIME),
  ],
};
