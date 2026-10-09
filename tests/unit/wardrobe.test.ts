import { describe, expect, it } from 'vitest';
import { BOT_LEVELS, botFighter, botMove } from '../../src/games/hero/bots';
import { BONUS_CAP, costumeItem, COSTUMES } from '../../src/games/hero/costumes';
import { ALL_ITEMS, gemsFor, PITY, POOL, pullOnce, pullTen, RATES, rarityOf, REFUND } from '../../src/games/hero/gacha';
import { canWear, DEFAULT_LOOK, HATS, LOOK_SIZES, SUMMON_PARTS, validLook, wearable } from '../../src/games/hero/look';
import { apply, start } from '../../src/games/hero/state';
import { buy, canBuy, FRESH_TREE, statsOf, type NodeId } from '../../src/games/hero/stats';
import { stream } from '../../src/nonogram/rng';

describe('the look', () => {
  it('starts on free parts and refuses anything out of range', () => {
    expect(validLook(DEFAULT_LOOK)).toEqual(DEFAULT_LOOK);
    for (const field of Object.keys(LOOK_SIZES) as (keyof typeof LOOK_SIZES)[]) {
      expect(canWear(field, DEFAULT_LOOK[field], [])).toBe(true);
      expect(validLook({ ...DEFAULT_LOOK, [field]: LOOK_SIZES[field] })).toBeNull();
      expect(validLook({ ...DEFAULT_LOOK, [field]: -1 })).toBeNull();
    }
    expect(validLook({ ...DEFAULT_LOOK, hat: 1.5 })).toBeNull();
  });

  it('wears a Summon part only once owned', () => {
    const crown = HATS.findIndex((h) => h.id === 'crown');
    expect(canWear('hat', crown, [])).toBe(false);
    expect(canWear('hat', crown, ['hat:crown'])).toBe(true);
    expect(wearable({ ...DEFAULT_LOOK, hat: crown }, []).hat).toBe(DEFAULT_LOOK.hat);
    expect(SUMMON_PARTS).toContain('hat:crown');
  });
});

describe('costumes', () => {
  it('stay inside their rarity’s bonus cap', () => {
    for (const c of COSTUMES) {
      const cap = BONUS_CAP[c.rarity];
      for (const k of ['hpPct', 'def', 'crit', 'critDmg'] as const) {
        expect(c.bonus[k], `${c.id} ${k}`).toBeLessThanOrEqual(cap[k]);
        expect(Number.isInteger(c.bonus[k])).toBe(true);
      }
    }
  });

  it('add their bonus, and nothing without one', () => {
    const tree = { ...FRESH_TREE, hp: 4 };
    expect(statsOf(tree)).toEqual({ hp: 160, def: 0, crit: 5, critDmg: 150 });
    expect(statsOf(tree, COSTUMES[0].bonus)).toEqual({ hp: 172, def: 3, crit: 8, critDmg: 165 });
  });

  it('leave every level still worth fighting for', () => {
    const order: NodeId[] = ['stopwatch', 'roulette', 'roulette', 'poker', 'hp', 'stopwatch', 'def', 'crit', 'hp', 'poker', 'critDmg'];
    for (const bot of BOT_LEVELS.filter((b) => b.boss)) {
      let mine = FRESH_TREE;
      for (let i = 0; i < 200; i++) if (canBuy(mine, order[i % order.length], bot.level - 1)) mine = buy(mine, order[i % order.length]);
      let wins = 0;
      for (let g = 0; g < 150; g++) {
        let s = start(`dress${bot.level}:${g}`, [{ name: 'A', tree: mine, costume: 'tungtung' }, botFighter(bot)]);
        while (s.winner === null) s = apply(s, botMove(s, s.turn, { spread: 500 }), s.turn)!;
        if (s.winner === 0) wins++;
      }
      expect(wins / 150, `boss ${bot.level}`).toBeLessThan(0.95);
    }
  });
});

describe('Summon', () => {
  const rng = (seed: string) => stream(seed);

  it('pulls at the published rates', () => {
    const counts = { common: 0, rare: 0, epic: 0, legendary: 0 };
    const draw = rng('rates');
    for (let i = 0; i < 20000; i++) counts[pullOnce(draw, 0).pulled.rarity]++;
    for (const r of Object.keys(counts) as (keyof typeof counts)[]) expect(Math.abs(counts[r] / 20000 - RATES[r] / 1000), r).toBeLessThan(0.015);
  });

  it('gives a Legendary on the pity pull at the latest', () => {
    const draw = rng('pity');
    let pity = 0;
    let since = 0;
    for (let i = 0; i < 5000; i++) {
      const next = pullOnce(draw, pity);
      since++;
      if (next.pulled.rarity === 'legendary') {
        expect(since).toBeLessThanOrEqual(PITY);
        since = 0;
      }
      pity = next.pity;
    }
    expect(pullOnce(draw, PITY - 1).pulled.rarity).toBe('legendary');
  });

  it('puts a Rare or better in every ten', () => {
    const draw = rng('ten');
    for (let i = 0; i < 500; i++) {
      const { pulled } = pullTen(draw, 0);
      expect(pulled).toHaveLength(10);
      expect(pulled.some((p) => p.rarity !== 'common')).toBe(true);
    }
  });

  it('pools every costume and part once, and prices repeats and wins', () => {
    expect(new Set(ALL_ITEMS).size).toBe(ALL_ITEMS.length);
    for (const c of COSTUMES) expect(rarityOf(costumeItem(c.id))).toBe(c.rarity);
    expect(POOL.common).toEqual(SUMMON_PARTS);
    expect(REFUND.legendary).toBeGreaterThan(REFUND.common);
    expect(gemsFor({ kind: 'bot', boss: true, first: true })).toBe(150);
    expect(gemsFor({ kind: 'bot', boss: false, first: false })).toBe(10);
    expect(gemsFor({ kind: 'arena', won: true })).toBe(20);
  });
});
