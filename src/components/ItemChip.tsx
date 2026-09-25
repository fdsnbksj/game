import { getItem } from '../sim/balance';
import { ITEM_SIZE, itemParts } from '../shared/itemArt';
import { PartSvg } from './CreatureChip';

/** An item on a tile of its own colour, so they're told apart at a glance. */
export function ItemChip({ itemId, size = 22 }: { itemId: string; size?: number }) {
  return (
    <svg className="item-chip" viewBox={`0 0 ${ITEM_SIZE} ${ITEM_SIZE}`} width={size} height={size} role="img" aria-label={getItem(itemId).name}>
      {itemParts(itemId).map((part, i) => (
        <PartSvg key={i} part={part} />
      ))}
    </svg>
  );
}
