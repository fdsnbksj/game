import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ARENA_UNLOCK, MAX_DELTA, MIN_GAIN } from '../../src/games/hero/arena';
import { BOT_COUNT, pointsFor } from '../../src/games/hero/stats';
import { NONOGRAM_VERSION, sizeFor } from '../../src/nonogram/generate';

// firestore.rules keeps its own copies of a few numbers from src/nonogram. This fails if
// they drift apart, which would make the rules refuse honest solves.

const rules = readFileSync('firestore.rules', 'utf8');

/** The expression a rules function returns: `function name(args) { return <expr>; }`. */
function body(name: string): string {
  const match = rules.match(new RegExp(`function ${name}\\([^)]*\\)\\s*\\{\\s*return ([\\s\\S]*?);\\s*\\}`));
  if (!match) throw new Error(`firestore.rules has no function ${name}()`);
  return match[1];
}

describe('firestore.rules matches src/nonogram', () => {
  it('has the same generator version', () => {
    expect(Number(body('nonogramVersion'))).toBe(NONOGRAM_VERSION);
  });

  it('grows grids with the level the same way', () => {
    // The rules' conditional is valid JavaScript too, so evaluate it as written.
    const rulesSize = new Function('level', `return ${body('sizeFor')};`) as (level: number) => number;
    for (let level = 1; level <= 200; level++) expect(rulesSize(level), `level ${level}`).toBe(sizeFor(level));
  });
});

describe('firestore.rules matches src/games/hero', () => {
  it('gives the same skill points for the levels cleared', () => {
    const rulesPoints = new Function('cleared', 'math', `return ${body('heroPoints')};`) as (cleared: number, math: { floor: (x: number) => number }) => number;
    for (let cleared = 0; cleared <= BOT_COUNT; cleared++) expect(rulesPoints(cleared, Math), `cleared ${cleared}`).toBe(pointsFor(cleared));
  });

  it('has the same number of bot levels', () => {
    expect(Number(body('heroBotCount'))).toBe(BOT_COUNT);
  });

  it('opens the arena and caps a result the same way', () => {
    expect(Number(body('arenaUnlock'))).toBe(ARENA_UNLOCK);
    expect(Number(body('arenaMaxDelta'))).toBe(MAX_DELTA);
    expect(Number(body('arenaMinGain'))).toBe(MIN_GAIN);
  });
});
