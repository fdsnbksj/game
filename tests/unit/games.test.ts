import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAMES } from '../../src/screens/world/games';

describe('the list of games', () => {
  const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');

  it('lists every game once', () => {
    const ids = GAMES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(['avalon', 'beads', 'bluff', 'glide', 'gridlock', 'hero', 'lanterns', 'nonograms', 'pipes', 'sky', 'threads', 'vault', 'wonders']);
  });

  it('sends every game to a route that exists', () => {
    for (const game of GAMES) expect(app).toContain(`path="${game.path}"`);
  });

  it('reopens on every game now that they all show', () => {
    const lastPage = readFileSync(new URL('../../src/lastPage.ts', import.meta.url), 'utf8');
    const pages = new RegExp(lastPage.match(/const PAGES = \/(.*)\/;/)![1]);
    for (const path of ['/nonograms', '/avalon/ABCD', '/wonders/ABCD', '/hero', '/hero/local', '/hero/ABCD', '/sky', '/sky/play', '/beads', '/beads/play', '/glide', '/glide/play', '/pipes', '/pipes/play', '/lanterns', '/lanterns/play', '/threads', '/threads/play', '/vault', '/vault/play', '/gridlock', '/gridlock/play', '/bluff', '/bluff/ABCD', '/account'])
      expect(pages.test(path)).toBe(true);
    for (const path of ['/zone/keep', '/brawl', '/brawl/ABCD', '/hero/abcd', '/elsewhere']) expect(pages.test(path)).toBe(false);
  });
});
