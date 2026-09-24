import { getItem } from '../sim/balance';

// One glyph per item on a 24x24 grid. ItemChip draws them as SVG and the board bakes the
// same paths into textures, so an item looks the same in the bag and on a creature.

export const ITEM_GLYPHS: Record<string, string> = {
  heavy_plate: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z',
  razor_fang: 'M12 2l5 9-5 11-5-11z',
  volt_coil: 'M13 2L5 13h5l-1 9 8-11h-5z',
  mirror_shard: 'M12 2l7 10-7 10-7-10z',
  mana_cell: 'M9 2h6v3h3v14H6V5h3z',
  siphon_core: 'M12 21C7 17 4 14 4 10a4 4 0 017-2.6A4 4 0 0120 10c0 4-3 7-8 11z',
};

const INK = '#1c1c1e';
const WHITE = '#ffffff';

export const hexColor = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** The item's own colour for the tile, and whichever of ink or white reads on it. */
export function itemColors(itemId: string): { tile: string; glyph: string } {
  const color = getItem(itemId).color;
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return { tile: hexColor(color), glyph: luminance > 0.6 ? INK : WHITE };
}
