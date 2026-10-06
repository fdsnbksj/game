import { describe, expect, it } from 'vitest';
import { botInput } from '../../src/games/brawl/bot';
import { FIGHTER_IDS, FIGHTERS } from '../../src/games/brawl/fighters';
import { charge, drag, held, idle, press, release, tick, GESTURE, type Gesture } from '../../src/games/brawl/gestures';
import { DODGE, DOWN, HEAVY, JUMP, LEFT, LIGHT, RIGHT, UP, type Input } from '../../src/games/brawl/input';
import { BLAST, PLATFORMS, SUB } from '../../src/games/brawl/stage';
import { hashState, knockback, newMatch, STOCKS, step, type BotLevel, type FighterState, type Match } from '../../src/games/brawl/state';

const duel = (seed = 'test') =>
  newMatch(seed, [
    { fighter: 'knight', bot: 0 },
    { fighter: 'knight', bot: 2 },
  ]);

/** A match with the fighters moved into place. */
function placed(changes: Partial<FighterState>[], seed = 'test'): Match {
  const m = duel(seed);
  return { ...m, fighters: m.fighters.map((f, i) => ({ ...f, ...changes[i] })) };
}

const run = (m: Match, frames: number, inputs: (frame: number) => Input[] = () => []) => {
  for (let i = 0; i < frames; i++) m = step(m, inputs(i));
  return m;
};

/** Seat 0 presses once, then lets go. */
const tapOnce = (bits: Input) => (frame: number) => [frame === 0 ? bits : 0, 0];

describe('Sky Brawl engine', () => {
  it('plays the same fight from the same inputs', () => {
    const script = (frame: number): Input[] => [
      [RIGHT, RIGHT | JUMP, LIGHT, 0, LEFT, HEAVY | RIGHT, DODGE, DOWN][Math.floor(frame / 9) % 8],
      [LEFT, 0, LIGHT | LEFT, JUMP, 0, HEAVY][Math.floor(frame / 7) % 6],
    ];
    const a = run(duel(), 900, script);
    const b = run(duel(), 900, script);
    expect(hashState(a)).toBe(hashState(b));
    // Changes only when the engine does: then bump BRAWL_VERSION and update this.
    expect(hashState(a)).toBe('4dbba123');
  });

  it('keeps every position and speed a whole number', () => {
    let m = newMatch('ints', FIGHTER_IDS.map((fighter) => ({ fighter, bot: 3 as BotLevel })));
    for (let i = 0; i < 3000 && m.winner === null; i++) {
      m = step(m, m.seats.map((_, s) => botInput(m, s)));
      for (const f of m.fighters) for (const value of [f.x, f.y, f.vx, f.vy, f.damage]) expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('stands, runs and jumps on the island', () => {
    let m = run(duel(), 30, () => [RIGHT, 0]);
    expect(m.fighters[0].x).toBeGreaterThan(duel().fighters[0].x);
    expect(m.fighters[0].platform).toBe(0);
    m = run(m, 10, tapOnce(JUMP));
    expect(m.fighters[0].platform).toBe(-1);
    expect(m.fighters[0].y).toBeLessThan(0);
    m = run(m, 120);
    expect(m.fighters[0].platform).toBeGreaterThanOrEqual(0);
  });

  it('lands on a soft ledge from below and drops through it holding down', () => {
    const ledge = PLATFORMS[1];
    const x = ((ledge.left + ledge.right) / 2) * SUB;
    let m = placed([{ x }, { x: 200 * SUB }]);
    m = run(m, 70, tapOnce(JUMP));
    expect(m.fighters[0].platform).toBe(1);
    m = run(m, 4, () => [DOWN, 0]);
    expect(m.fighters[0].platform).toBe(1);
    m = run(m, 60, () => [DOWN, 0]);
    expect(m.fighters[0].platform).toBe(0);
  });

  it('hits only during the active frames, once a swing', () => {
    const move = FIGHTERS.knight.moves.nLight;
    let m = placed([{ x: 0 }, { x: 40 * SUB, facing: -1 }]);
    m = step(m, [LIGHT, 0]);
    for (let i = 1; i < move.startup; i++) {
      m = step(m, [0, 0]);
      expect(m.fighters[1].damage).toBe(0);
    }
    m = run(m, move.active + 2);
    expect(m.fighters[1].damage).toBe(move.damage);
    m = run(m, 40);
    expect(m.fighters[1].damage).toBe(move.damage);
  });

  it('sends a fighter further the more damage they carry', () => {
    const sig = FIGHTERS.knight.moves.sSig;
    expect(knockback(sig, 120, 100)).toBeGreaterThan(knockback(sig, 20, 100));
    expect(knockback(sig, 60, 115)).toBeLessThan(knockback(sig, 60, 90));
    const launch = (damage: number) => {
      let m = placed([{ x: 0 }, { x: 50 * SUB, facing: -1, damage }]);
      m = run(m, 60, tapOnce(HEAVY | RIGHT));
      return m.fighters[1].x;
    };
    expect(launch(100)).toBeGreaterThan(launch(0) + 100 * SUB);
  });

  it('takes a stock past a blast zone, then respawns safe for a moment', () => {
    let m = placed([{}, { x: (BLAST.right - 1) * SUB, y: -200 * SUB, vx: 500, platform: -1, damage: 80 }]);
    m = step(m, [0, 0]);
    const f = m.fighters[1];
    expect(f.stocks).toBe(STOCKS - 1);
    expect(f.damage).toBe(0);
    expect(f.respawn).toBeGreaterThan(0);
    m = run(m, f.respawn);
    expect(m.fighters[1].respawn).toBe(0);
    expect(m.fighters[1].invulnerable).toBeGreaterThan(0);
  });

  it('ends when one fighter is left standing', () => {
    let m = placed([{}, { stocks: 1, x: BLAST.left * SUB - SUB, platform: -1 }]);
    m = step(m, [0, 0]);
    expect(m.winner).toBe(0);
    expect(step(m, [RIGHT, 0])).toBe(m);
  });

  it('dodges through a hit, then waits before dodging again', () => {
    const move = FIGHTERS.knight.moves.nLight;
    let m = placed([{ x: 0 }, { x: 40 * SUB, facing: -1 }]);
    m = step(m, [LIGHT, DODGE]);
    m = run(m, move.startup + move.active + 1);
    expect(m.fighters[1].damage).toBe(0);
    expect(m.fighters[1].dodgeCooldown).toBeGreaterThan(0);
    const cooling = run(m, 12);
    expect(cooling.fighters[1].dodge).toBe(0);
    const again = step(cooling, [0, DODGE]);
    expect(again.fighters[1].dodge).toBe(0);
  });

  it('recovers upward once per trip into the air', () => {
    let m = placed([{ x: 400 * SUB, y: 60 * SUB, platform: -1, airJumps: 0 }, {}]);
    m = step(m, [HEAVY | UP, 0]);
    expect(m.fighters[0].move).toBe('recovery');
    m = run(m, 20);
    expect(m.fighters[0].vy).toBeLessThan(0);
    expect(m.fighters[0].recoveryUsed).toBe(true);
  });

  it('plays every pairing and bot level to a winner', () => {
    for (const level of [1, 2, 3] as BotLevel[]) {
      for (const a of FIGHTER_IDS) {
        for (const b of FIGHTER_IDS) {
          for (const n of [2, 3, 4]) {
            let m = newMatch(`bots:${level}:${a}:${b}:${n}`, Array.from({ length: n }, (_, i) => ({ fighter: i % 2 ? b : a, bot: level })));
            while (m.winner === null && m.frame < 60 * 60 * 8) m = step(m, m.seats.map((_, s) => botInput(m, s)));
            expect(m.winner, `${level} ${a} ${b} ${n}`).not.toBeNull();
            expect(m.fighters[m.winner!].stocks).toBeGreaterThanOrEqual(m.fighters.every((f) => f.stocks === 0) ? 0 : 1);
          }
        }
      }
    }
  });
});

describe('Sky Brawl gestures', () => {
  const at = (g: Gesture, t: number) => tick(g, t).g;

  it('taps for a light attack', () => {
    let g = press(idle(), 1, 100, 500, 0).g;
    const r = release(g, 1, 103, 502, 120);
    expect(r.out).toBe(LIGHT);
    g = r.g;
    expect(g.touch).toBeNull();
  });

  it('runs while dragging sideways, and jumps on an upward drag, once until it comes back', () => {
    let g = press(idle(), 1, 100, 500, 0).g;
    g = drag(g, 1, 140, 500).g;
    expect(held(g)).toBe(RIGHT);
    const up = drag(g, 1, 140, 500 - GESTURE.jump - 5);
    expect(up.out).toBe(JUMP);
    expect(drag(up.g, 1, 140, 500 - GESTURE.jump - 10).out).toBe(0);
    const back = drag(up.g, 1, 140, 500).g;
    expect(drag(back, 1, 140, 500 - GESTURE.jump - 5).out).toBe(JUMP);
  });

  it('flicks for an aimed light attack', () => {
    const g = drag(press(idle(), 1, 100, 500, 0).g, 1, 60, 505).g;
    expect(release(g, 1, 60, 505, 150).out).toBe(LIGHT | LEFT);
    const down = drag(press(idle(), 1, 100, 500, 0).g, 1, 102, 540).g;
    expect(release(down, 1, 102, 540, 150).out).toBe(LIGHT | DOWN);
  });

  it('holds still to charge a heavy, aimed on release', () => {
    let g = press(idle(), 1, 100, 500, 0).g;
    expect(charge(g, GESTURE.holdMs / 2)).toBeCloseTo(0.5);
    g = at(g, GESTURE.holdMs + 10);
    expect(g.touch?.charging).toBe(true);
    g = drag(g, 1, 100, 450).g;
    expect(held(g)).toBe(0);
    expect(release(g, 1, 100, 450, 600).out).toBe(HEAVY | UP);
    const neutral = at(press(idle(), 1, 100, 500, 0).g, GESTURE.holdMs);
    expect(release(neutral, 1, 101, 500, 500).out).toBe(HEAVY);
  });

  it('ignores a second finger, but a missed lift never leaves the stick held', () => {
    let g = drag(press(idle(), 1, 100, 500, 0).g, 1, 160, 500).g;
    expect(press(g, 2, 300, 500, 50).g).toBe(g);
    g = press(g, 1, 100, 500, 900).g;
    expect(held(g)).toBe(0);
  });

  it('dodges on a quick second tap, aimed by a drag', () => {
    let g = release(press(idle(), 1, 100, 500, 0).g, 1, 100, 500, 80).g;
    g = press(g, 2, 104, 498, 200).g;
    const aimed = drag(g, 2, 140, 498);
    expect(aimed.out).toBe(DODGE | RIGHT);
    expect(release(aimed.g, 2, 140, 498, 300).out).toBe(0);
    // No drag: a spot dodge after a moment.
    expect(tick(g, 200 + GESTURE.dodgeAimMs).out).toBe(DODGE);
    // Too slow a second tap is just another light attack.
    const slow = press(release(press(idle(), 1, 100, 500, 0).g, 1, 100, 500, 80).g, 2, 100, 500, 80 + GESTURE.doubleMs + 50).g;
    expect(release(slow, 2, 100, 500, 80 + GESTURE.doubleMs + 120).out).toBe(LIGHT);
  });
});
