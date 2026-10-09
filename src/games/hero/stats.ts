import { NO_BONUS, type Bonus } from './costumes';

// A hero's growth: one skill tree that holds the four skills and the four stats. Every
// point comes from clearing a bot level for the first time (BOT_LEVELS in bots.ts), and
// points are scarce (the user's design): a skill costs 5 to unlock, then each level one
// more than the last; a stat's level N costs N; a reset costs a point more each time. All
// the numbers a designer might tune live here and in skills.ts.

export type SkillId = 'stopwatch' | 'speed' | 'poker' | 'roulette';
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
  /** A skill's cooldown: how many of your own turns it sits out after you use it. */
  cooldown?: number;
}

export const NODES: readonly NodeInfo[] = [
  { id: 'stopwatch', name: 'Stopwatch', group: 'all', per: '+4 power', max: 10, cooldown: 0 },
  { id: 'speed', name: "I'm Speed", group: 'all', per: '+5 power', max: 10, needs: { node: 'stopwatch', level: 5 }, cooldown: 1 },
  { id: 'poker', name: 'Poker', group: 'gambler', per: '+10 damage', max: 10, needs: { node: 'stopwatch', level: 2 }, cooldown: 2 },
  { id: 'roulette', name: 'Roulette', group: 'gambler', per: '+1 ball at Lv 5 and 10, else +5 punch damage', max: 10, needs: { node: 'poker', level: 5 }, cooldown: 3 },
  { id: 'hp', name: 'HP', group: 'body', per: '+15 HP', max: 10 },
  { id: 'def', name: 'DEF', group: 'body', per: '+2 DEF', max: 10 },
  { id: 'crit', name: 'Crit', group: 'body', per: '+3% crit', max: 10 },
  { id: 'critDmg', name: 'Crit dmg', group: 'body', per: '+10% crit damage', max: 10 },
];

export const SKILLS: readonly SkillId[] = ['stopwatch', 'speed', 'poker', 'roulette'];
const isSkillNode = (node: NodeId): node is SkillId => (SKILLS as readonly string[]).includes(node);

/** Skills a fight can bring (the loadout). */
export const LOADOUT_SIZE = 4;

/** How many of your own turns a skill sits out after you use it. */
export const cooldownOf = (skill: SkillId) => NODES.find((n) => n.id === skill)!.cooldown ?? 0;

/** A new hero: the stopwatch, nothing else. */
export const FRESH_TREE: Tree = { stopwatch: 1, speed: 0, poker: 0, roulette: 0, hp: 0, def: 0, crit: 0, critDmg: 0 };

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
export const rewardFor = (level: number) => (isBoss(level) ? 2 : 1);

/** Points earned by clearing levels 1..cleared. firestore.rules keeps a copy (heroPoints). */
export function pointsFor(cleared: number): number {
  return cleared + Math.floor(cleared / 5);
}

/** A skill costs 5 to unlock. */
export const UNLOCK_COST = 5;

/** The price of taking a node to level `to`: a skill 5 to unlock then `to - 1`; a stat `to`. The Stopwatch's first level is free. */
export function levelCost(node: NodeId, to: number): number {
  if (!isSkillNode(node)) return to;
  if (to === 1) return node === 'stopwatch' ? 0 : UNLOCK_COST;
  return to - 1;
}

/** What a node at `level` cost, all told. firestore.rules has a copy (heroTreeCost2, doubled). */
export function nodeCost(node: NodeId, level: number): number {
  if (!isSkillNode(node)) return (level * (level + 1)) / 2;
  const unlock = level >= 1 && node !== 'stopwatch' ? UNLOCK_COST : 0;
  return unlock + (level * (level - 1)) / 2;
}

/** Points in the tree. */
export const spent = (tree: Tree) => NODES.reduce((sum, n) => sum + nodeCost(n.id, tree[n.id]), 0);

/** What the n-th reset costs: 1, then 2, and so on. */
export const resetCost = (n: number) => n;
/** Points burned by `resets` resets. */
export const burned = (resets: number) => (resets * (resets + 1)) / 2;

/** Points still to spend. */
export const available = (tree: Tree, cleared: number, resets = 0) => pointsFor(cleared) - burned(resets) - spent(tree);

/** Whether another reset is affordable: its price comes out of the points the tree gives back. */
export const canReset = (cleared: number, resets: number) => pointsFor(cleared) - burned(resets + 1) >= 0;

/** A hero's level, shown everywhere: one plus every point spent. */
export const heroLevel = (tree: Tree) => 1 + spent(tree);

export function canBuy(tree: Tree, node: NodeId, cleared: number, resets = 0): boolean {
  const info = NODES.find((n) => n.id === node);
  if (!info || tree[node] >= info.max) return false;
  if (info.needs && tree[info.needs.node] < info.needs.level) return false;
  return levelCost(node, tree[node] + 1) <= available(tree, cleared, resets);
}

export const buy = (tree: Tree, node: NodeId): Tree => ({ ...tree, [node]: tree[node] + 1 });

/** A tree from storage or the network, or null if it isn't one a hero could have. A tree from before I'm Speed has it at 0. */
export function validTree(value: unknown, cleared = BOT_COUNT, resets = 0): Tree | null {
  if (!value || typeof value !== 'object') return null;
  const tree = {} as Tree;
  for (const n of NODES) {
    const v = (value as Record<string, unknown>)[n.id] ?? (n.id === 'speed' ? 0 : undefined);
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > n.max) return null;
    tree[n.id] = v;
  }
  if (tree.stopwatch < 1 || available(tree, cleared, resets) < 0) return null;
  return tree;
}

/** Whether `next` is `tree` with points added (never taken away) and is a tree a hero with `cleared` could have. */
export function isUpgrade(tree: Tree, next: Tree, cleared: number, resets = 0): boolean {
  if (!validTree(next, cleared, resets)) return false;
  if (NODES.some((n) => next[n.id] < tree[n.id])) return false;
  return NODES.every((n) => !n.needs || next[n.id] === 0 || next[n.needs.node] >= n.needs.level);
}

/** A loadout from storage or the network: 1 to 4 different skills the tree has, or null. */
export function validLoadout(value: unknown, tree: Tree): SkillId[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > LOADOUT_SIZE) return null;
  if (new Set(value).size !== value.length) return null;
  if (!value.every((s) => isSkillNode(s) && tree[s] >= 1)) return null;
  return value as SkillId[];
}

/** The loadout a tree brings when none was chosen: its first four skills. */
export const defaultLoadout = (tree: Tree): SkillId[] => SKILLS.filter((s) => tree[s] >= 1).slice(0, LOADOUT_SIZE);
