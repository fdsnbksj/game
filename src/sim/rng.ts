import { createRandom, hashSeed } from '../shared/random';

/**
 * Seeded integers in [0, n). Every random choice in the game comes from a named stream
 * like `${runSeed}:shop:3:0`, so any part of a run can be replayed on its own.
 */
export type Rng = (n: number) => number;

export function stream(name: string): Rng {
  const next = createRandom(hashSeed(name));
  return (n) => Math.floor(next() * n);
}
