import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ZONES } from '../../src/screens/world/zones';

// Home lists every game from the zones; the map itself is unrouted but kept whole.
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

  it('reopens on every game now that they all show', () => {
    const lastPage = readFileSync(new URL('../../src/lastPage.ts', import.meta.url), 'utf8');
    const pages = new RegExp(lastPage.match(/const PAGES = \/(.*)\/;/)![1]);
    for (const path of ['/nonograms', '/avalon/ABCD', '/duel', '/wonders/ABCD', '/isle', '/brawl/online', '/hero', '/hero/local', '/hero/ABCD', '/account'])
      expect(pages.test(path)).toBe(true);
    for (const path of ['/zone/keep', '/hero/abcd', '/elsewhere']) expect(pages.test(path)).toBe(false);
  });
});
