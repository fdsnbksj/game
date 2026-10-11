// Every hero is the same (the user's design, 2026-10-11: a game only for playing a friend):
// the same stats and all four skills at level 1. The numbers a designer might tune live here
// and in skills.ts.

export type SkillId = 'stopwatch' | 'speed' | 'poker' | 'roulette';
export type NodeId = SkillId | 'hp' | 'def' | 'crit' | 'critDmg';
/** Levels for each skill and stat; every hero has HERO_TREE. */
export type Tree = Record<NodeId, number>;

export const SKILLS: readonly SkillId[] = ['stopwatch', 'speed', 'poker', 'roulette'];

/** How many of your own turns a skill sits out after you use it (the user's design). */
const COOLDOWNS: Record<SkillId, number> = { stopwatch: 0, speed: 1, poker: 2, roulette: 3 };
export const cooldownOf = (skill: SkillId) => COOLDOWNS[skill];

/**
 * Every hero: each skill at level 1, and 250 HP (HP 10), so one won Poker (100 as a crit,
 * 150) hurts but doesn't end a fight on its own.
 */
export const HERO_TREE: Tree = { stopwatch: 1, speed: 1, poker: 1, roulette: 1, hp: 10, def: 0, crit: 0, critDmg: 0 };

export interface Stats {
  hp: number;
  def: number;
  /** Percent. */
  crit: number;
  /** Percent: 150 is ×1.5. */
  critDmg: number;
}

export function statsOf(tree: Tree): Stats {
  return {
    hp: 100 + 15 * tree.hp,
    def: 2 * tree.def,
    crit: Math.min(50, 5 + 3 * tree.crit),
    critDmg: 150 + 10 * tree.critDmg,
  };
}

export const HERO_STATS: Stats = statsOf(HERO_TREE);
