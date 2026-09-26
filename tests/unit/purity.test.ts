import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The sim must give the same result on every device, so it can't use anything whose
// result depends on the device, the clock or the engine.
const FORBIDDEN = [
  /Math\.random/,
  /\bDate\b/,
  /performance\./,
  /Math\.(sin|cos|tan|asin|acos|atan2?|exp|expm1|log\w*|pow|cbrt|hypot)\b/,
  /\bfrom ['"](phaser|react|firebase)/,
];

for (const folder of ['sim', 'nonogram']) {
  describe(`src/${folder}`, () => {
    const dir = new URL(`../../src/${folder}/`, import.meta.url);
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.ts'))) {
      it(`${file} uses only deterministic APIs`, () => {
        const source = readFileSync(new URL(file, dir), 'utf8');
        for (const pattern of FORBIDDEN) expect(source).not.toMatch(pattern);
      });
    }
  });
}
