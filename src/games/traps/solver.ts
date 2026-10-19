import { JUMP, LEFT, RIGHT, RUN_TICKS, spawn, step, type Runner } from './sim';
import type { World } from './world';

// A search for a way up a tower: breadth first over short held inputs, merging runners that
// stand in nearly the same place moving nearly the same way. Used by the tests to prove a
// tower can be climbed; slow enough that the screens don't use it.

const HOLD = 6;
const MOVES = [0, LEFT, RIGHT, JUMP, LEFT | JUMP, RIGHT | JUMP];

const key = (r: Runner) => `${r.x >> 5},${r.y >> 5},${r.vx >> 2},${r.vy >> 3},${r.held ? 1 : 0},${r.on ? 1 : 0},${r.tick % 150}`;

/** Inputs that take a runner from the start to the flag, or null if none was found. `timed` keeps the tick in mind, for towers with saws and arrows. */
export function findClimb(world: World, { timed = false, limit = 400_000 } = {}): number[] | null {
  type Node = { r: Runner; inputs: number[] };
  const seen = new Set<string>();
  let frontier: Node[] = [{ r: spawn(world), inputs: [] }];
  const k = (r: Runner) => (timed ? key(r) : key(r).replace(/,[^,]*$/, ''));
  while (frontier.length && seen.size < limit) {
    const next: Node[] = [];
    for (const { r, inputs } of frontier) {
      for (const m of MOVES) {
        const c = { ...r };
        const more = [...inputs];
        for (let t = 0; t < HOLD && c.status === 'run'; t++) {
          step(world, c, m);
          more.push(m);
        }
        if (c.status === 'flag') return more;
        if (c.status !== 'run' || c.tick >= RUN_TICKS) continue;
        const id = k(c);
        if (seen.has(id)) continue;
        seen.add(id);
        next.push({ r: c, inputs: more });
      }
    }
    frontier = next;
  }
  return null;
}
