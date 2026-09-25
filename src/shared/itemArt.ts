import { getItem } from '../sim/balance';
import { body, cord, ell, poly, rrect, stroke, INK, type Part } from './creatureArt';

// Every item as a crude MS Paint meme object on a tile of the item's own colour, on the same
// 48x48 grid and with the same wobbly marker as the creatures. ItemChip draws the parts as
// SVG and the board bakes them into textures, so an item looks the same in the bag and on
// a creature.

export const ITEM_SIZE = 48;

const WHITE = '#ffffff';
const GREY = '#c3c3c3';
const DARK_GREY = '#555555';
const BROWN = '#b97a57';
const GREEN = '#22b14c';
const YELLOW = '#fff200';
const RED = '#ed1c24';

const hexColor = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

const DEFINITIONS: Record<string, Part[]> = {
  // Absolute unit: a dumbbell nobody can lift.
  heavy_plate: [
    body(rrect(9, 21.5, 30, 5, 2), GREY),
    body(rrect(7, 12, 7, 24, 2), DARK_GREY),
    body(rrect(34, 12, 7, 24, 2), DARK_GREY),
    body(rrect(13.5, 15.5, 4.5, 17, 1.5), DARK_GREY),
    body(rrect(30, 15.5, 4.5, 17, 1.5), DARK_GREY),
  ],
  // The ban hammer.
  razor_fang: [
    body(poly([12, 37], [15.5, 40.5], [32, 24], [28.5, 20.5]), BROWN),
    body(poly([20, 15], [29, 6], [42, 19], [33, 28]), GREY),
    stroke('M24.5 10.5L37.5 23.5', INK, 1.6),
  ],
  // Gamer fuel: a can of something green that makes you attack faster.
  volt_coil: [
    body(rrect(14.5, 10, 19, 30, 4), GREEN),
    body(ell(24, 10.5, 9.5, 2.6), GREY),
    stroke('M24 9.5L27.5 8', INK, 1.3),
    body(poly([27, 15], [19, 27], [24, 27], [21, 36], [30, 23], [25, 23], [28, 15]), YELLOW),
  ],
  // A tin foil hat: armour against everything.
  mirror_shard: [
    body(poly([11, 35], [24, 7], [37, 35]), GREY),
    stroke('M17 27L21 24L19 21M28 16L31 20L27 23M23 31L27 29L30 32', WHITE, 1.3),
    stroke('M20 17L23 19M26 27L24 30', DARK_GREY, 1.1),
    body(ell(24, 36, 17, 4.2), GREY),
  ],
  // Copium: breathe it in before the fight.
  mana_cell: [
    ...cord('M27 12Q39 8 37 21', DARK_GREY, 1.8),
    body(ell(36, 23, 4.5, 3.4), WHITE),
    body(rrect(20.5, 7.5, 7, 6, 1.5), GREY),
    body(rrect(14, 12.5, 20, 28, 7), GREEN),
    body(rrect(17, 21, 14, 9, 2), WHITE),
    stroke('M22 25.5L26 25.5', INK, 1.4),
  ],
  // Yoink: a magnet for other people's health.
  siphon_core: [
    ...cord('M16 14L16 26Q16 36 24 36Q32 36 32 26L32 14', RED, 6),
    body(rrect(11.5, 8, 9, 6.5, 1.2), WHITE),
    body(rrect(27.5, 8, 9, 6.5, 1.2), WHITE),
    stroke('M38 30L42 28M38 35L43 36M36 39.5L39 43', INK, 1.4),
  ],
};

/** The tile in the item's colour, then the object on it. */
export function itemParts(itemId: string): Part[] {
  return [body(rrect(3, 3, 42, 42, 8), hexColor(getItem(itemId).color)), ...(DEFINITIONS[itemId] ?? [])];
}
