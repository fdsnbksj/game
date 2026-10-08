import { describe, expect, it } from 'vitest';
import { botInput } from '../../src/games/brawl/bot';
import { BUTTON_BITS, knob, STICK, stickBits } from '../../src/games/brawl/controls';
import { DODGE, DOWN, JUMP, LEFT, RIGHT, SKILL1, SKILL2, UP, type Input } from '../../src/games/brawl/input';
import { moverAt, STAGES, SUB } from '../../src/games/brawl/stages';
import {
  CRACK,
  GONE,
  hashState,
  ICE_BASE,
  ICE_LIFE,
  ITEM_LIFE,
  MAX_CHARGE,
  newMatch,
  ROUND_BREAK,
  ROUNDS_TO_WIN,
  step,
  surface,
  windAt,
  type BotLevel,
  type FighterState,
  type Match,
} from '../../src/games/brawl/state';
import { KICK, MAX_HP, PICKUPS, PROJECTILES, WEAPONS, type WeaponId } from '../../src/games/brawl/weapons';

const stageIndex = (id: string) => STAGES.findIndex((s) => s.id === id);

/** A two-fighter match on a chosen stage, both standing on its main ground, nothing dropping. */
function on(id: string, changes: Partial<FighterState>[] = [], extra: Partial<Match> = {}): Match {
  let m = newMatch('test', [{ bot: 0 }, { bot: 2 }]);
  const stage = stageIndex(id);
  m = { ...m, order: [stage, stage, stage, stage, stage, stage], stage };
  const plats = STAGES[stage].platforms;
  const ground = plats.findIndex((p) => !p.soft);
  const y = plats[ground].top * SUB;
  return {
    ...m,
    crumble: plats.map(() => 0),
    nextItem: 1e9,
    items: [],
    ...extra,
    fighters: m.fighters.map((f, i) => ({ ...f, y, platform: ground, x: (i === 0 ? -40 : 40) * SUB, ...changes[i] })),
  };
}

/** The main island stage, for most tests. */
const flat = (changes: Partial<FighterState>[] = [], extra: Partial<Match> = {}) => on('gusts', changes, { ...extra, frame: 0 });

const run = (m: Match, frames: number, inputs: (frame: number) => Input[] = () => []) => {
  for (let i = 0; i < frames; i++) m = step(m, inputs(i));
  return m;
};

/** Seat 0 presses once, then lets go. */
const once = (bits: Input) => (frame: number) => [frame === 0 ? bits : 0, 0];
const armed = (weapon: WeaponId) => ({ weapon, ammo: WEAPONS[weapon].ammo });

describe('Stick Brawl engine', () => {
  it('plays the same fight from the same inputs', () => {
    const script = (frame: number): Input[] => [
      [RIGHT, RIGHT | JUMP, SKILL1, 0, LEFT, SKILL2 | RIGHT, 0, DOWN, SKILL1 | LEFT, RIGHT][Math.floor(frame / 9) % 10],
      [LEFT, 0, SKILL1 | LEFT, JUMP, 0, SKILL2, LEFT][Math.floor(frame / 7) % 7],
    ];
    const a = run(newMatch('golden', [{ bot: 0 }, { bot: 0 }]), 1200, script);
    const b = run(newMatch('golden', [{ bot: 0 }, { bot: 0 }]), 1200, script);
    expect(hashState(a)).toBe(hashState(b));
    // Changes only when the engine does: then bump BRAWL_VERSION and update this.
    expect(hashState(a)).toBe('d901687d');
  });

  it('keeps every number whole', () => {
    let m = newMatch('ints', [{ bot: 3 }, { bot: 3 }, { bot: 3 }]);
    for (let i = 0; i < 4000 && m.winner === null; i++) {
      m = step(m, m.seats.map((_, s) => botInput(m, s)));
      for (const f of m.fighters) for (const v of [f.x, f.y, f.vx, f.vy, f.hp]) expect(Number.isInteger(v)).toBe(true);
      for (const p of m.projectiles) for (const v of [p.x, p.y, p.vx, p.vy, p.damage]) expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('starts every round with full HP and bare hands, on solid ground', () => {
    for (let s = 0; s < 24; s++) {
      const m = newMatch(`start${s}`, [{ bot: 0 }, { bot: 0 }, { bot: 0 }, { bot: 0 }]);
      for (const f of m.fighters) {
        expect(f.hp).toBe(MAX_HP);
        expect(f.weapon).toBe('fists');
        expect(f.platform).toBeGreaterThanOrEqual(0);
      }
      // Standing still for a second, nobody falls.
      const later = run(m, 60);
      for (const f of later.fighters) expect(f.alive).toBe(true);
    }
  });

  it('plays every stage in a seeded order, each once before any repeats', () => {
    const m = newMatch('order', [{ bot: 0 }, { bot: 0 }]);
    expect([...m.order].sort((a, b) => a - b)).toEqual(STAGES.map((_, i) => i));
    expect(newMatch('order', [{ bot: 0 }, { bot: 0 }]).order).toEqual(m.order);
  });

  it('takes HP with each hit, and at 0 HP the fighter is out', () => {
    const jab = WEAPONS.fists.attack;
    let m = flat([{ x: 0 }, { x: 36 * SUB, facing: -1 }]);
    m = run(m, 20, once(SKILL1 | RIGHT));
    expect(m.fighters[1].hp).toBe(MAX_HP - (jab.kind === 'melee' ? jab.damage : 0));
    let low = flat([{ x: 0 }, { x: 36 * SUB, facing: -1, hp: 3 }]);
    low = run(low, 20, once(SKILL1 | RIGHT));
    expect(low.fighters[1].alive).toBe(false);
    expect(low.fighters[0].kos).toBe(1);
  });

  it('is out past the edge of the world', () => {
    const blast = STAGES[stageIndex('gusts')].blast;
    let m = flat([{}, { x: (blast.right - 1) * SUB, y: -200 * SUB, vx: 500, platform: -1 }]);
    m = step(m, [0, 0]);
    expect(m.fighters[1].alive).toBe(false);
  });

  it('gives the round to the last one standing, then starts the next on the next stage', () => {
    let m = flat([{ x: 0 }, { hp: 1, x: 36 * SUB, facing: -1 }]);
    m = run(m, 20, once(SKILL1 | RIGHT));
    expect(m.wins).toEqual([1, 0]);
    expect(m.between).toBeGreaterThan(0);
    m = run(m, ROUND_BREAK);
    expect(m.round).toBe(1);
    expect(m.fighters.every((f) => f.alive && f.hp === MAX_HP && f.weapon === 'fists')).toBe(true);
    expect(m.items).toHaveLength(0);
  });

  it('wins the match at three rounds', () => {
    let m = flat([{ x: 0 }, { hp: 1, x: 36 * SUB, facing: -1 }], { wins: [ROUNDS_TO_WIN - 1, 0] });
    m = run(m, 20, once(SKILL1 | RIGHT));
    m = run(m, ROUND_BREAK);
    expect(m.winner).toBe(0);
    expect(step(m, [RIGHT, 0])).toBe(m);
  });

  it('drops weapons from the seed, every kind given time, picked up by touch when bare-handed', () => {
    const seen = new Set<string>();
    for (let s = 0; s < 30 && seen.size < PICKUPS.length; s++) {
      let m = newMatch(`drops:${s}`, [{ bot: 0 }, { bot: 0 }]);
      for (let f = 0; f < 3000; f++) {
        m = step(m, [0, 0]);
        for (const it of m.items) seen.add(it.weapon);
      }
    }
    expect([...seen].sort()).toEqual([...PICKUPS].sort());
    const item = { weapon: 'pistol' as const, x: -40 * SUB, y: 0, age: 0 };
    let m = flat([], { items: [item] });
    m = step(m, [0, 0]);
    expect(m.fighters[0].weapon).toBe('pistol');
    expect(m.fighters[0].ammo).toBe(WEAPONS.pistol.ammo);
    const fades = run(flat([{ x: 200 * SUB }, { x: 250 * SUB }], { items: [item] }), ITEM_LIFE + 1);
    expect(fades.items).toHaveLength(0);
  });

  it('spends ammo, and the Attack after the last shot throws the gun', () => {
    let m = flat([{ ...armed('pistol'), ammo: 1, x: -300 * SUB }, { x: 300 * SUB }]);
    m = run(m, 20, once(SKILL1 | RIGHT));
    expect(m.fighters[0].ammo).toBe(0);
    expect(m.fighters[0].weapon).toBe('pistol');
    m = step(m, [SKILL1 | RIGHT, 0]);
    expect(m.fighters[0].weapon).toBe('fists');
    expect(m.projectiles.some((p) => p.kind === 'thrown' && p.weapon === 'pistol')).toBe(true);
  });

  it('shoots a fast bullet that hits a fighter across the stage', () => {
    let m = flat([{ ...armed('pistol'), x: -250 * SUB }, { x: 250 * SUB, facing: -1 }]);
    m = run(m, 30, once(SKILL1 | RIGHT));
    expect(m.fighters[1].hp).toBe(MAX_HP - PROJECTILES.bullet.damage);
  });

  it('fans shotgun pellets and bursts three rifle rounds', () => {
    let shot = flat([{ ...armed('shotgun'), x: -250 * SUB }, { x: 250 * SUB }]);
    shot = run(shot, 6, once(SKILL1 | RIGHT));
    const pellets = shot.projectiles.filter((p) => p.kind === 'pellet');
    expect(pellets).toHaveLength(5);
    expect(new Set(pellets.map((p) => p.vy)).size).toBe(5);
    let burst = flat([{ ...armed('rifle'), x: -250 * SUB }, { x: 250 * SUB }]);
    burst = run(burst, 4, once(SKILL1 | RIGHT));
    expect(burst.projectiles.filter((p) => p.kind === 'bullet')).toHaveLength(3);
  });

  it('blows a rocket up on whoever it meets, hurting all around', () => {
    let m = flat([{ ...armed('rocket'), x: -200 * SUB }, { x: 100 * SUB, facing: -1 }]);
    m = run(m, 40, once(SKILL1 | RIGHT));
    expect(m.fighters[1].hp).toBeLessThanOrEqual(MAX_HP - PROJECTILES.rocket.damage);
    expect(m.blasts.length + (m.fighters[1].hp < MAX_HP ? 1 : 0)).toBeGreaterThan(0);
  });

  it('throws what is held with a pushed heavy, harder with a charge', () => {
    const throwAfter = (hold: number) => {
      let m = flat([{ ...armed('hammer'), x: -200 * SUB }, { x: 60 * SUB, facing: -1 }]);
      for (let i = 0; i < hold; i++) m = step(m, [SKILL2 | RIGHT, 0]);
      m = step(m, [RIGHT, 0]);
      expect(m.fighters[0].weapon).toBe('fists');
      m = run(m, 40);
      return MAX_HP - m.fighters[1].hp;
    };
    const tap = throwAfter(1);
    expect(tap).toBe(WEAPONS.hammer.heft);
    expect(throwAfter(MAX_CHARGE + 10)).toBe(WEAPONS.hammer.heft * 2);
  });

  it('kicks with a centred heavy, twice as hard fully charged', () => {
    const kickAfter = (hold: number) => {
      let m = flat([{ ...armed('sword'), x: 0 }, { x: 40 * SUB, facing: -1 }]);
      for (let i = 0; i < hold; i++) m = step(m, [SKILL2, 0]);
      m = run(m, 40);
      expect(m.fighters[0].weapon).toBe('sword');
      return MAX_HP - m.fighters[1].hp;
    };
    expect(kickAfter(1)).toBe(KICK.damage);
    expect(kickAfter(MAX_CHARGE + 10)).toBe(KICK.damage * 2);
  });

  it('leaps up with a heavy let go straight up in the air, once per trip', () => {
    let m = flat([{ x: 0, y: -300 * SUB, platform: -1, airJumps: 0, vy: 400 }, { x: 300 * SUB }]);
    m = step(m, [SKILL2 | UP, 0]);
    m = step(m, [UP, 0]);
    expect(m.fighters[0].vy).toBeLessThan(0);
    expect(m.fighters[0].recoveryUsed).toBe(true);
  });

  it('rolls on the ground, and lays ice in the air', () => {
    let m = flat([{ x: 0 }, { x: 250 * SUB }]);
    m = step(m, [DODGE | RIGHT, 0]);
    expect(m.fighters[0].dodge).toBeGreaterThan(0);
    let air = flat([{ x: 0, y: -200 * SUB, platform: -1, vy: 600 }, { x: 250 * SUB }]);
    air = step(air, [DODGE, 0]);
    expect(air.fighters[0].platform).toBeGreaterThanOrEqual(ICE_BASE);
    air = run(air, ICE_LIFE + 2);
    expect(air.ice).toHaveLength(0);
  });

  it('carries a rider on a lift', () => {
    const stage = STAGES[stageIndex('lifts')];
    const lift = stage.platforms.length + 2; // the sliding one
    const at = moverAt(stage.movers[2], 1);
    let m = on('lifts', [{ x: ((at.left + at.right) / 2) * SUB, y: at.top * SUB, platform: lift }, { x: 100 * SUB }], { frame: 0 });
    const x0 = m.fighters[0].x;
    m = run(m, 40);
    expect(m.fighters[0].platform).toBe(lift);
    expect(m.fighters[0].x).not.toBe(x0);
    expect(m.fighters[0].y).toBe(surface(m, lift)!.top);
  });

  it('burns and bounces in lava', () => {
    let m = on('lava', [{ x: -300 * SUB, y: 150 * SUB, platform: -1, vy: 900 }, {}]);
    m = run(m, 3);
    expect(m.fighters[0].hp).toBeLessThan(MAX_HP);
    expect(m.fighters[0].vy).toBeLessThan(0);
  });

  it('hurts on spikes', () => {
    let m = on('spikes', [{ x: 0, y: 40 * SUB, platform: -1, vy: 1200 }, { x: -200 * SUB }]);
    m = run(m, 6);
    expect(m.fighters[0].hp).toBeLessThan(MAX_HP);
  });

  it('crumbles a block stood on, which comes back later', () => {
    let m = on('crumble', [{ x: -300 * SUB, y: -50 * SUB, platform: -1 }, { x: 200 * SUB, y: -400 * SUB, platform: -1 }]);
    m = run(m, 20);
    expect(m.crumble[0]).toBeGreaterThan(0);
    m = run(m, CRACK);
    expect(surface(m, 0)).toBeNull();
    m = run({ ...m, fighters: m.fighters.map((f) => ({ ...f, alive: false })) , between: 1e9 }, GONE);
    expect(m.crumble[0]).toBe(0);
  });

  it('pushes everyone with a gust', () => {
    let m = on('gusts', [{ x: 0 }, { x: 200 * SUB }], { frame: 239 });
    m = step(m, [0, 0]);
    const wind = windAt(m);
    expect(wind.dir).not.toBe(0);
    expect(wind.warning).toBe(false);
    const still = on('gusts', [{ x: 0 }, { x: 200 * SUB }], { frame: 10 });
    const blown = run(m, 20);
    const calm = run(still, 20);
    expect(Math.sign(blown.fighters[0].x - calm.fighters[0].x)).toBe(wind.dir);
  });

  it('carries everyone along a conveyor', () => {
    let m = on('conveyor', [{ x: -300 * SUB }, { x: 300 * SUB }]);
    m = run(m, 30);
    expect(m.fighters[0].x).toBeGreaterThan(-300 * SUB);
    expect(m.fighters[1].x).toBeLessThan(300 * SUB);
  });

  it('slides further on ice', () => {
    const slide = (id: string) => {
      let m = on(id, [{ x: -100 * SUB }, { x: 280 * SUB }]);
      m = run(m, 40, () => [RIGHT, 0]);
      const x = m.fighters[0].x;
      m = run(m, 30);
      return m.fighters[0].x - x;
    };
    expect(slide('rink')).toBeGreaterThan(slide('gusts') * 3);
  });

  it('jumps higher on the Moon', () => {
    const peak = (id: string) => {
      let m = on(id, [{ x: 0 }, { x: 200 * SUB }]);
      m = step(m, [JUMP, 0]);
      let top = m.fighters[0].y;
      for (let i = 0; i < 120; i++) {
        m = step(m, [0, 0]);
        top = Math.min(top, m.fighters[0].y);
      }
      return -top;
    };
    expect(peak('moon')).toBeGreaterThan(peak('gusts') * 1.6);
  });

  it('cuts with a saw blade', () => {
    let m = on('sawmill', [{ x: 0, y: 0 }, { x: -250 * SUB }], { frame: 0 });
    let hurt = false;
    for (let i = 0; i < 300 && !hurt; i++) {
      m = step(m, [0, 0]);
      if (m.fighters[0].hp < MAX_HP) hurt = true;
    }
    expect(hurt).toBe(true);
  });

  it('flings with a rubber chicken but barely hurts', () => {
    const swing = (weapon: WeaponId) => {
      let m = flat([{ ...armed(weapon), x: 0 }, { x: 40 * SUB, facing: -1 }]);
      m = run(m, 3, once(SKILL1 | RIGHT));
      for (let i = 0; i < 30 && m.fighters[1].hp === MAX_HP; i++) m = step(m, [0, 0]);
      return m.fighters[1];
    };
    const chicken = swing('chicken');
    const sword = swing('sword');
    expect(MAX_HP - chicken.hp).toBeLessThan(MAX_HP - sword.hp);
    expect(Math.abs(chicken.vx) + Math.abs(chicken.vy)).toBeGreaterThan(Math.abs(sword.vx) + Math.abs(sword.vy));
  });

  it('leaves a banana peel that trips whoever steps on it, the thrower too', () => {
    let m = flat([{ ...armed('banana'), x: -100 * SUB }, { x: -280 * SUB }]);
    m = run(m, 80, once(SKILL1 | RIGHT));
    const peel = m.projectiles.find((p) => p.kind === 'peel');
    expect(peel).toBeDefined();
    // Walk back over it.
    let slipped = false;
    for (let i = 0; i < 90 && !slipped; i++) {
      m = step(m, [peel!.x < m.fighters[0].x ? LEFT : RIGHT, 0]);
      if (m.fighters[0].hitstun > 30) slipped = true;
    }
    expect(slipped).toBe(true);
  });

  it('lifts with a bubble, and shoves without hurting with a leaf blower', () => {
    let bubble = flat([{ ...armed('bubbles'), x: -60 * SUB }, { x: 20 * SUB, facing: -1 }]);
    bubble = run(bubble, 40, once(SKILL1 | RIGHT));
    expect(bubble.fighters[1].hp).toBeLessThan(MAX_HP);
    let blown = flat([{ ...armed('blower'), x: -60 * SUB }, { x: 20 * SUB, facing: -1 }]);
    blown = run(blown, 8, once(SKILL1 | RIGHT));
    expect(blown.fighters[1].hp).toBe(MAX_HP);
    expect(blown.fighters[1].x).toBeGreaterThan(20 * SUB);
  });

  it('plays every bot level, with two to four fighters, to a match winner', () => {
    for (const level of [1, 2, 3] as BotLevel[]) {
      for (const n of [2, 3, 4]) {
        for (const s of ['a', 'b']) {
          let m = newMatch(`bots:${level}:${n}:${s}`, Array.from({ length: n }, () => ({ bot: level })));
          while (m.winner === null && m.frame < 60 * 60 * 8) m = step(m, m.seats.map((_, i) => botInput(m, i)));
          expect(m.winner, `${level} ${n} ${s}`).not.toBeNull();
          expect(m.wins[m.winner!]).toBe(ROUNDS_TO_WIN);
        }
      }
    }
  });
});

describe('Stick Brawl controls', () => {
  it('reads the stick in eight ways, centred inside the dead zone', () => {
    expect(stickBits(5, -5)).toBe(0);
    expect(stickBits(50, 0)).toBe(RIGHT);
    expect(stickBits(-50, 4)).toBe(LEFT);
    expect(stickBits(0, -50)).toBe(UP);
    expect(stickBits(3, 50)).toBe(DOWN);
    expect(stickBits(40, -40)).toBe(RIGHT | UP);
    expect(stickBits(-40, 35)).toBe(LEFT | DOWN);
  });

  it('keeps the knob inside its ring', () => {
    expect(knob(10, 0)).toEqual([10, 0]);
    const [x, y] = knob(300, 400);
    expect(Math.round(Math.hypot(x, y))).toBe(STICK.radius);
  });

  it('maps the four buttons', () => {
    expect(BUTTON_BITS).toEqual({ jump: JUMP, dodge: DODGE, normal: SKILL1, heavy: SKILL2 });
  });
});
