// Every hero is the same (the user's design, 2026-10-11: a game only for playing a friend):
// the same stats and every skill at level 1. The game picks each turn's skill (the user's
// ask, 2026-10-18). The numbers a designer might tune live here and in skills.ts.

export type SkillId = 'stopwatch' | 'speed' | 'memory' | 'fast' | 'roulette' | 'jackpot';
export type NodeId = SkillId | 'hp' | 'def' | 'crit' | 'critDmg';
/** Levels for each skill and stat; every hero has HERO_TREE. */
export type Tree = Record<NodeId, number>;

/** The skills a turn is drawn from. */
export const EVERYDAY: readonly SkillId[] = ['stopwatch', 'speed', 'memory', 'fast'];
/** At LAST_STAND_HP or less, the turn is one of these instead: a gamble for an instant kill. */
export const LAST_STAND: readonly SkillId[] = ['roulette', 'jackpot'];
export const LAST_STAND_HP = 30;
export const SKILLS: readonly SkillId[] = [...EVERYDAY, ...LAST_STAND];

/** Every hero: each skill at level 1, and 150 HP (the user's ask, 2026-10-19; it was 200, and 100 before that). */
export const HERO_TREE: Tree = { stopwatch: 1, speed: 1, memory: 1, fast: 1, roulette: 1, jackpot: 1, hp: 0, def: 0, crit: 0, critDmg: 0 };

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
    hp: 150 + 15 * tree.hp,
    def: 2 * tree.def,
    crit: Math.min(50, 5 + 3 * tree.crit),
    critDmg: 150 + 10 * tree.critDmg,
  };
}

export const HERO_STATS: Stats = statsOf(HERO_TREE);
