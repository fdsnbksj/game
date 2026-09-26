import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DAILY_SIZE, NONOGRAM_VERSION, sizeFor } from '../../src/nonogram/generate';

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

  it('has the same daily size', () => {
    expect(Number(body('dailySize'))).toBe(DAILY_SIZE);
  });

  it('grows grids with the level the same way', () => {
    // The rules' conditional is valid JavaScript too, so evaluate it as written.
    const rulesSize = new Function('level', `return ${body('sizeFor')};`) as (level: number) => number;
    for (let level = 1; level <= 200; level++) expect(rulesSize(level), `level ${level}`).toBe(sizeFor(level));
  });
});
