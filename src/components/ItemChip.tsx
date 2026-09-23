import { getItem } from '../sim/balance';

/** A simple glyph per item, so they're told apart at a glance. */
const GLYPHS: Record<string, string> = {
  heavy_plate: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z',
  razor_fang: 'M12 2l5 9-5 11-5-11z',
  volt_coil: 'M13 2L5 13h5l-1 9 8-11h-5z',
  mirror_shard: 'M12 2l7 10-7 10-7-10z',
  mana_cell: 'M9 2h6v3h3v14H6V5h3z',
  siphon_core: 'M12 21C7 17 4 14 4 10a4 4 0 017-2.6A4 4 0 0120 10c0 4-3 7-8 11z',
};

export function ItemChip({ itemId, size = 22 }: { itemId: string; size?: number }) {
  const item = getItem(itemId);
  return (
    <svg className="item-chip" viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={item.name}>
      <rect x="1" y="1" width="22" height="22" rx="6" className="item-chip-tile" />
      <path d={GLYPHS[itemId]} fill="currentColor" />
    </svg>
  );
}
