import { describe, expect, it } from 'vitest';
import { CREATURE_ART, CREATURE_SIZE } from '../../src/shared/creatureArt';
import { ITEMS, UNITS } from '../../src/sim/balance';
import { ITEM_SIZE, itemParts } from '../../src/shared/itemArt';

describe('creature art', () => {
  it('draws every unit, and only units', () => {
    expect(Object.keys(CREATURE_ART).sort()).toEqual(UNITS.map((unit) => unit.id).sort());
  });

  it('keeps every part on the grid, so the outline is never cut off', () => {
    for (const [id, art] of Object.entries(CREATURE_ART)) {
      for (const { box } of art.parts) {
        const inside = box[0] >= 0 && box[1] >= 0 && box[2] <= CREATURE_SIZE && box[3] <= CREATURE_SIZE;
        expect(inside, `${id} ${box.join(',')}`).toBe(true);
      }
    }
  });

  it('draws every item on its tile, inside the grid', () => {
    for (const item of ITEMS) {
      const parts = itemParts(item.id);
      // The tile alone means the item has no drawing.
      expect(parts.length, item.id).toBeGreaterThan(1);
      for (const { box } of parts) {
        const inside = box[0] >= 0 && box[1] >= 0 && box[2] <= ITEM_SIZE && box[3] <= ITEM_SIZE;
        expect(inside, `${item.id} ${box.join(',')}`).toBe(true);
      }
    }
  });
});
