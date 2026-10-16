import { describe, expect, it } from 'vitest';
import {
  continueRun,
  dir,
  H,
  MAX_POWER,
  newRun,
  NO_INPUT,
  STAGE_TICKS,
  step,
  W,
  wavesFor,
  type Input,
  type SkyState,
} from '../../src/games/sky/sim';
import { hashSeed } from '../../src/shared/random';

// Sky Ace: a deterministic shooter. These check each rule, that a run plays out the same
// from the same inputs (and from a save), and that a simple bot gets through every stage.

/** A simple pilot: follows the nearest plane, sidesteps bullets, bombs when cornered. */
function pilot(s: SkyState): Input {
  const p = s.player;
  let target = W / 2;
  let best = Infinity;
  for (const e of s.enemies) {
    if (e.y < 0 || e.y > p.y) continue;
    const d = Math.abs(e.x - p.x) + (p.y - e.y) * 0.2;
    if (d < best) {
      best = d;
      target = e.x;
    }
  }
  let dx = Math.max(-6, Math.min(6, target - p.x));
  let danger = false;
  for (const b of s.bullets) {
    const ahead = p.y - b.y;
    if (ahead > -10 && ahead < 70 && Math.abs(b.x - p.x) < 22) {
      dx = b.x > p.x ? -8 : 8;
      if (ahead < 18) danger = true;
    }
  }
  const dy = (H - 110 - p.y) * 0.2;
  return { dx, dy, bomb: danger };
}

function fly(s: SkyState, ticks: number, input: (s: SkyState) => Input = pilot) {
  for (let t = 0; t < ticks; t++) {
    if (s.phase === 'over') continueRun(s);
    step(s, input(s));
  }
}

describe('directions', () => {
  it('turns a full circle without trig: right, down, left, up', () => {
    const close = (a: readonly [number, number], b: [number, number]) => {
      expect(a[0]).toBeCloseTo(b[0], 6);
      expect(a[1]).toBeCloseTo(b[1], 6);
    };
    close(dir(0), [1, 0]);
    close(dir(16), [0, 1]);
    close(dir(32), [-1, 0]);
    close(dir(48), [0, -1]);
    close(dir(64), [1, 0]);
    close(dir(-16), [0, -1]);
  });
});

describe('waves', () => {
  it('are the same for a seed, differ between seeds, and fit before the boss', () => {
    const a = wavesFor('x', 0, 0);
    expect(wavesFor('x', 0, 0)).toBe(a);
    expect(JSON.stringify(wavesFor('y', 0, 0))).not.toBe(JSON.stringify(a));
    expect(a.length).toBeGreaterThan(40);
    expect(a.every((w) => w.at < STAGE_TICKS && w.x >= 0 && w.x <= W)).toBe(true);
    for (let stage = 0; stage < 3; stage++) expect(wavesFor('x', 0, stage).some((w) => w.kind === 'gunship')).toBe(true);
  });

  it('come faster on the second lap', () => {
    expect(wavesFor('x', 1, 0).length).toBeGreaterThan(wavesFor('x', 0, 0).length);
  });
});

describe('the ship', () => {
  it('follows the finger, but stays on the field', () => {
    const s = newRun('a');
    step(s, { dx: 10, dy: -5, bomb: false });
    expect(s.player.x).toBe(W / 2 + 10);
    expect(s.player.y).toBe(H - 95);
    for (let i = 0; i < 40; i++) step(s, { dx: -28, dy: 28, bomb: false });
    expect(s.player.x).toBe(14);
    expect(s.player.y).toBe(H - 24);
  });

  it('fires by itself', () => {
    const s = newRun('a');
    fly(s, 30, () => NO_INPUT);
    expect(s.shots.some((shot) => shot.kind === 'vulcan')).toBe(true);
  });

  it('loses a ship to a bullet, then comes back after a while, unhurt for a bit', () => {
    const s = newRun('a');
    s.player.invuln = 0;
    s.bullets.push({ x: s.player.x, y: s.player.y, vx: 0, vy: 0, r: 4 });
    step(s, NO_INPUT);
    expect(s.player.lives).toBe(2);
    expect(s.player.down).toBeGreaterThan(0);
    expect(s.bullets).toHaveLength(0);
    fly(s, 80, () => NO_INPUT);
    expect(s.player.down).toBe(0);
    expect(s.player.invuln).toBeGreaterThan(0);
  });

  it('out of ships, waits; a continue carries on for half the score', () => {
    const s = newRun('a');
    s.score = 100000;
    s.player.lives = 1;
    s.player.invuln = 0;
    s.bullets.push({ x: s.player.x, y: s.player.y, vx: 0, vy: 0, r: 4 });
    for (let i = 0; i < 100 && s.phase !== 'over'; i++) step(s, NO_INPUT);
    expect(s.phase).toBe('over');
    const clock = s.clock;
    step(s, NO_INPUT);
    expect(s.clock).toBe(clock);
    continueRun(s);
    expect(s.phase).toBe('play');
    expect(s.score).toBe(50001);
    expect(s.player.lives).toBe(3);
    expect(s.continues).toBe(1);
  });

  it('a continue during the warning brings the boss only once', () => {
    const s = newRun('a');
    s.tick = STAGE_TICKS - 1;
    s.waveIndex = 9999;
    step(s, NO_INPUT);
    expect(s.phase).toBe('warning');
    s.phase = 'over';
    continueRun(s);
    expect(s.phase).toBe('warning');
    fly(s, 200, () => NO_INPUT);
    expect(s.enemies.filter((e) => e.kind === 'core')).toHaveLength(1);
  });
});

describe('the bomb', () => {
  it('clears bullets, hurts everything on screen, and uses one bomb', () => {
    const s = newRun('a');
    s.bullets.push({ x: 100, y: 100, vx: 0, vy: 0, r: 4 });
    s.enemies.push({ id: 99, kind: 'dart', x: 100, y: 200, vx: 0, vy: 0, r: 12, hp: 20, maxHp: 20, age: 0, ground: false, points: 100, fire: 999, seen: -1, flash: 0 });
    step(s, { dx: 0, dy: 0, bomb: true });
    expect(s.player.bombs).toBe(2);
    expect(s.bullets).toHaveLength(0);
    fly(s, 60, () => NO_INPUT);
    expect(s.enemies.find((e) => e.id === 99)).toBeUndefined();
  });
});

describe('pickups', () => {
  const pickup = (s: SkyState, kind: 'red' | 'blue' | 'missile' | 'bomb' | 'medal') => {
    s.items.push({ x: s.player.x, y: s.player.y, vx: 0, vy: 0, kind, age: 0 });
    step(s, NO_INPUT);
  };

  it('the same colour powers up, the other switches weapon', () => {
    const s = newRun('a');
    pickup(s, 'red');
    expect(s.player.power).toBe(2);
    pickup(s, 'blue');
    expect(s.player.weapon).toBe('laser');
    expect(s.player.power).toBe(2);
    for (let i = 0; i < 5; i++) pickup(s, 'blue');
    expect(s.player.power).toBe(MAX_POWER);
    pickup(s, 'missile');
    expect(s.player.missiles).toBe(1);
  });

  it('medals are worth more each time, and reset when one is missed', () => {
    const s = newRun('a');
    pickup(s, 'medal');
    pickup(s, 'medal');
    expect(s.score).toBe(300);
    expect(s.medal).toBe(300);
    s.items.push({ x: 50, y: H + 20, vx: 0, vy: 0, kind: 'medal', age: 0 });
    step(s, NO_INPUT);
    expect(s.medal).toBe(100);
  });
});

describe('scoring', () => {
  it('doubles a kill made right as a plane shows up: a Quick shot', () => {
    const s = newRun('a');
    s.enemies.push({ id: 99, kind: 'dart', x: s.player.x, y: 300, vx: 0, vy: 0, r: 12, hp: 1, maxHp: 1, age: 0, ground: false, points: 100, fire: 999, seen: -1, flash: 0 });
    fly(s, 40, () => NO_INPUT);
    expect(s.score).toBe(200);
    expect(s.popups.some((p) => p.text === 'QUICK SHOT!')).toBe(true);
  });
});

describe('the boss', () => {
  it('comes after the waves, and its core is shielded until its guns are down', () => {
    const s = newRun('boss');
    s.tick = STAGE_TICKS - 1;
    s.waveIndex = 9999;
    fly(s, 200, () => NO_INPUT);
    expect(s.phase).toBe('boss');
    const core = s.enemies.find((e) => e.kind === 'core')!;
    const guns = s.enemies.filter((e) => e.anchor === core.id);
    expect(guns).toHaveLength(2);
    s.player.invuln = 99999;
    fly(s, 300);
    expect(core.hp).toBe(core.maxHp);
    for (const g of guns) g.hp = 0.01;
    s.player.x = guns[0].x;
    fly(s, 30, () => NO_INPUT);
    s.player.x = guns[1].x;
    fly(s, 30, () => NO_INPUT);
    expect(s.enemies.filter((e) => e.anchor === core.id)).toHaveLength(0);
    s.player.x = core.x;
    fly(s, 60, () => NO_INPUT);
    expect(core.hp).toBeLessThan(core.maxHp);
  });
});

describe('whole runs', () => {
  it('play the same from the same inputs, and from a save', () => {
    const a = newRun('same');
    const b = newRun('same');
    fly(a, 3000);
    fly(b, 1500);
    const saved = JSON.parse(JSON.stringify(b)) as SkyState;
    fly(saved, 1500);
    expect(JSON.stringify(saved)).toBe(JSON.stringify(a));
  });

  it('a simple pilot gets through all three stages to the harder lap', () => {
    for (const seed of ['one', 'two']) {
      const s = newRun(seed);
      let ticks = 0;
      while (s.loop === 0 && ticks < 60000) {
        fly(s, 100);
        ticks += 100;
      }
      expect(s.loop).toBe(1);
      expect(s.score).toBeGreaterThan(0);
    }
  });

  it('keeps the bullets on a phone-sized budget', () => {
    const s = newRun('busy');
    s.loop = 2;
    let most = 0;
    for (let t = 0; t < 12000; t++) {
      if (s.phase === 'over') continueRun(s);
      step(s, pilot(s));
      most = Math.max(most, s.bullets.length + s.shots.length);
    }
    expect(most).toBeLessThan(500);
  });

  it('match the golden run (bump SKY_VERSION and this hash when runs would play differently)', () => {
    const s = newRun('golden');
    fly(s, 4000);
    expect(hashSeed(JSON.stringify(s))).toBe(3949040882);
  });
});
