import { getItem } from '../sim/balance';
import { ITEM_GLYPHS, itemColors } from '../shared/itemGlyphs';

/** An item on a tile of its own colour, so they're told apart at a glance. */
export function ItemChip({ itemId, size = 22 }: { itemId: string; size?: number }) {
  const item = getItem(itemId);
  const { tile, glyph } = itemColors(itemId);
  return (
    <svg className="item-chip" viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={item.name}>
      <rect x="1" y="1" width="22" height="22" rx="6" fill={tile} className="item-chip-tile" />
      <path d={ITEM_GLYPHS[itemId]} fill={glyph} transform="translate(4.8 4.8) scale(0.6)" />
    </svg>
  );
}
