import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ZONES } from '../../src/screens/world/zones';

describe('the world map', () => {
  const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');

  it('puts every game in exactly one zone', () => {
    const ids = ZONES.flatMap((z) => z.games.map((g) => g.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(['avalon', 'brawl', 'duel', 'hero', 'isle', 'nonograms', 'wonders']);
  });

  it('sends every game to a route that exists, and has a route for the zones', () => {
    for (const zone of ZONES) for (const game of zone.games) expect(app).toContain(`path="${game.path}"`);
    expect(app).toContain('path="/zone/:id"');
  });

  it('reopens on a zone', () => {
    const lastPage = readFileSync(new URL('../../src/lastPage.ts', import.meta.url), 'utf8');
    for (const zone of ZONES) expect(lastPage).toContain(zone.id);
  });
});
