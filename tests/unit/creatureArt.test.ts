import { describe, expect, it } from 'vitest';
import { CREATURE_ART, CREATURE_SIZE } from '../../src/shared/creatureArt';
import { UNITS } from '../../src/sim/balance';

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
});
