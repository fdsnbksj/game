import { describe, expect, it } from 'vitest';
import { hashSeed } from '../../src/shared/random';
import { stream } from '../../src/nonogram/rng';
import {
  advance,
  aim,
  GAME_TICKS,
  loopAt,
  MISS_COST,
  newGame,
  PIG_SPEC,
  simulate,
  sortThrows,
  step,
  swingAngle,
  winner,
  type PigState,
  type Throw,
} from '../../src/games/pigs/sim';

/** The first tick from `from` at which seat's throw would catch something, by trying each. */
function catchingThrow(seed: string, seat: number, from: number, earlier: Throw[] = []): { tick: number; state: PigState } {
  for (let t = from; t < from + 600; t++) {
    const throws = [...earlier, { seat, tick: t }];
    const state = simulate(seed, throws, t + 200);
    const mine = state.catches.filter((c) => c.seat === seat);
    if (mine.length > earlier.filter((e) => e.seat === seat).length && mine.at(-1)!.points > 0) return { tick: t, state };
  }
  throw new Error('no catch found');
}

describe('the swing', () => {
  it('stays within ±70° and points each seat at the other', () => {
    for (let t = 0; t < 400; t++) {
      for (const seat of [0, 1]) {
        const angle = swingAngle('s', seat, t);
        expect(Math.abs(angle)).toBeLessThanOrEqual(1.22 + 1e-9);
        const [dx, dy] = aim(seat, angle);
        expect(dx * dx + dy * dy).toBeCloseTo(1, 6);
        expect(seat === 0 ? dy < 0 : dy > 0).toBe(true);
      }
    }
  });
});

describe('the pen', () => {
  it('starts with pigs, and keeps some coming', () => {
    const state = newGame('pen');
    expect(state.pigs.length).toBe(4);
    const later = simulate('pen', [], 1800);
    expect(later.pigs.length).toBeGreaterThan(2);
    expect(later.nextPig).toBeGreaterThan(8);
  });

  it('has black pigs faster than pink ones', () => {
    expect(PIG_SPEC.black.speed).toBeGreaterThan(PIG_SPEC.pink.speed * 2);
    expect(PIG_SPEC.black.value).toBeGreaterThan(PIG_SPEC.pink.value);
  });
});

describe('throwing', () => {
  it('a throw that meets a pig brings it back for its points', () => {
    const { state } = catchingThrow('catch', 0, 10);
    const last = state.catches.at(-1)!;
    expect(last.points).toBe(PIG_SPEC[last.kind!].value);
    expect(state.scores[0]).toBe(last.points);
    expect(state.lassos[0].mode).toBe('swing');
  });

  it('an empty lasso costs points', () => {
    // Some tick among the first few hundred throws into empty grass.
    let missed: PigState | null = null;
    for (let t = 0; t < 300 && !missed; t++) {
      const state = simulate('miss', [{ seat: 1, tick: t }], t + 200);
      if (state.catches.length === 1 && state.catches[0].points < 0) missed = state;
    }
    expect(missed).not.toBeNull();
    expect(missed!.scores[1]).toBe(-MISS_COST);
  });

  it('a throw while the lasso is out is ignored', () => {
    const one = simulate('busy', [{ seat: 0, tick: 5 }], 300);
    const two = simulate('busy', [{ seat: 0, tick: 5 }, { seat: 0, tick: 8 }], 300);
    expect(two).toEqual(one);
  });

  it('a pig held by one lasso can’t be taken by the other', () => {
    const state = simulate('held', [], 0);
    for (let t = 0; t < 600; t++) {
      const s = simulate('held', [{ seat: 0, tick: 3 }, { seat: 1, tick: t }], 400);
      const ids = s.catches.map((c) => c.seat);
      expect(ids.filter((x) => x === 0).length).toBeLessThanOrEqual(1);
    }
    expect(state.tick).toBe(0);
  });

  it('nothing happens after the minute', () => {
    const state = simulate('end', [{ seat: 0, tick: GAME_TICKS - 1 }, { seat: 1, tick: GAME_TICKS + 5 }]);
    expect(state.tick).toBe(GAME_TICKS);
    const after = structuredClone(state);
    step(after, [{ seat: 1, tick: GAME_TICKS }]);
    expect(after).toEqual(state);
  });
});

describe('replays', () => {
  const randomThrows = (seed: string): Throw[] => {
    const r = stream(`${seed}:throws`);
    const throws: Throw[] = [];
    for (const seat of [0, 1]) for (let t = r(60); t < GAME_TICKS; t += 20 + r(120)) throws.push({ seat, tick: t });
    return throws;
  };

  it('come out the same whatever order the throws arrive in', () => {
    for (let g = 0; g < 20; g++) {
      const throws = randomThrows(`order${g}`);
      const shuffled = [...throws].reverse();
      expect(simulate(`order${g}`, shuffled)).toEqual(simulate(`order${g}`, throws));
    }
  });

  it('stepping as time passes matches playing it all at once', () => {
    const throws = sortThrows(randomThrows('steps'));
    const live = newGame('steps');
    for (let t = 0; t <= GAME_TICKS; t += 7) advance(live, throws, t);
    advance(live, throws, GAME_TICKS);
    expect(live).toEqual(simulate('steps', throws));
  });

  it('200 random games finish with scores that add up', () => {
    for (let g = 0; g < 200; g++) {
      const state = simulate(`random${g}`, randomThrows(`random${g}`));
      expect(state.tick).toBe(GAME_TICKS);
      for (const seat of [0, 1]) expect(state.scores[seat]).toBe(state.catches.filter((c) => c.seat === seat).reduce((sum, c) => sum + c.points, 0));
      expect(state.catches.some((c) => c.points > 0)).toBe(true);
      expect([0, 1, null]).toContain(winner(state));
      for (const seat of [0, 1]) expect(Number.isFinite(loopAt(state, seat)[0])).toBe(true);
    }
  });

  it('match the golden game (change it, and PIGS_VERSION, only when games would replay differently)', () => {
    const state = simulate('golden', randomThrows('golden'));
    expect(hashSeed(JSON.stringify(state))).toBe(1296386072);
  });
});
