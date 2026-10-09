import { NO_BONUS, type Bonus } from './costumes';

// A hero's growth: one skill tree that holds the three skills and the four stats. Every
// point comes from clearing a bot level for the first time (BOT_LEVELS in bots.ts). All the
// numbers a designer might tune live here and in skills.ts.

export type SkillId = 'stopwatch' | 'roulette' | 'poker';
export type StatId = 'hp' | 'def' | 'crit' | 'critDmg';
export type NodeId = SkillId | StatId;
export type Tree = Record<NodeId, number>;

/** The tree's three branches. */
export type GroupId = 'all' | 'gambler' | 'body';

export const GROUPS: readonly { id: GroupId; name: string; blurb: string }[] = [
  { id: 'all', name: 'All skills', blurb: 'Anyone can use these' },
  { id: 'gambler', name: 'Gambler', blurb: 'Luck-based moves' },
  { id: 'body', name: 'Body', blurb: 'Tougher, crittier' },
];

export interface NodeInfo {
  id: NodeId;
  name: string;
  group: GroupId;
  /** What one more level does, in a few words. */
  per: string;
  max: number;
  /** Another node that must reach a level before this one opens. */
  needs?: { node: NodeId; level: number };
}

export const NODES: readonly NodeInfo[] = [
  { id: 'stopwatch', name: 'Stopwatch', group: 'all', per: '+4 power', max: 10 },
  { id: 'roulette', name: 'Roulette', group: 'gambler', per: '+1 ball at Lv 5 and 10, else +5 punch damage', max: 10, needs: { node: 'stopwatch', level: 2 } },
  { id: 'poker', name: 'Poker', group: 'gambler', per: '+10 damage', max: 10, needs: { node: 'roulette', level: 2 } },
  { id: 'hp', name: 'HP', group: 'body', per: '+15 HP', max: 10 },
  { id: 'def', name: 'DEF', group: 'body', per: '+2 DEF', max: 10 },
  { id: 'crit', name: 'Crit', group: 'body', per: '+3% crit', max: 10 },
  { id: 'critDmg', name: 'Crit dmg', group: 'body', per: '+10% crit damage', max: 10 },
];

export const SKILLS: readonly SkillId[] = ['stopwatch', 'roulette', 'poker'];

/** A new hero: the stopwatch, nothing else. */
export const FRESH_TREE: Tree = { stopwatch: 1, roulette: 0, poker: 0, hp: 0, def: 0, crit: 0, critDmg: 0 };

export interface Stats {
  hp: number;
  def: number;
  /** Percent. */
  crit: number;
  /** Percent: 150 is ×1.5. */
  critDmg: number;
}

/** A hero's stats from its tree, plus a costume's bonus (costumes.ts) if it wears one. */
export function statsOf(tree: Tree, bonus: Bonus = NO_BONUS): Stats {
  const hp = 100 + 15 * tree.hp;
  return {
    hp: hp + Math.floor((hp * bonus.hpPct) / 100),
    def: 2 * tree.def + bonus.def,
    crit: Math.min(50, 5 + 3 * tree.crit + bonus.crit),
    critDmg: 150 + 10 * tree.critDmg + bonus.critDmg,
  };
}

/** Bosses every fifth level. */
export const isBoss = (level: number) => level % 5 === 0;
export const BOT_COUNT = 20;
/** The points one bot level gives the first time it's cleared. */
export const rewardFor = (level: number) => (isBoss(level) ? 3 : 1);

/** Points earned by clearing levels 1..cleared. firestore.rules keeps a copy (heroPoints). */
export function pointsFor(cleared: number): number {
  return cleared + 2 * Math.floor(cleared / 5);
}

/** Points in the tree; the free starting stopwatch level isn't one. */
export const spent = (tree: Tree) => NODES.reduce((sum, n) => sum + tree[n.id], 0) - 1;

/** A hero's level, shown everywhere: one plus every point spent. */
export const heroLevel = (tree: Tree) => 1 + spent(tree);

export function canBuy(tree: Tree, node: NodeId, cleared: number): boolean {
  const info = NODES.find((n) => n.id === node);
  if (!info || tree[node] >= info.max) return false;
  if (info.needs && tree[info.needs.node] < info.needs.level) return false;
  return spent(tree) < pointsFor(cleared);
}

export const buy = (tree: Tree, node: NodeId): Tree => ({ ...tree, [node]: tree[node] + 1 });

/** A tree from storage or the network, or null if it isn't one a hero could have. */
export function validTree(value: unknown, cleared = BOT_COUNT): Tree | null {
  if (!value || typeof value !== 'object') return null;
  const tree = {} as Tree;
  for (const n of NODES) {
    const v = (value as Record<string, unknown>)[n.id];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > n.max) return null;
    tree[n.id] = v;
  }
  if (tree.stopwatch < 1 || spent(tree) > pointsFor(cleared)) return null;
  return tree;
}

/** Whether `next` is `tree` with points added (never taken away) and is a tree a hero with `cleared` could have. */
export function isUpgrade(tree: Tree, next: Tree, cleared: number): boolean {
  if (!validTree(next, cleared)) return false;
  if (NODES.some((n) => next[n.id] < tree[n.id])) return false;
  return NODES.every((n) => !n.needs || next[n.id] === 0 || next[n.needs.node] >= n.needs.level);
}
