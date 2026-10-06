import { describe, expect, it } from 'vitest';
import { botInput } from '../../src/games/brawl/bot';
import { charge, chargeAim, drag, GESTURE, held, idle, press, release, tick, type Gesture } from '../../src/games/brawl/gestures';
import { DOWN, JUMP, LEFT, RIGHT, SKILL1, SKILL2, UP, type Input } from '../../src/games/brawl/input';
import { BLAST, PLATFORMS, SUB } from '../../src/games/brawl/stage';
import { hashState, ITEM_LIFE, knockback, newMatch, STOCKS, step, type BotLevel, type FighterState, type Match } from '../../src/games/brawl/state';
import { WEAPON_FRAMES, WEAPONS } from '../../src/games/brawl/weapons';

const duel = (seed = 'test') => newMatch(seed, [{ bot: 0 }, { bot: 2 }]);

/** A match with the fighters moved into place, and no weapons dropping unless asked. */
function placed(changes: Partial<FighterState>[], extra: Partial<Match> = {}, seed = 'test'): Match {
  const m = duel(seed);
  return { ...m, nextItem: 1e9, ...extra, fighters: m.fighters.map((f, i) => ({ ...f, ...changes[i] })) };
}

const run = (m: Match, frames: number, inputs: (frame: number) => Input[] = () => []) => {
  for (let i = 0; i < frames; i++) m = step(m, inputs(i));
  return m;
};

/** Seat 0 presses once, then lets go. */
const once = (bits: Input) => (frame: number) => [frame === 0 ? bits : 0, 0];

describe('Sky Brawl engine', () => {
  it('plays the same fight from the same inputs', () => {
    const script = (frame: number): Input[] => [
      [RIGHT, RIGHT | JUMP, SKILL1, 0, LEFT, SKILL2 | RIGHT, 0, DOWN, SKILL1 | LEFT, RIGHT][Math.floor(frame / 9) % 10],
      [LEFT, 0, SKILL1 | LEFT, JUMP, 0, SKILL2, LEFT][Math.floor(frame / 7) % 7],
    ];
    const a = run(duel(), 1200, script);
    const b = run(duel(), 1200, script);
    expect(hashState(a)).toBe(hashState(b));
    // Changes only when the engine does: then bump BRAWL_VERSION and update this.
    expect(hashState(a)).toBe('e04ff3b3');
  });

  it('keeps every number whole', () => {
    let m = newMatch('ints', [{ bot: 3 }, { bot: 3 }, { bot: 3 }]);
    for (let i = 0; i < 3000 && m.winner === null; i++) {
      m = step(m, m.seats.map((_, s) => botInput(m, s)));
      for (const f of m.fighters) for (const v of [f.x, f.y, f.vx, f.vy, f.damage]) expect(Number.isInteger(v)).toBe(true);
      for (const p of m.projectiles) for (const v of [p.x, p.y, p.vx, p.vy]) expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('starts everyone bare-handed', () => {
    for (const f of duel().fighters) expect(f.weapon).toBe('fists');
  });

  it('drops weapons from the seed: the same ones, in the same places, on every run', () => {
    const drops = (seed: string) => run(newMatch(seed, [{ bot: 0 }, { bot: 0 }]), 400).items.map((it) => `${it.weapon}@${it.x},${it.y}`);
    expect(drops('a').length).toBeGreaterThan(0);
    expect(drops('a')).toEqual(drops('a'));
    const spread = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((s) => drops(s).join()));
    expect(spread.size).toBeGreaterThan(1);
    // Nobody picks one up: it fades.
    const m = run(newMatch('a', [{ bot: 0 }, { bot: 0 }]), 100);
    const first = m.items[0];
    const later = run({ ...m, nextItem: 1e9 }, ITEM_LIFE);
    expect(later.items).not.toContainEqual(expect.objectContaining({ x: first.x, weapon: first.weapon }));
  });

  it('picks a weapon up on touch, only bare-handed, and it lasts 10 seconds', () => {
    const item = { weapon: 'sword' as const, x: 0, y: 0, age: 0 };
    let m = placed([{ x: 0 }, { x: 200 * SUB }], { items: [item] });
    m = step(m, [0, 0]);
    expect(m.fighters[0].weapon).toBe('sword');
    expect(m.items).toHaveLength(0);
    // Armed, a second weapon is left lying.
    const second = step({ ...m, items: [{ ...item, weapon: 'bow' }] }, [0, 0]);
    expect(second.fighters[0].weapon).toBe('sword');
    expect(second.items).toHaveLength(1);
    m = run(m, WEAPON_FRAMES + 2);
    expect(m.fighters[0].weapon).toBe('fists');
  });

  it('aims a skill at the nearest opponent with no swipe, and the swiped way with one', () => {
    let m = placed([{ x: 0, facing: 1 }, { x: -120 * SUB }]);
    m = step(m, [SKILL1, 0]);
    expect(m.fighters[0].facing).toBe(-1);
    expect([m.fighters[0].aimX, m.fighters[0].aimY]).toEqual([-1, 0]);
    let swiped = placed([{ x: 0, facing: 1 }, { x: -120 * SUB }]);
    swiped = step(swiped, [SKILL1 | UP | RIGHT, 0]);
    expect([swiped.fighters[0].aimX, swiped.fighters[0].aimY]).toEqual([1, -1]);
  });

  it('hits only while the swing is out, once a swing', () => {
    const jab = WEAPONS.fists.skills[0];
    if (jab.kind !== 'melee') throw new Error('fists swing');
    let m = placed([{ x: 0 }, { x: 36 * SUB, facing: -1 }]);
    m = step(m, [SKILL1, 0]);
    for (let i = 1; i < jab.startup; i++) {
      m = step(m, [0, 0]);
      expect(m.fighters[1].damage).toBe(0);
    }
    m = run(m, jab.active + 2);
    expect(m.fighters[1].damage).toBe(jab.damage);
    m = run(m, 40);
    expect(m.fighters[1].damage).toBe(jab.damage);
  });

  it('hits harder with a weapon than with bare hands', () => {
    const hitWith = (weapon: 'fists' | 'hammer') => {
      let m = placed([{ x: 0, weapon, weaponLeft: WEAPON_FRAMES }, { x: 40 * SUB, facing: -1, damage: 60 }]);
      m = run(m, 50, once(SKILL1 | RIGHT));
      return [m.fighters[1].damage, Math.abs(m.fighters[1].x)];
    };
    const [fistDamage, fistX] = hitWith('fists');
    const [hammerDamage, hammerX] = hitWith('hammer');
    expect(hammerDamage).toBeGreaterThan(fistDamage);
    expect(hammerX).toBeGreaterThan(fistX);
  });

  it('shoots an arrow that hits the first fighter it meets and stops', () => {
    let m = placed([{ x: -200 * SUB, weapon: 'bow', weaponLeft: WEAPON_FRAMES }, { x: 100 * SUB, facing: -1 }]);
    m = step(m, [SKILL1 | RIGHT, 0]);
    m = run(m, 10);
    expect(m.projectiles).toHaveLength(1);
    m = run(m, 30);
    expect(m.fighters[1].damage).toBeGreaterThan(0);
    expect(m.projectiles).toHaveLength(0);
  });

  it('lobs a bomb that bounces, then blows up and throws fighters away from it', () => {
    let m = placed([{ x: -150 * SUB, weapon: 'bombs', weaponLeft: WEAPON_FRAMES }, { x: 250 * SUB, facing: -1 }]);
    m = step(m, [SKILL1 | RIGHT, 0]);
    let bounced = false;
    let blew = false;
    for (let i = 0; i < 120 && !blew; i++) {
      const before = m;
      m = step(m, [0, 0]);
      if (before.projectiles[0] && m.projectiles[0] && before.projectiles[0].vy > 0 && m.projectiles[0].vy < 0) bounced = true;
      if (m.blasts.length > 0) blew = true;
    }
    expect(bounced).toBe(true);
    expect(blew).toBe(true);
    // Right on top of a fighter, a bomb hurts and pushes them away.
    const near = placed([{ x: 0 }, { x: 50 * SUB, facing: -1 }], {
      projectiles: [{ kind: 'bomb', owner: 0, x: 40 * SUB, y: -30 * SUB, vx: 0, vy: 0, life: 1, age: 20, hits: 0 }],
    });
    const after = run(near, 2);
    expect(after.fighters[1].damage).toBeGreaterThan(0);
    expect(after.fighters[1].vx).toBeGreaterThan(0);
  });

  it('leaps up with the strong skill aimed up, once per trip into the air', () => {
    let m = placed([{ x: 400 * SUB, y: 60 * SUB, platform: -1, airJumps: 0 }, {}]);
    m = step(m, [SKILL2 | UP, 0]);
    expect(m.fighters[0].vy).toBeLessThan(0);
    expect(m.fighters[0].recoveryUsed).toBe(true);
    m = run(m, 40);
    const vy = m.fighters[0].vy;
    m = step(m, [SKILL2 | UP, 0]);
    expect(m.fighters[0].vy).toBeGreaterThanOrEqual(vy);
  });

  it('jumps, then jumps once more in the air', () => {
    let m = run(placed([{ x: 0 }, { x: 200 * SUB }]), 5, once(JUMP));
    expect(m.fighters[0].platform).toBe(-1);
    m = step(m, [JUMP, 0]);
    expect(m.fighters[0].airJumps).toBe(0);
    m = run(m, 150);
    expect(m.fighters[0].platform).toBeGreaterThanOrEqual(0);
  });

  it('lands on a soft ledge and drops through it holding down', () => {
    const ledge = PLATFORMS[1];
    const x = ((ledge.left + ledge.right) / 2) * SUB;
    let m = placed([{ x }, { x: 200 * SUB }]);
    m = run(m, 70, once(JUMP));
    expect(m.fighters[0].platform).toBe(1);
    m = run(m, 60, () => [DOWN, 0]);
    expect(m.fighters[0].platform).toBe(0);
  });

  it('sends a fighter further the more damage they carry', () => {
    expect(knockback(650, 15, 120)).toBeGreaterThan(knockback(650, 15, 20));
  });

  it('takes a stock past a blast zone, drops the weapon, then respawns safe for a moment', () => {
    let m = placed([{}, { x: (BLAST.right - 1) * SUB, y: -200 * SUB, vx: 500, platform: -1, damage: 80, weapon: 'spear', weaponLeft: 300 }]);
    m = step(m, [0, 0]);
    const f = m.fighters[1];
    expect(f.stocks).toBe(STOCKS - 1);
    expect(f.weapon).toBe('fists');
    expect(f.damage).toBe(0);
    m = run(m, f.respawn);
    expect(m.fighters[1].invulnerable).toBeGreaterThan(0);
  });

  it('ends when one fighter is left standing', () => {
    let m = placed([{}, { stocks: 1, x: BLAST.left * SUB - SUB, platform: -1 }]);
    m = step(m, [0, 0]);
    expect(m.winner).toBe(0);
    expect(step(m, [RIGHT, 0])).toBe(m);
  });

  it('plays every bot level, with one to three bots, to a winner', () => {
    for (const level of [1, 2, 3] as BotLevel[]) {
      for (const n of [2, 3, 4]) {
        for (const s of ['a', 'b']) {
          let m = newMatch(`bots:${level}:${n}:${s}`, Array.from({ length: n }, () => ({ bot: level })));
          while (m.winner === null && m.frame < 60 * 60 * 10) m = step(m, m.seats.map((_, i) => botInput(m, i)));
          expect(m.winner, `${level} ${n} ${s}`).not.toBeNull();
        }
      }
    }
  });
});

describe('Sky Brawl gestures', () => {
  const at = (g: Gesture, t: number) => tick(g, t).g;
  const tap = (g: Gesture, t: number, x = 100, y = 500) => release(press(g, 1, x, y, t).g, 1, x, y, t + 80);

  it('taps to jump', () => {
    const r = tap(idle(), 0);
    expect(r.out).toBe(JUMP);
    expect(r.g.touch).toBeNull();
  });

  it('drags to run and to fall fast, never to jump', () => {
    let g = press(idle(), 1, 100, 500, 0).g;
    g = drag(g, 1, 150, 500).g;
    expect(held(g)).toBe(RIGHT);
    g = drag(g, 1, 150, 560).g;
    expect(held(g) & DOWN).toBeTruthy();
    g = drag(g, 1, 150, 420).g;
    expect(held(g) & UP).toBe(0);
    expect(release(g, 1, 150, 420, 600).out).toBe(0);
  });

  it('double taps for the quick skill, aimed by a swipe on the second tap', () => {
    const first = tap(idle(), 0);
    let g = press(first.g, 2, 104, 498, 150).g;
    const swiped = drag(g, 2, 104, 460);
    expect(swiped.out).toBe(SKILL1 | UP);
    expect(release(swiped.g, 2, 104, 460, 260).out).toBe(0);
    // No swipe: it fires on its own a moment later, for the engine to aim.
    g = press(first.g, 2, 100, 500, 150).g;
    expect(tick(g, 150 + GESTURE.aimMs).out).toBe(SKILL1);
    // Too slow a second tap is just another jump.
    const slow = tap(first.g, 80 + GESTURE.doubleMs + 50);
    expect(slow.out).toBe(JUMP);
  });

  it('holds still to charge the strong skill, aimed by a drag, fired on release', () => {
    let g = press(idle(), 1, 100, 500, 0).g;
    expect(charge(g, GESTURE.holdMs / 2)).toBeCloseTo(0.5);
    g = at(g, GESTURE.holdMs + 10);
    expect(g.touch?.charging).toBe(true);
    expect(chargeAim(g)).toBeNull();
    g = drag(g, 1, 150, 450).g;
    expect(held(g)).toBe(0);
    expect(chargeAim(g)).toEqual([1, -1]);
    expect(release(g, 1, 150, 450, 700).out).toBe(SKILL2 | RIGHT | UP);
    const neutral = at(press(idle(), 1, 100, 500, 0).g, GESTURE.holdMs);
    expect(release(neutral, 1, 101, 500, 500).out).toBe(SKILL2);
  });

  it('ignores a second finger, but a missed lift never leaves the stick held', () => {
    let g = drag(press(idle(), 1, 100, 500, 0).g, 1, 160, 500).g;
    expect(press(g, 2, 300, 500, 50).g).toBe(g);
    g = press(g, 1, 100, 500, 900).g;
    expect(held(g)).toBe(0);
  });
});
