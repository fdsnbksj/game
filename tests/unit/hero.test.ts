import { describe, expect, it } from 'vitest';
import { DEFENDER_SPREAD, MAX_DELTA, pickOpponent, ratingChange, tierOf } from '../../src/games/hero/arena';
import { BOT_LEVELS, botFighter, botMove, sparringTree } from '../../src/games/hero/bots';
import { ATTACKS, BURN_PCT, isAttack, resolveAttack, type Kit } from '../../src/games/hero/monsters';
import { accuracyPct, afterDef, resolve, stopwatchTarget, WHEEL, type Move } from '../../src/games/hero/skills';
import { apply, replay, start, type Fighter, type HeroState, type Side } from '../../src/games/hero/state';
import { BOT_COUNT, buy, canBuy, FRESH_TREE, pointsFor, spent, statsOf, validTree, type NodeId, type Tree } from '../../src/games/hero/stats';
import { hashSeed } from '../../src/shared/random';

const tree = (change: Partial<Tree> = {}): Tree => ({ ...FRESH_TREE, ...change });
const plain = statsOf(FRESH_TREE);

describe('the tree', () => {
  it('starts with the stopwatch and grows the stats', () => {
    expect(plain).toEqual({ hp: 100, def: 0, crit: 5, critDmg: 150 });
    expect(statsOf(tree({ hp: 2, def: 3, crit: 10, critDmg: 5 }))).toEqual({ hp: 130, def: 6, crit: 35, critDmg: 200 });
    expect(spent(FRESH_TREE)).toBe(0);
  });

  it('gives a point a level and three for a boss', () => {
    expect([1, 4, 5, 10, 20].map(pointsFor)).toEqual([1, 4, 7, 14, 28]);
  });

  it('opens skills in order and spends only what has been earned', () => {
    expect(canBuy(FRESH_TREE, 'roulette', 5)).toBe(false);
    const two = buy(FRESH_TREE, 'stopwatch');
    expect(canBuy(two, 'roulette', 5)).toBe(true);
    expect(canBuy(two, 'poker', 5)).toBe(false);
    expect(canBuy(two, 'hp', 1)).toBe(false);
    expect(canBuy(tree({ hp: 10 }), 'hp', 20)).toBe(false);
  });

  it('refuses trees no hero could have', () => {
    expect(validTree(tree({ hp: 3 }), 2)).toBeNull();
    expect(validTree(tree({ stopwatch: 0 }))).toBeNull();
    expect(validTree({ ...tree(), hp: 1.5 })).toBeNull();
    expect(validTree(tree({ hp: 3 }), 3)).toEqual(tree({ hp: 3 }));
  });
});

describe('the skills', () => {
  it('picks a whole-second stopwatch target from 1 to 10', () => {
    const seen = new Set(Array.from({ length: 300 }, (_, i) => stopwatchTarget(`s${i}`, 0)));
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => s * 1000));
  });

  it('scales stopwatch damage with how close the stop was', () => {
    expect([0, 100, 1000, 5000].map(accuracyPct)).toEqual([100, 95, 50, 10]);
    for (let i = 0; i < 50; i++) {
      const target = stopwatchTarget(`p${i}`, 0);
      const perfect = resolve({ skill: 'stopwatch', ms: target + 30 }, FRESH_TREE, plain, plain, `p${i}`, 0);
      expect(perfect.crit).toBe(true);
      expect(perfect.damage).toBe(36); // 24 power, ×1.5
      const far = resolve({ skill: 'stopwatch', ms: target + 9000 }, FRESH_TREE, plain, plain, `p${i}`, 0);
      expect(far.damage).toBeLessThanOrEqual(4);
      expect(far.damage).toBeGreaterThan(0);
    }
  });

  it('kills outright when a roulette ball lands on the pick, about as often as the balls say', () => {
    let hits = 0;
    const games = 4000;
    for (let i = 0; i < games; i++) {
      const hit = resolve({ skill: 'roulette', pick: 7 }, tree({ roulette: 10 }), plain, plain, `r${i}`, 0);
      if (hit.detail.skill !== 'roulette') throw new Error();
      expect(hit.detail.balls).toHaveLength(10);
      expect(hit.kill).toBe(hit.detail.balls.includes(7));
      if (hit.kill) hits++;
      else expect(hit.damage).toBeGreaterThan(0);
    }
    const expected = 1 - (36 / WHEEL) ** 10;
    expect(Math.abs(hits / games - expected)).toBeLessThan(0.03);
  });

  it('plays poker ace high, a win doing 100 as a crit and a loss nothing', () => {
    let wins = 0;
    for (let i = 0; i < 500; i++) {
      const hit = resolve({ skill: 'poker' }, tree({ poker: 1 }), plain, plain, `k${i}`, 0);
      if (hit.detail.skill !== 'poker') throw new Error();
      const { mine, theirs, won } = hit.detail;
      expect(mine).not.toBe(theirs);
      expect(Math.min(mine, theirs)).toBeGreaterThanOrEqual(2);
      expect(Math.max(mine, theirs)).toBeLessThanOrEqual(14);
      expect(won).toBe(mine > theirs);
      expect(hit.damage).toBe(won ? 150 : 0);
      if (won) wins++;
    }
    expect(wins).toBeGreaterThan(200);
    expect(wins).toBeLessThan(300);
  });

  it('lets DEF soften every hit but never to nothing', () => {
    expect(afterDef(100, 0)).toBe(100);
    expect(afterDef(100, 20)).toBe(83);
    expect(afterDef(1, 20)).toBe(1);
    expect(afterDef(0, 20)).toBe(0);
  });
});

const fighters = (a: Tree, b: Tree): [Fighter, Fighter] => [
  { name: 'A', tree: a },
  { name: 'B', tree: b },
];

/** A hero with `a`, played by the bot brain, against `foe` to the end. */
function fightOut(seed: string, a: Tree, foe: Fighter, foeSpread = 500): HeroState {
  let state = start(seed, [{ name: 'A', tree: a }, foe]);
  while (state.winner === null) {
    const next = apply(state, botMove(state, state.turn, { spread: state.turn === 0 ? 500 : foeSpread }), state.turn);
    if (!next) throw new Error('a bot made an illegal move');
    state = next;
  }
  return state;
}

const botFight = (seed: string, a: Tree, bot = BOT_LEVELS[0]) => fightOut(seed, a, botFighter(bot), bot.spread);

/** A move that replays a logged turn. */
const moveOf = (t: HeroState['log'][number]): Move =>
  t.detail.skill === 'stopwatch'
    ? { skill: 'stopwatch', ms: t.detail.ms }
    : t.detail.skill === 'roulette'
      ? { skill: 'roulette', pick: t.detail.pick }
      : t.detail.skill === 'attack'
        ? { skill: 'attack', id: t.detail.id }
        : { skill: 'poker' };

describe('a fight', () => {
  it('takes turns and refuses moves out of turn or with a locked skill', () => {
    const s = start('turns', fighters(FRESH_TREE, FRESH_TREE));
    const other = (s.turn === 0 ? 1 : 0) as Side;
    expect(apply(s, { skill: 'stopwatch', ms: 1000 }, other)).toBeNull();
    expect(apply(s, { skill: 'poker' }, s.turn)).toBeNull();
    expect(apply(s, { skill: 'stopwatch', ms: -5 }, s.turn)).toBeNull();
    const next = apply(s, { skill: 'stopwatch', ms: 1000 }, s.turn)!;
    expect(next.turn).toBe(other);
    expect(next.log).toHaveLength(1);
  });

  it('replays the same from the same moves, skipping refused ones', () => {
    const played = botFight('replay', tree({ stopwatch: 3, roulette: 2, poker: 1 }), BOT_LEVELS[9]);
    const ids = ['a', 'b'] as const;
    const moves = played.log.map((t) => ({ by: ids[t.by], move: moveOf(t) }));
    // A move out of turn and one by a stranger are skipped.
    const noisy = [{ by: ids[played.log[0].by === 0 ? 1 : 0], move: moves[0].move }, { by: 'eve', move: moves[0].move }, ...moves];
    const again = replay('replay', played.fighters, ids, noisy);
    expect(again.hp).toEqual(played.hp);
    expect(again.winner).toBe(played.winner);
  });

  it('comes out the same as when it was written (golden hash)', () => {
    const results = Array.from({ length: 30 }, (_, i) => {
      const s = botFight(`golden${i}`, tree({ stopwatch: 2, roulette: 2, poker: 1, hp: 1 }), BOT_LEVELS[i % BOT_COUNT]);
      return `${s.winner}:${s.hp.join(',')}:${s.log.length}`;
    });
    expect(hashSeed(results.join('|'))).toBe(883076672);
  });

  it('plays hero against hero as it did before creatures came (friend fights replay the same)', () => {
    const results = Array.from({ length: 30 }, (_, i) => {
      const s = fightOut(`pvp${i}`, tree({ stopwatch: 2, roulette: 2, poker: 1, hp: 1 }), { name: 'B', tree: sparringTree(1 + (i % BOT_COUNT)) }, 900);
      expect(s.effects).toEqual([[], []]);
      return `${s.winner}:${s.hp.join(',')}:${s.log.length}`;
    });
    // The same as HERO_VERSION 1 gave.
    expect(hashSeed(results.join('|'))).toBe(141452461);
  });
});

const kit = (change: Partial<Kit> = {}): Kit => ({ family: 'clock', attacks: ['strike'], power: 20, enrage: false, ...change });
const creature = (k: Kit, t: Tree = tree({ stopwatch: 0 })): Fighter => ({ name: 'C', tree: t, kit: k });

/** A fight where side 1 (the creature) is to move. */
function creatureTurn(seed: string, k: Kit, hero = FRESH_TREE): HeroState {
  for (let i = 0; ; i++) {
    const s = start(`${seed}:${i}`, [{ name: 'A', tree: hero }, creature(k)]);
    if (s.turn === 1) return s;
  }
}

describe('the creatures', () => {
  it('hit for their power, miss as often as their accuracy says, and crit', () => {
    let missed = 0;
    for (let i = 0; i < 2000; i++) {
      const hit = resolveAttack('slam', kit(), plain, plain, `a${i}`, 0, 100);
      if (hit.detail.skill !== 'attack') throw new Error();
      if (hit.detail.missed) {
        missed++;
        expect(hit.damage).toBe(0);
      } else expect(hit.damage).toBe(hit.crit ? 51 : 34); // 170% of 20, ×1.5 on a crit
    }
    expect(Math.abs(missed / 2000 - 0.3)).toBeLessThan(0.04);
  });

  it('drain heals half the damage, never past full', () => {
    let s = creatureTurn('drain', kit({ attacks: ['drain'] }));
    s = { ...s, hp: [s.hp[0], 50] };
    const next = apply(s, { skill: 'attack', id: 'drain' }, 1)!;
    const t = next.log[0];
    if (t.detail.skill !== 'attack') throw new Error();
    if (!t.detail.missed) {
      expect(t.detail.healed).toBe(Math.floor(t.damage / 2));
      expect(next.hp[1]).toBe(50 + t.detail.healed);
    }
  });

  it('refuses attacks outside the kit, and skills from a creature', () => {
    const s = creatureTurn('kit', kit());
    expect(apply(s, { skill: 'attack', id: 'finisher' }, 1)).toBeNull();
    expect(apply(s, { skill: 'stopwatch', ms: 1000 }, 1)).toBeNull();
    expect(apply(s, { skill: 'attack', id: 'nope' as never }, 1)).toBeNull();
    expect(isAttack('strike')).toBe(true);
    expect(isAttack('toString')).toBe(false);
  });

  it('burns for three of the hero’s turns', () => {
    let s = creatureTurn('burn', kit({ attacks: ['scorch'] }), tree({ hp: 10 }));
    let seed = 0;
    while (true) {
      const next = apply(s, { skill: 'attack', id: 'scorch' }, 1)!;
      const d = next.log.at(-1)!.detail;
      if (d.skill === 'attack' && d.effect === 'burn') {
        s = next;
        break;
      }
      s = creatureTurn(`burn${++seed}`, kit({ attacks: ['scorch'] }), tree({ hp: 10 }));
    }
    const tick = Math.floor((250 * BURN_PCT) / 100);
    const burns: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = apply(s, { skill: 'stopwatch', ms: 1 }, 0)!;
      burns.push(s.log.at(-1)!.burn);
      s = { ...s, turn: 0 };
    }
    expect(burns).toEqual([tick, tick, tick, 0]);
  });

  it('weakens and guards against the hero’s skills, and a wind-up powers up one hit', () => {
    const base = start('fx', [{ name: 'A', tree: FRESH_TREE }, creature(kit())]);
    const stop = (s: HeroState) => apply({ ...s, turn: 0 }, { skill: 'stopwatch', ms: stopwatchTarget('fx', 0) }, 0)!.log[0].damage;
    const plainHit = stop(base);
    expect(stop({ ...base, effects: [[{ id: 'weak', turns: 2 }], []] })).toBe(Math.floor((plainHit * 70) / 100));
    expect(stop({ ...base, effects: [[], [{ id: 'guard', turns: 2 }]] })).toBeLessThan(plainHit);
    const charged = { ...base, turn: 1 as Side, effects: [[], [{ id: 'charged' as const, turns: 1 }]] as HeroState['effects'] };
    const once = apply(charged, { skill: 'attack', id: 'strike' }, 1)!;
    expect(once.effects[1]).toEqual([]);
  });

  it('enrages a boss below half its HP', () => {
    const boss = start('rage', [{ name: 'A', tree: FRESH_TREE }, creature(kit({ attacks: ['jab'], enrage: true }))]);
    const hitAt = (hp: number) => apply({ ...boss, turn: 1, hp: [boss.hp[0], hp] }, { skill: 'attack', id: 'jab' }, 1)!.log[0].damage;
    expect(hitAt(40)).toBe(Math.floor((hitAt(100) * 150) / 100));
  });

  it('only ever makes legal moves, and every attack it knows is one', () => {
    for (const bot of BOT_LEVELS) for (const id of bot.kit.attacks) expect(ATTACKS[id]).toBeDefined();
    for (let i = 0; i < 40; i++) botFight(`legal${i}`, tree({ stopwatch: 4, roulette: 3, poker: 2, hp: 3 }), BOT_LEVELS[i % BOT_COUNT]);
  });
});

describe('the bot ladder', () => {
  it('has twenty creatures, a boss every fifth with a finisher, and no skills', () => {
    expect(BOT_LEVELS).toHaveLength(20);
    expect(BOT_LEVELS.filter((b) => b.boss).map((b) => b.level)).toEqual([5, 10, 15, 20]);
    for (const bot of BOT_LEVELS) {
      expect([bot.tree.stopwatch, bot.tree.roulette, bot.tree.poker], bot.name).toEqual([0, 0, 0]);
      expect(bot.kit.attacks.includes('finisher')).toBe(bot.boss);
      expect(bot.kit.enrage).toBe(bot.boss);
      expect(validTree(sparringTree(bot.level)), bot.name).not.toBeNull();
    }
  });

  it('can be beaten at every level by a hero with the points from the levels before', () => {
    const order: NodeId[] = ['stopwatch', 'roulette', 'roulette', 'poker', 'hp', 'stopwatch', 'def', 'crit', 'hp', 'poker', 'critDmg'];
    for (const bot of BOT_LEVELS) {
      let mine = FRESH_TREE;
      for (let i = 0; i < 200; i++) if (canBuy(mine, order[i % order.length], bot.level - 1)) mine = buy(mine, order[i % order.length]);
      let wins = 0;
      for (let g = 0; g < 150; g++) if (botFight(`ladder${bot.level}:${g}`, mine, bot).winner === 0) wins++;
      expect(wins / 150, `level ${bot.level}`).toBeGreaterThan(0.3);
      if (bot.boss) expect(wins / 150, `boss ${bot.level}`).toBeLessThan(0.95);
    }
  });
});

describe('the arena', () => {
  it('moves a rating by 5 to 35, 20 between equals, more for an upset', () => {
    expect(ratingChange(1000, 1000, true)).toBe(20);
    expect(ratingChange(1000, 1000, false)).toBe(-20);
    expect(ratingChange(1000, 1200, true)).toBe(28);
    expect(ratingChange(1200, 1000, false)).toBe(-28);
    expect(ratingChange(1000, 3000, true)).toBe(MAX_DELTA);
    expect(ratingChange(3000, 1000, true)).toBe(5);
    for (let mine = 600; mine <= 2400; mine += 37)
      for (let theirs = 600; theirs <= 2400; theirs += 53)
        for (const won of [true, false]) {
          const d = ratingChange(mine, theirs, won);
          expect(Math.abs(d)).toBeGreaterThanOrEqual(5);
          expect(Math.abs(d)).toBeLessThanOrEqual(MAX_DELTA);
          expect(d > 0).toBe(won);
          expect(Number.isInteger(d)).toBe(true);
        }
  });

  it('names tiers by rating', () => {
    expect([0, 1099, 1100, 1249, 1250, 1400, 1599, 1600, 2500].map(tierOf)).toEqual([
      'Bronze', 'Bronze', 'Silver', 'Silver', 'Gold', 'Platinum', 'Platinum', 'Diamond', 'Diamond',
    ]);
  });

  it('never picks you, and the same seed picks the same opponent', () => {
    const heroes = ['me', 'a', 'b', 'c'].map((uid) => ({ uid, name: uid, tree: FRESH_TREE, rating: 1000 }));
    for (let i = 0; i < 50; i++) {
      const picked = pickOpponent(heroes, 'me', `s${i}`);
      expect(picked?.uid).not.toBe('me');
      expect(pickOpponent(heroes, 'me', `s${i}`)).toBe(picked);
    }
    expect(pickOpponent(heroes.slice(0, 1), 'me', 'x')).toBeNull();
  });

  it('plays a defender with the arena accuracy to the end', () => {
    const defender = tree({ stopwatch: 4, roulette: 2, poker: 2, hp: 3 });
    const fight = fightOut('arena', tree({ stopwatch: 3, roulette: 2, poker: 1 }), { name: 'D', tree: defender }, DEFENDER_SPREAD);
    expect(fight.winner).not.toBeNull();
  });
});
