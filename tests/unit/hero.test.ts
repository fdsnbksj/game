import { describe, expect, it } from 'vitest';
import { stream } from '../../src/nonogram/rng';
import {
  accuracyPct,
  afterDef,
  MEMORY_DIGITS,
  memoryNumber,
  resolve,
  seconds,
  SPEED_MAX_MS,
  speedDelay,
  speedPct,
  speedPower,
  stopwatchTarget,
  WHEEL,
  type Move,
} from '../../src/games/hero/skills';
import { apply, ready, replay, start, type HeroState, type Recorded, type Side } from '../../src/games/hero/state';
import { HERO_STATS, HERO_TREE } from '../../src/games/hero/stats';
import { hashSeed } from '../../src/shared/random';

// Hero Gambit is a game for two friends: every hero the same, all four skills at level 1.

const plain = HERO_STATS;
const NAMES: [{ name: string }, { name: string }] = [{ name: 'A' }, { name: 'B' }];

describe('every hero', () => {
  it('is the same: 200 HP and all four skills at level 1', () => {
    expect(HERO_STATS).toEqual({ hp: 200, def: 0, crit: 5, critDmg: 150 });
    expect([HERO_TREE.stopwatch, HERO_TREE.speed, HERO_TREE.memory, HERO_TREE.roulette]).toEqual([1, 1, 1, 1]);
    const s = start('same', NAMES);
    expect(s.hp).toEqual([200, 200]);
    expect(ready(s, 0)).toEqual(['stopwatch', 'speed', 'memory', 'roulette']);
  });
});

describe('the skills', () => {
  it('waits 1.50 to 4.50 s for I’m Speed’s light, and pays for a quick tap', () => {
    const waits = Array.from({ length: 2000 }, (_, i) => speedDelay(`w${i}`, 0));
    expect(Math.min(...waits)).toBeGreaterThanOrEqual(1500);
    expect(Math.max(...waits)).toBeLessThanOrEqual(4500);
    expect([-1, 0, 150, 155, 250, 600, 5000].map(speedPct)).toEqual([0, 100, 100, 99, 80, 10, 10]);
    const fast = resolve({ skill: 'speed', ms: 140 }, HERO_TREE, plain, plain, 'sp', 0);
    expect(fast.crit).toBe(true);
    expect(fast.damage).toBe(Math.floor((speedPower(1) * 150) / 100));
    const early = resolve({ skill: 'speed', ms: -1 }, HERO_TREE, plain, plain, 'sp', 0);
    expect([early.damage, early.crit]).toEqual([0, false]);
  });

  it('picks a stopwatch target from 1.00 to 10.00 s, and scales damage with how close the stop was', () => {
    for (let i = 0; i < 2000; i++) {
      const t = stopwatchTarget(`s${i}`, 0);
      expect(t % 10).toBe(0);
      expect(t).toBeGreaterThanOrEqual(1000);
      expect(t).toBeLessThanOrEqual(10_000);
    }
    expect([1230, 1000, 10_000, 4050].map(seconds)).toEqual(['1.23', '1.00', '10.00', '4.05']);
    expect([0, 100, 1000, 5000].map(accuracyPct)).toEqual([100, 95, 50, 10]);
    for (let i = 0; i < 50; i++) {
      const target = stopwatchTarget(`p${i}`, 0);
      const perfect = resolve({ skill: 'stopwatch', ms: target + 30 }, HERO_TREE, plain, plain, `p${i}`, 0);
      expect([perfect.crit, perfect.damage]).toEqual([true, 90]); // 60 power, ×1.5
      const far = resolve({ skill: 'stopwatch', ms: target + 9000 }, HERO_TREE, plain, plain, `p${i}`, 0);
      expect(far.damage).toBeGreaterThan(0);
      expect(far.damage).toBeLessThanOrEqual(9);
    }
  });

  it('rolls one roulette ball: an instant kill on the pick, a punch otherwise', () => {
    let hits = 0;
    for (let i = 0; i < 6000; i++) {
      const hit = resolve({ skill: 'roulette', pick: 7 }, HERO_TREE, plain, plain, `r${i}`, 0);
      if (hit.detail.skill !== 'roulette') throw new Error();
      expect(hit.detail.balls).toHaveLength(1);
      expect(hit.kill).toBe(hit.detail.balls.includes(7));
      if (hit.kill) hits++;
      else expect(hit.damage).toBeGreaterThanOrEqual(30);
    }
    expect(Math.abs(hits / 6000 - 1 / WHEEL)).toBeLessThan(0.01);
  });

  it('draws 20 digits to remember, another number for the defender, and a win doing 90 (all 20 a sure crit)', () => {
    for (let i = 0; i < 50; i++) {
      const n = memoryNumber(`m${i}`, i % 5);
      expect(n).toMatch(/^[0-9]{20}$/);
      expect(memoryNumber(`m${i}`, i % 5)).toBe(n);
      expect(memoryNumber(`m${i}`, i % 5, true)).not.toBe(n);
    }
    const hit = (count: number, theirs?: number) => resolve({ skill: 'memory', count }, HERO_TREE, plain, plain, 'mem', 0, theirs);
    expect(hit(12, 9).damage).toBeGreaterThanOrEqual(90);
    expect([hit(9, 9).damage, hit(8, 9).damage, hit(0).damage]).toEqual([0, 0, 0]);
    expect([hit(MEMORY_DIGITS, 19).crit, hit(MEMORY_DIGITS, 19).damage]).toEqual([true, 135]);
    expect(hit(5, 4).detail).toEqual({ skill: 'memory', count: 5, theirCount: 4, perfect: false, won: true });
  });

  it('lets DEF soften every hit but never to nothing', () => {
    expect([afterDef(100, 0), afterDef(100, 20), afterDef(1, 20), afterDef(0, 20)]).toEqual([100, 83, 1, 0]);
  });
});

/** A random legal move for whoever's turn it is. */
function randomMove(s: HeroState, roll: (n: number) => number): Move {
  const p = s.pending?.move;
  if (p?.skill === 'memory') return { skill: 'recall', count: roll(MEMORY_DIGITS + 1) };
  if (p?.skill === 'stopwatch') return { skill: 'answer', ms: stopwatchTarget(s.seed, s.log.length) + roll(2001) - 1000 };
  if (p) return { skill: 'answer', ms: roll(10) === 0 ? -1 : 120 + roll(500) };
  const choices = ready(s, s.turn);
  if (!choices.length) return { skill: 'rest' };
  const skill = choices[roll(choices.length)];
  if (skill === 'stopwatch') return { skill, ms: stopwatchTarget(s.seed, s.log.length) + roll(2001) - 1000 };
  if (skill === 'speed') return { skill, ms: roll(10) === 0 ? -1 : 120 + roll(500) };
  if (skill === 'roulette') return { skill, pick: roll(WHEEL) };
  return { skill, count: roll(MEMORY_DIGITS + 1) };
}

const IDS = ['a', 'b'] as const;

/** A fight played to the end with random moves, and the moves as recorded. */
function fightOut(seed: string): { state: HeroState; moves: Recorded[] } {
  const roll = stream(`${seed}:test`);
  let state = start(seed, NAMES);
  const moves: Recorded[] = [];
  for (let i = 0; i < 400 && state.winner === null; i++) {
    const by = state.turn;
    const move = randomMove(state, roll);
    state = apply(state, move, by)!;
    expect(state).not.toBeNull();
    moves.push({ by: IDS[by], move });
  }
  return { state, moves };
}

describe('a fight', () => {
  it('takes turns and refuses moves out of turn or out of range', () => {
    const s = start('turns', NAMES);
    const other = (s.turn === 0 ? 1 : 0) as Side;
    expect(apply(s, { skill: 'stopwatch', ms: 1000 }, other)).toBeNull();
    expect(apply(s, { skill: 'stopwatch', ms: -5 }, s.turn)).toBeNull();
    expect(apply(s, { skill: 'speed', ms: SPEED_MAX_MS + 1 }, s.turn)).toBeNull();
    expect(apply(s, { skill: 'rest' }, s.turn)).toBeNull();
    const next = apply(s, { skill: 'roulette', pick: 3 }, s.turn)!;
    expect([next.turn, next.log.length]).toEqual([other, 1]);
  });

  it('waits after Memory for the defender’s own count', () => {
    let s = start('digits', NAMES);
    const attacker = s.turn;
    const defender = (attacker === 0 ? 1 : 0) as Side;
    expect(apply(s, { skill: 'memory', count: 21 }, attacker)).toBeNull();
    expect(apply(s, { skill: 'memory', count: 2.5 }, attacker)).toBeNull();
    s = apply(s, { skill: 'memory', count: 7 }, attacker)!;
    expect([s.pending, s.turn, s.log.length]).toEqual([{ by: attacker, move: { skill: 'memory', count: 7 } }, defender, 0]);
    expect(apply(s, { skill: 'answer', ms: 100 }, defender)).toBeNull();
    expect(apply(s, { skill: 'recall', count: 3 }, attacker)).toBeNull();
    expect(apply(s, { skill: 'stopwatch', ms: 1000 }, defender)).toBeNull();
    expect(apply(s, { skill: 'recall', count: -1 }, defender)).toBeNull();
    const done = apply(s, { skill: 'recall', count: 3 }, defender)!;
    const t = done.log[0];
    expect([t.by, t.detail]).toEqual([attacker, { skill: 'memory', count: 7, theirCount: 3, perfect: false, won: true }]);
    expect([done.pending, done.turn]).toEqual([null, defender]);
  });

  it('lets the defender have their own go at Stopwatch and I’m Speed; only a better one hits', () => {
    let s = start('race', NAMES);
    const attacker = s.turn;
    const defender = (attacker === 0 ? 1 : 0) as Side;
    const target = stopwatchTarget('race', 0);
    s = apply(s, { skill: 'stopwatch', ms: target + 100 }, attacker)!;
    expect([s.pending, s.turn, s.log.length]).toEqual([{ by: attacker, move: { skill: 'stopwatch', ms: target + 100 } }, defender, 0]);
    expect(apply(s, { skill: 'recall', count: 1 }, defender)).toBeNull();
    expect(apply(s, { skill: 'answer', ms: -1 }, defender)).toBeNull();
    const closer = apply(s, { skill: 'answer', ms: target - 40 }, defender)!;
    expect([closer.log[0].by, closer.log[0].damage, closer.turn, closer.hp[defender]]).toEqual([attacker, 0, defender, 200]);
    const tie = apply(s, { skill: 'answer', ms: target - 100 }, defender)!;
    expect(tie.log[0].damage).toBe(0);
    const worse = apply(s, { skill: 'answer', ms: target + 300 }, defender)!;
    expect(worse.log[0].damage).toBeGreaterThan(0);
    expect(worse.log[0].detail).toMatchObject({ skill: 'stopwatch', theirMs: target + 300, won: true });

    const race = (mine: number, theirs: number) => {
      const a = apply(start('race', NAMES), { skill: 'speed', ms: mine }, attacker)!;
      return apply(a, { skill: 'answer', ms: theirs }, defender)!.log[0];
    };
    expect(race(200, 250).damage).toBeGreaterThan(0);
    expect(race(200, -1).damage).toBeGreaterThan(0);
    expect(race(250, 200).damage).toBe(0);
    expect(race(200, 200).damage).toBe(0);
    expect(race(-1, -1).damage).toBe(0);
  });

  it('rests each skill for its cooldown in your own turns, and rests only when all four are', () => {
    let s: HeroState = { ...start('cool', NAMES), turn: 0 };
    s = apply(s, { skill: 'roulette', pick: 36 }, 0)!;
    expect(s.cooldowns[0]).toEqual({ roulette: 3 });
    s = apply(apply(s, { skill: 'stopwatch', ms: 0 }, 1)!, { skill: 'answer', ms: 0 }, 0)!;
    s = apply(apply(s, { skill: 'speed', ms: 300 }, 0)!, { skill: 'answer', ms: 300 }, 1)!;
    s = apply(apply(s, { skill: 'stopwatch', ms: 0 }, 1)!, { skill: 'answer', ms: 0 }, 0)!;
    expect(apply(s, { skill: 'roulette', pick: 1 }, 0)).toBeNull();
    expect(apply(s, { skill: 'rest' }, 0)).toBeNull(); // the stopwatch never rests
    s = apply(s, { skill: 'memory', count: 4 }, 0)!;
    s = apply(s, { skill: 'recall', count: 1 }, 1)!;
    expect(s.cooldowns[0]).toEqual({ roulette: 1, memory: 2 });
  });

  it('always ends, and replays the same from the same moves, skipping refused ones', () => {
    for (let i = 0; i < 200; i++) {
      const { state, moves } = fightOut(`f${i}`);
      expect(state.winner).not.toBeNull();
      const noisy = [{ by: 'eve', move: moves[0].move }, { by: IDS[state.turn], move: { skill: 'rest' } as Move }, ...moves];
      const again = replay(`f${i}`, NAMES, IDS, noisy);
      expect([again.hp, again.winner]).toEqual([state.hp, state.winner]);
    }
  });

  it('tells which side’s move it refused (a phone on another version)', () => {
    const s = start('stale', NAMES);
    const attacker = IDS[s.turn];
    const defender = IDS[s.turn === 0 ? 1 : 0];
    const refused: Side[] = [];
    // An older phone took the Stopwatch as played and went on with a skill of its own.
    replay('stale', NAMES, IDS, [{ by: attacker, move: { skill: 'stopwatch', ms: 3000 } }, { by: defender, move: { skill: 'roulette', pick: 1 } }], (side) => refused.push(side));
    expect(refused).toEqual([s.turn === 0 ? 1 : 0]);
  });

  it('comes out the same as when it was written (golden hash)', () => {
    const results = Array.from({ length: 40 }, (_, i) => {
      const { state } = fightOut(`golden${i}`);
      return `${state.winner}:${state.hp.join(',')}:${state.log.length}`;
    });
    expect(hashSeed(results.join('|'))).toBe(3529283593);
  });
});
