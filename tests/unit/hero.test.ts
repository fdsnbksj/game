import { describe, expect, it } from 'vitest';
import { stream } from '../../src/nonogram/rng';
import {
  accuracyPct,
  afterDef,
  FAST_CAP,
  FAST_MAX_TAPS,
  jackpotReels,
  MEMORY_DIGITS,
  memoryNumber,
  resolve,
  seconds,
  SPEED_MAX_MS,
  speedDelay,
  speedPct,
  speedPower,
  stopwatchTarget,
  varyPct,
  WHEEL,
  type Move,
} from '../../src/games/hero/skills';
import { apply, replay, skillOf, start, type HeroState, type Recorded, type Side } from '../../src/games/hero/state';
import { EVERYDAY, HERO_STATS, HERO_TREE, LAST_STAND, type SkillId } from '../../src/games/hero/stats';
import { hashSeed } from '../../src/shared/random';

// Hero Gambit is a game for two friends: every hero the same, every skill at level 1, and the
// game picks each turn's skill.

const plain = HERO_STATS;
const NAMES: [{ name: string }, { name: string }] = [{ name: 'A' }, { name: 'B' }];

describe('every hero', () => {
  it('is the same: 200 HP and every skill at level 1', () => {
    expect(HERO_STATS).toEqual({ hp: 200, def: 0, crit: 5, critDmg: 150 });
    expect([HERO_TREE.stopwatch, HERO_TREE.speed, HERO_TREE.memory, HERO_TREE.fast, HERO_TREE.roulette, HERO_TREE.jackpot]).toEqual([1, 1, 1, 1, 1, 1]);
    expect(start('same', NAMES).hp).toEqual([200, 200]);
  });
});

describe('the skill each turn', () => {
  it('is drawn from the everyday four, and only Roulette or Jackpot at 30 HP or less', () => {
    const seen = new Set<string>();
    const last = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const s = start(`pick${i}`, NAMES);
      seen.add(skillOf(s));
      expect(skillOf(s)).toBe(skillOf(start(`pick${i}`, NAMES)));
      const low: HeroState = { ...s, hp: s.turn === 0 ? [30, 200] : [200, 30] };
      last.add(skillOf(low));
      const notLow: HeroState = { ...s, hp: s.turn === 0 ? [31, 200] : [200, 31] };
      expect(EVERYDAY).toContain(skillOf(notLow));
    }
    expect([...seen].sort()).toEqual([...EVERYDAY].sort());
    expect([...last].sort()).toEqual([...LAST_STAND].sort());
  });

  it('refuses any other skill', () => {
    const s = start('given', NAMES);
    const given = skillOf(s);
    const moves: Move[] = [
      { skill: 'stopwatch', ms: 3000 },
      { skill: 'speed', ms: 200 },
      { skill: 'memory', count: 5 },
      { skill: 'fast', taps: 30 },
      { skill: 'roulette', pick: 3 },
      { skill: 'jackpot' },
    ];
    for (const move of moves) expect(apply(s, move, s.turn) !== null).toBe(move.skill === given);
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
    expect(fast.damage).toBe(Math.floor((Math.floor((speedPower(1) * 150) / 100) * varyPct('sp', 0)) / 100));
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
      expect(perfect.crit).toBe(true);
      expect(perfect.damage).toBe(Math.floor((90 * varyPct(`p${i}`, 0)) / 100)); // 60 power, ×1.5, varied
      const far = resolve({ skill: 'stopwatch', ms: target + 9000 }, HERO_TREE, plain, plain, `p${i}`, 0);
      expect(far.damage).toBeGreaterThan(0);
      expect(far.damage).toBeLessThanOrEqual(10);
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
      else expect(hit.damage).toBeGreaterThanOrEqual(24);
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
    expect(hit(12, 9).damage).toBeGreaterThanOrEqual(72);
    expect([hit(9, 9).damage, hit(8, 9).damage, hit(0).damage]).toEqual([0, 0, 0]);
    expect([hit(MEMORY_DIGITS, 19).crit, hit(MEMORY_DIGITS, 19).damage]).toEqual([true, Math.floor((135 * varyPct('mem', 0)) / 100)]);
    expect(hit(5, 4).detail).toEqual({ skill: 'memory', count: 5, theirCount: 4, perfect: false, won: true });
  });

  it('scores Fast as Fuck by how many taps more: 5 each, up to 100', () => {
    const hit = (taps: number, theirs?: number, seed = 'tap') => resolve({ skill: 'fast', taps }, HERO_TREE, plain, plain, seed, 0, theirs);
    expect([hit(30, 30).damage, hit(20, 30).damage, hit(0).damage]).toEqual([0, 0, 0]);
    expect(hit(31, 30).detail).toEqual({ skill: 'fast', taps: 31, theirTaps: 30, won: true });
    for (let i = 0; i < 200; i++) {
      const seed = `tap${i}`;
      const small = hit(32, 30, seed);
      const big = hit(FAST_MAX_TAPS, 0, seed);
      const vary = varyPct(seed, 0);
      expect(small.damage).toBe(Math.floor(((small.crit ? 15 : 10) * vary) / 100));
      expect(big.damage).toBe(Math.floor(((big.crit ? FAST_CAP * 1.5 : FAST_CAP) * vary) / 100));
    }
  });

  it('spins three Jackpot reels: three alike kills, a pair hits double (80), else nothing', () => {
    const tally = { three: 0, pair: 0, none: 0 };
    for (let i = 0; i < 6000; i++) {
      const seed = `j${i}`;
      const hit = resolve({ skill: 'jackpot' }, HERO_TREE, plain, plain, seed, 0);
      if (hit.detail.skill !== 'jackpot') throw new Error();
      expect(hit.detail.reels).toEqual(jackpotReels(seed, 0));
      const kinds = new Set(hit.detail.reels).size;
      expect([hit.detail.three, hit.detail.pair, hit.kill]).toEqual([kinds === 1, kinds === 2, kinds === 1]);
      if (kinds === 1) tally.three++;
      else if (kinds === 2) {
        tally.pair++;
        expect(hit.damage).toBe(Math.floor(((hit.crit ? 120 : 80) * varyPct(seed, 0)) / 100));
      } else {
        tally.none++;
        expect(hit.damage).toBe(0);
      }
    }
    // Six symbols: 1/36 three alike, 15/36 a pair.
    expect(Math.abs(tally.three / 6000 - 1 / 36)).toBeLessThan(0.01);
    expect(Math.abs(tally.pair / 6000 - 15 / 36)).toBeLessThan(0.03);
  });

  it('varies every hit’s damage from 80% to 120%', () => {
    const pcts = Array.from({ length: 3000 }, (_, i) => varyPct(`v${i}`, i % 7));
    expect([Math.min(...pcts), Math.max(...pcts)]).toEqual([80, 120]);
  });

  it('lets DEF soften every hit but never to nothing', () => {
    expect([afterDef(100, 0), afterDef(100, 20), afterDef(1, 20), afterDef(0, 20)]).toEqual([100, 83, 1, 0]);
  });
});

/** A random legal move for whoever's turn it is. */
function randomMove(s: HeroState, roll: (n: number) => number): Move {
  const p = s.pending?.move;
  if (p?.skill === 'memory') return { skill: 'recall', count: roll(MEMORY_DIGITS + 1) };
  if (p?.skill === 'fast') return { skill: 'tapback', taps: 20 + roll(31) };
  if (p?.skill === 'stopwatch') return { skill: 'answer', ms: stopwatchTarget(s.seed, s.log.length) + roll(2001) - 1000 };
  if (p) return { skill: 'answer', ms: roll(10) === 0 ? -1 : 120 + roll(500) };
  const skill = skillOf(s);
  if (skill === 'jackpot') return { skill };
  if (skill === 'fast') return { skill, taps: 20 + roll(31) };
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

/** The first seed from `prefix` whose first turn gets `skill` (Roulette and Jackpot at 30 HP). */
function given(skill: SkillId, prefix: string): HeroState {
  for (let i = 0; ; i++) {
    const s = start(`${prefix}${i}`, NAMES);
    const low: HeroState = LAST_STAND.includes(skill) ? { ...s, hp: [30, 30] } : s;
    if (skillOf(low) === skill) return low;
  }
}

describe('a fight', () => {
  it('takes turns and refuses moves out of turn or out of range', () => {
    const s = given('stopwatch', 'turns');
    const other = (s.turn === 0 ? 1 : 0) as Side;
    expect(apply(s, { skill: 'stopwatch', ms: 1000 }, other)).toBeNull();
    expect(apply(s, { skill: 'stopwatch', ms: -5 }, s.turn)).toBeNull();
    const speed = given('speed', 'turns');
    expect(apply(speed, { skill: 'speed', ms: SPEED_MAX_MS + 1 }, speed.turn)).toBeNull();
    const fast = given('fast', 'turns');
    expect(apply(fast, { skill: 'fast', taps: FAST_MAX_TAPS + 1 }, fast.turn)).toBeNull();
    expect(apply(fast, { skill: 'fast', taps: -1 }, fast.turn)).toBeNull();
    const roulette = given('roulette', 'turns');
    expect(apply(roulette, { skill: 'roulette', pick: WHEEL }, roulette.turn)).toBeNull();
    const next = apply(roulette, { skill: 'roulette', pick: 3 }, roulette.turn)!;
    expect([next.turn, next.log.length]).toEqual([roulette.turn === 0 ? 1 : 0, 1]);
  });

  it('waits after Fast as Fuck for the defender’s own taps', () => {
    let s = given('fast', 'taps');
    const attacker = s.turn;
    const defender = (attacker === 0 ? 1 : 0) as Side;
    s = apply(s, { skill: 'fast', taps: 40 }, attacker)!;
    expect([s.pending, s.turn, s.log.length]).toEqual([{ by: attacker, move: { skill: 'fast', taps: 40 } }, defender, 0]);
    expect(apply(s, { skill: 'recall', count: 3 }, defender)).toBeNull();
    expect(apply(s, { skill: 'tapback', taps: 3 }, attacker)).toBeNull();
    const done = apply(s, { skill: 'tapback', taps: 35 }, defender)!;
    expect([done.log[0].by, done.log[0].skill, done.log[0].detail]).toEqual([attacker, 'fast', { skill: 'fast', taps: 40, theirTaps: 35, won: true }]);
    expect(done.hp[defender]).toBe(200 - done.log[0].damage);
    expect([done.pending, done.turn]).toEqual([null, defender]);
  });

  it('waits after Memory for the defender’s own count', () => {
    let s = given('memory', 'digits');
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
    let s = given('stopwatch', 'race');
    const attacker = s.turn;
    const defender = (attacker === 0 ? 1 : 0) as Side;
    const target = stopwatchTarget(s.seed, 0);
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

    const speed = given('speed', 'race');
    const race = (mine: number, theirs: number) => {
      const a = apply(speed, { skill: 'speed', ms: mine }, speed.turn)!;
      return apply(a, { skill: 'answer', ms: theirs }, a.turn)!.log[0];
    };
    expect(race(200, 250).damage).toBeGreaterThan(0);
    expect(race(200, -1).damage).toBeGreaterThan(0);
    expect(race(250, 200).damage).toBe(0);
    expect(race(200, 200).damage).toBe(0);
    expect(race(-1, -1).damage).toBe(0);
  });

  it('gives Roulette or Jackpot once the attacker is at 30 HP or less', () => {
    for (let i = 0; i < 200; i++) {
      const { state } = fightOut(`stand${i}`);
      let s = start(`stand${i}`, NAMES);
      for (const turn of state.log) {
        const low = s.hp[turn.by] <= 30;
        expect(LAST_STAND.includes(turn.skill)).toBe(low);
        s = { ...s, hp: [...s.hp] as [number, number] };
        s.hp[turn.by === 0 ? 1 : 0] = turn.kill ? 0 : Math.max(0, s.hp[turn.by === 0 ? 1 : 0] - turn.damage);
      }
    }
  });

  it('always ends, and replays the same from the same moves, skipping refused ones', () => {
    for (let i = 0; i < 200; i++) {
      const { state, moves } = fightOut(`f${i}`);
      expect(state.winner).not.toBeNull();
      const noisy = [{ by: 'eve', move: moves[0].move }, { by: IDS[state.turn], move: { skill: 'tapback', taps: 1 } as Move }, ...moves];
      const again = replay(`f${i}`, NAMES, IDS, noisy);
      expect([again.hp, again.winner]).toEqual([state.hp, state.winner]);
    }
  });

  it('tells which side’s move it refused (a phone on another version)', () => {
    const s = given('stopwatch', 'stale');
    const attacker = IDS[s.turn];
    const defender = IDS[s.turn === 0 ? 1 : 0];
    const refused: Side[] = [];
    // An older phone took the Stopwatch as played and went on with a skill of its own.
    replay(s.seed, NAMES, IDS, [{ by: attacker, move: { skill: 'stopwatch', ms: 3000 } }, { by: defender, move: { skill: 'roulette', pick: 1 } }], (side) => refused.push(side));
    expect(refused).toEqual([s.turn === 0 ? 1 : 0]);
  });

  it('comes out the same as when it was written (golden hash)', () => {
    const results = Array.from({ length: 40 }, (_, i) => {
      const { state } = fightOut(`golden${i}`);
      return `${state.winner}:${state.hp.join(',')}:${state.log.length}`;
    });
    expect(hashSeed(results.join('|'))).toBe(3460064540);
  });
});
