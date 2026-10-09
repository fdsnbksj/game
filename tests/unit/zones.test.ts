import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ZONES } from '../../src/screens/world/zones';

// The world map and its zones are hidden for now (home is Hero Gambit), but kept whole.
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

  it('reopens only on Hero Gambit while the other games are hidden', () => {
    const lastPage = readFileSync(new URL('../../src/lastPage.ts', import.meta.url), 'utf8');
    const pages = lastPage.match(/const PAGES = (\/.*\/);/)![1];
    for (const hidden of ['nonograms', 'avalon', 'duel', 'wonders', 'isle', 'brawl', 'zone']) expect(pages).not.toContain(hidden);
    expect(pages).toContain('hero');
  });
});
