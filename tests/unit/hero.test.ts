import { describe, expect, it } from 'vitest';
import { DEFENDER_SPREAD, MAX_DELTA, pickOpponent, ratingChange, tierOf } from '../../src/games/hero/arena';
import { BOT_LEVELS, botFighter, botMove, sparringTree, spendPoints } from '../../src/games/hero/bots';
import { ATTACKS, BURN_PCT, isAttack, resolveAttack, type Kit } from '../../src/games/hero/monsters';
import { accuracyPct, afterDef, punchPower, resolve, rouletteBalls, seconds, speedDelay, speedPct, speedPower, stopwatchTarget, WHEEL, type Move } from '../../src/games/hero/skills';
import { apply, replay, start, type Fighter, type HeroState, type Side } from '../../src/games/hero/state';
import {
  available,
  BOT_COUNT,
  burned,
  buy,
  canBuy,
  canReset,
  cooldownOf,
  defaultLoadout,
  FRESH_TREE,
  GROUPS,
  isUpgrade,
  levelCost,
  NODES,
  nodeCost,
  pointsFor,
  resetCost,
  SKILLS,
  spent,
  statsOf,
  validLoadout,
  validTree,
  type Tree,
} from '../../src/games/hero/stats';
import { hashSeed } from '../../src/shared/random';

const tree = (change: Partial<Tree> = {}): Tree => ({ ...FRESH_TREE, ...change });
const plain = statsOf(FRESH_TREE);

describe('the tree', () => {
  it('starts with the stopwatch and grows the stats', () => {
    expect(plain).toEqual({ hp: 100, def: 0, crit: 5, critDmg: 150 });
    expect(statsOf(tree({ hp: 2, def: 3, crit: 10, critDmg: 5 }))).toEqual({ hp: 130, def: 6, crit: 35, critDmg: 200 });
    expect(spent(FRESH_TREE)).toBe(0);
  });

  it('gives a point a level and two for a boss', () => {
    expect([1, 4, 5, 10, 20].map(pointsFor)).toEqual([1, 4, 6, 12, 24]);
  });

  it('prices a skill 5 to unlock then 1, 2, 3…, a stat N for level N, the first stopwatch level free', () => {
    expect([1, 2, 3, 10].map((l) => levelCost('poker', l))).toEqual([5, 1, 2, 9]);
    expect([1, 2, 3].map((l) => levelCost('stopwatch', l))).toEqual([0, 1, 2]);
    expect([1, 2, 3].map((l) => levelCost('hp', l))).toEqual([1, 2, 3]);
    // The closed forms (and the rules' copy) match the sum of the steps.
    for (const n of NODES)
      for (let level = 0; level <= n.max; level++) {
        let sum = 0;
        for (let l = 1; l <= level; l++) sum += levelCost(n.id, l);
        expect(nodeCost(n.id, level), `${n.id} ${level}`).toBe(sum);
      }
    expect(spent(tree({ stopwatch: 5, speed: 1, hp: 2 }))).toBe(10 + 5 + 3);
  });

  it('opens skills in order and spends only what has been earned', () => {
    expect(canBuy(FRESH_TREE, 'poker', 4)).toBe(false); // 5 to unlock
    expect(canBuy(FRESH_TREE, 'poker', 5)).toBe(true); // open from the start
    const two = buy(FRESH_TREE, 'stopwatch');
    expect(canBuy(two, 'speed', 20)).toBe(false); // Stopwatch 5 first
    expect(canBuy(tree({ stopwatch: 5 }), 'speed', 15)).toBe(true);
    expect(canBuy(tree({ stopwatch: 2, poker: 4 }), 'roulette', 20)).toBe(false); // Poker 5 first
    expect(canBuy(tree({ stopwatch: 2, poker: 5 }), 'roulette', 20)).toBe(true);
    expect(canBuy(FRESH_TREE, 'hp', 0)).toBe(false);
    expect(canBuy(tree({ hp: 10 }), 'hp', 20)).toBe(false);
  });

  it('sorts every node into a branch: Stopwatch and I’m Speed for all, Poker then Roulette for gamblers, stats for the body', () => {
    expect(GROUPS.map((g) => g.id)).toEqual(['all', 'gambler', 'body']);
    expect(NODES.filter((n) => n.group === 'all').map((n) => n.id)).toEqual(['stopwatch', 'speed']);
    expect(NODES.filter((n) => n.group === 'gambler').map((n) => n.id)).toEqual(['poker', 'roulette']);
    for (const n of NODES) if (n.needs) expect(['all', n.group]).toContain(NODES.find((m) => m.id === n.needs!.node)!.group);
    expect(SKILLS.map(cooldownOf)).toEqual([0, 1, 2, 3]);
  });

  it('confirms a draft only when it adds earned points', () => {
    const now = tree({ stopwatch: 2 });
    expect(isUpgrade(now, tree({ stopwatch: 2, poker: 1, hp: 1 }), 7)).toBe(true);
    expect(isUpgrade(now, tree({ stopwatch: 2, poker: 1, hp: 2 }), 7)).toBe(false); // 9 points, 8 earned
    expect(isUpgrade(now, tree({ stopwatch: 1, hp: 1 }), 7)).toBe(false); // takes a point back
    expect(isUpgrade(tree(), tree({ roulette: 1 }), 20)).toBe(false); // Roulette before Poker 5
  });

  it('charges more for each reset, out of the points earned', () => {
    expect([1, 2, 3].map(resetCost)).toEqual([1, 2, 3]);
    expect([0, 1, 2, 3].map(burned)).toEqual([0, 1, 3, 6]);
    expect(available(FRESH_TREE, 5, 2)).toBe(6 - 3);
    expect(canReset(0, 0)).toBe(false);
    expect(canReset(1, 0)).toBe(true);
    expect(canReset(2, 1)).toBe(false); // 2 points, 1 + 2 to reset twice
    expect(validTree(tree({ hp: 1 }), 1, 1)).toBeNull();
  });

  it('refuses trees no hero could have, and reads one from before I’m Speed', () => {
    expect(validTree(tree({ hp: 2 }), 2)).toBeNull();
    expect(validTree(tree({ stopwatch: 0 }))).toBeNull();
    expect(validTree({ ...tree(), hp: 1.5 })).toBeNull();
    expect(validTree(tree({ hp: 2 }), 3)).toEqual(tree({ hp: 2 }));
    const { speed: _, ...old } = tree({ hp: 1 });
    expect(validTree(old, 1)).toEqual(tree({ hp: 1 }));
  });

  it('keeps a loadout of 1 to 4 different skills the tree has', () => {
    const t = tree({ stopwatch: 5, speed: 1, poker: 1 });
    expect(validLoadout(['speed', 'stopwatch'], t)).toEqual(['speed', 'stopwatch']);
    expect(validLoadout([], t)).toBeNull();
    expect(validLoadout(['stopwatch', 'stopwatch'], t)).toBeNull();
    expect(validLoadout(['roulette'], t)).toBeNull();
    expect(validLoadout(['hp'], t)).toBeNull();
    expect(defaultLoadout(t)).toEqual(['stopwatch', 'speed', 'poker']);
  });
});

describe('the skills', () => {
  it('waits 1.50 to 4.50 s for I’m Speed’s light, and pays for a quick tap', () => {
    const waits = Array.from({ length: 2000 }, (_, i) => speedDelay(`w${i}`, 0));
    expect(Math.min(...waits)).toBeGreaterThanOrEqual(1500);
    expect(Math.max(...waits)).toBeLessThanOrEqual(4500);
    expect(new Set(waits).size).toBeGreaterThan(200);
    expect([-1, 0, 150, 155, 250, 600, 5000].map(speedPct)).toEqual([0, 100, 100, 99, 80, 10, 10]);
    const t = tree({ stopwatch: 5, speed: 3 });
    const fast = resolve({ skill: 'speed', ms: 140 }, t, plain, plain, 'sp', 0);
    expect(fast.crit).toBe(true);
    expect(fast.damage).toBe(Math.floor((speedPower(3) * 150) / 100));
    expect(fast.detail).toMatchObject({ skill: 'speed', flash: true, pct: 100 });
    const early = resolve({ skill: 'speed', ms: -1 }, t, plain, plain, 'sp', 0);
    expect([early.damage, early.crit]).toEqual([0, false]);
    const slow = resolve({ skill: 'speed', ms: 400 }, t, { ...plain, crit: 0 }, plain, 'sp', 0);
    expect(slow.damage).toBe(Math.floor((speedPower(3) * 50) / 100));
  });

  it('picks a stopwatch target from 1.00 to 10.00 s, to the hundredth', () => {
    const seen = Array.from({ length: 3000 }, (_, i) => stopwatchTarget(`s${i}`, 0));
    for (const t of seen) {
      expect(t % 10).toBe(0);
      expect(t).toBeGreaterThanOrEqual(1000);
      expect(t).toBeLessThanOrEqual(10_000);
    }
    expect(seen.filter((t) => t % 1000 !== 0).length).toBeGreaterThan(2900);
    expect(Math.min(...seen)).toBeLessThan(1100);
    expect(Math.max(...seen)).toBeGreaterThan(9900);
    expect([1230, 1000, 10_000, 4050].map(seconds)).toEqual(['1.23', '1.00', '10.00', '4.05']);
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

  it('gives one ball, a second at level 5 and a third at 10, and a harder punch at every other level', () => {
    expect([0, 1, 4, 5, 9, 10].map(rouletteBalls)).toEqual([0, 1, 1, 2, 2, 3]);
    expect([1, 2, 4, 5, 6, 9, 10].map(punchPower)).toEqual([12, 17, 27, 27, 32, 47, 47]);
  });

  it('kills outright when a roulette ball lands on the pick, about as often as the balls say', () => {
    let hits = 0;
    const games = 6000;
    for (let i = 0; i < games; i++) {
      const hit = resolve({ skill: 'roulette', pick: 7 }, tree({ roulette: 10 }), plain, plain, `r${i}`, 0);
      if (hit.detail.skill !== 'roulette') throw new Error();
      expect(hit.detail.balls).toHaveLength(3);
      expect(hit.kill).toBe(hit.detail.balls.includes(7));
      if (hit.kill) hits++;
      else expect(hit.damage).toBeGreaterThanOrEqual(47);
    }
    const expected = 1 - (36 / WHEEL) ** 3;
    expect(Math.abs(hits / games - expected)).toBeLessThan(0.015);
  });

  it('lays out a shuffled deck, you pick and they take another, ace high, a win doing 100 as a crit and a loss nothing', () => {
    let wins = 0;
    for (let i = 0; i < 500; i++) {
      const hit = resolve({ skill: 'poker', pick: i % 13 }, tree({ poker: 1 }), plain, plain, `k${i}`, 0);
      if (hit.detail.skill !== 'poker') throw new Error();
      const { mine, theirs, won, deck, pick, theirPick } = hit.detail;
      expect([...deck].sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
      expect(pick).toBe(i % 13);
      expect(theirPick).not.toBe(pick);
      expect([mine, theirs]).toEqual([deck[pick], deck[theirPick]]);
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

/** The moves that replay a logged turn: Poker is two, the attacker's card and the defender's. */
const movesOf = (t: HeroState['log'][number], ids: readonly [string, string]): { by: string; move: Move }[] => {
  const d = t.detail;
  const by = ids[t.by];
  if (d.skill === 'stopwatch') return [{ by, move: { skill: 'stopwatch', ms: d.ms } }];
  if (d.skill === 'speed') return [{ by, move: { skill: 'speed', ms: d.ms } }];
  if (d.skill === 'rest') return [{ by, move: { skill: 'rest' } }];
  if (d.skill === 'roulette') return [{ by, move: { skill: 'roulette', pick: d.pick } }];
  if (d.skill === 'attack') return [{ by, move: { skill: 'attack', id: d.id } }];
  return [
    { by, move: { skill: 'poker', pick: d.pick } },
    { by: ids[t.by === 0 ? 1 : 0], move: { skill: 'card', pick: d.theirPick } },
  ];
};

/** A hero with every skill, for the golden hashes. */
const GOLDEN_TREE = tree({ stopwatch: 5, speed: 2, poker: 5, roulette: 2, hp: 1 });

describe('a fight', () => {
  it('takes turns and refuses moves out of turn or with a locked skill', () => {
    const s = start('turns', fighters(FRESH_TREE, FRESH_TREE));
    const other = (s.turn === 0 ? 1 : 0) as Side;
    expect(apply(s, { skill: 'stopwatch', ms: 1000 }, other)).toBeNull();
    expect(apply(s, { skill: 'poker', pick: 0 }, s.turn)).toBeNull();
    expect(apply(s, { skill: 'stopwatch', ms: -5 }, s.turn)).toBeNull();
    const next = apply(s, { skill: 'stopwatch', ms: 1000 }, s.turn)!;
    expect(next.turn).toBe(other);
    expect(next.log).toHaveLength(1);
  });

  it('waits after Poker for the defender to pick their own card', () => {
    let s = start('cards', fighters(tree({ stopwatch: 2, roulette: 2, poker: 1 }), tree({ stopwatch: 2, roulette: 2, poker: 1 })));
    const attacker = s.turn;
    const defender = (attacker === 0 ? 1 : 0) as Side;
    s = apply(s, { skill: 'poker', pick: 4 }, attacker)!;
    expect(s.pending).toEqual({ by: attacker, pick: 4 });
    expect(s.turn).toBe(defender);
    expect(s.log).toHaveLength(0);
    // Only the defender, only a card, and not the attacker's.
    expect(apply(s, { skill: 'card', pick: 7 }, attacker)).toBeNull();
    expect(apply(s, { skill: 'stopwatch', ms: 1000 }, defender)).toBeNull();
    expect(apply(s, { skill: 'card', pick: 4 }, defender)).toBeNull();
    expect(apply(s, { skill: 'card', pick: 13 }, defender)).toBeNull();
    const done = apply(s, { skill: 'card', pick: 7 }, defender)!;
    const t = done.log[0];
    if (t.detail.skill !== 'poker') throw new Error();
    expect([t.by, t.detail.pick, t.detail.theirPick]).toEqual([attacker, 4, 7]);
    expect(done.pending).toBeNull();
    expect(done.turn).toBe(defender);
    // A card with nothing to answer is refused.
    expect(apply(done, { skill: 'card', pick: 1 }, defender)).toBeNull();
  });

  it('rests each skill for its cooldown in your own turns', () => {
    const all = tree({ stopwatch: 5, speed: 1, poker: 5, roulette: 1 });
    // Side 0 moves first, with a pick the seed's ball misses.
    let s: HeroState = { ...start('cool', fighters(all, all)), turn: 0 };
    s = apply(s, { skill: 'roulette', pick: 36 }, 0)!;
    expect(s.winner).toBeNull();
    expect(s.cooldowns[0]).toEqual({ roulette: 3 });
    for (const left of [2, 1, 0]) {
      s = apply(s, { skill: 'stopwatch', ms: 0 }, 1)!;
      expect(apply(s, { skill: 'roulette', pick: 1 }, 0)).toBeNull();
      s = apply(s, { skill: 'stopwatch', ms: 0 }, 0)!;
      expect(s.cooldowns[0].roulette).toBe(left || undefined);
    }
    s = apply(s, { skill: 'stopwatch', ms: 0 }, 1)!;
    expect(apply(s, { skill: 'roulette', pick: 1 }, 0)).not.toBeNull();
    // Poker rests once its card is answered; the defender's card isn't a turn of theirs.
    s = apply(s, { skill: 'speed', ms: 300 }, 0)!;
    s = apply(s, { skill: 'poker', pick: 0 }, 1)!;
    s = apply(s, { skill: 'card', pick: 1 }, 0)!;
    expect(s.cooldowns[1]).toEqual({ poker: 2 });
    expect(s.cooldowns[0]).toEqual({ speed: 1 });
  });

  it('fights only with the loadout, and rests only when all of it is cooling', () => {
    const t = tree({ stopwatch: 5, speed: 1 });
    let s: HeroState = { ...start('kit', [{ name: 'A', tree: t, loadout: ['speed'] }, { name: 'B', tree: t }]), turn: 0 };
    expect(apply(s, { skill: 'stopwatch', ms: 0 }, 0)).toBeNull(); // not brought
    expect(apply(s, { skill: 'rest' }, 0)).toBeNull(); // Speed is ready
    s = apply(s, { skill: 'speed', ms: 300 }, 0)!;
    s = apply(s, { skill: 'stopwatch', ms: 0 }, 1)!;
    expect(apply(s, { skill: 'speed', ms: 300 }, 0)).toBeNull();
    s = apply(s, { skill: 'rest' }, 0)!;
    expect(s.log.at(-1)).toMatchObject({ skill: 'rest', damage: 0 });
    expect(s.cooldowns[0]).toEqual({});
    // A creature never rests.
    const c: HeroState = { ...start('kit', [{ name: 'A', tree: t }, creature(kit())]), turn: 1 };
    expect(apply(c, { skill: 'rest' }, 1)).toBeNull();
  });

  it('replays the same from the same moves, skipping refused ones', () => {
    const played = botFight('replay', tree({ stopwatch: 3, roulette: 2, poker: 1 }), BOT_LEVELS[9]);
    const ids = ['a', 'b'] as const;
    const moves = played.log.flatMap((t) => movesOf(t, ids));
    expect(played.log.some((t) => t.skill === 'poker')).toBe(true);
    // A move out of turn and one by a stranger are skipped.
    const noisy = [{ by: ids[played.log[0].by === 0 ? 1 : 0], move: moves[0].move }, { by: 'eve', move: moves[0].move }, ...moves];
    const again = replay('replay', played.fighters, ids, noisy);
    expect(again.hp).toEqual(played.hp);
    expect(again.winner).toBe(played.winner);
  });

  it('comes out the same as when it was written (golden hash)', () => {
    const results = Array.from({ length: 30 }, (_, i) => {
      const s = botFight(`golden${i}`, GOLDEN_TREE, BOT_LEVELS[i % BOT_COUNT]);
      return `${s.winner}:${s.hp.join(',')}:${s.log.length}`;
    });
    expect(hashSeed(results.join('|'))).toBe(3047989030);
  });

  it('plays hero against hero with no effects, the same every time', () => {
    const results = Array.from({ length: 30 }, (_, i) => {
      const s = fightOut(`pvp${i}`, GOLDEN_TREE, { name: 'B', tree: sparringTree(1 + (i % BOT_COUNT)) }, 900);
      expect(s.effects).toEqual([[], []]);
      return `${s.winner}:${s.hp.join(',')}:${s.log.length}`;
    });
    expect(hashSeed(results.join('|'))).toBe(2398330793);
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
    for (const bot of BOT_LEVELS) {
      const mine = spendPoints(pointsFor(bot.level - 1));
      expect(validTree(mine, bot.level - 1), `level ${bot.level}`).not.toBeNull();
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
