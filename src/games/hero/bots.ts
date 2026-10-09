import { stream } from '../../nonogram/rng';
import { monsterChoice, type AttackId, type Family, type Kit } from './monsters';
import { RANKS, stopwatchTarget, WHEEL, type Move } from './skills';
import { buy, BOT_COUNT, canBuy, FRESH_TREE, isBoss, pointsFor, spent, type NodeId, type StatId, type Tree } from './stats';
import { ready, type Fighter, type HeroState, type Side } from './state';

// The bot ladder: twenty levels, a boss every fifth. Each one is a creature with a kit of
// attacks (monsters.ts) and stats from a fixed number of points. The bot brain here also
// plays arena defenders, which are heroes with skills; `spread` is how far off their
// stopwatch stops can be.

export interface BotLevel {
  level: number;
  name: string;
  boss: boolean;
  /** Its stats; it has no skills. */
  tree: Tree;
  kit: Kit;
  /** A hero's stopwatch stops land up to this many ms either side of the target. */
  spread: number;
}

const FAMILIES: Family[] = [
  'clock', 'coin', 'card', 'dice', 'wheel',
  'clock', 'dice', 'card', 'coin', 'card',
  'clock', 'wheel', 'card', 'coin', 'wheel',
  'clock', 'wheel', 'card', 'dice', 'clock',
];

/** Each level's attacks: more, and nastier, as the ladder climbs; every boss has a finisher. */
const KITS: AttackId[][] = [
  ['strike', 'jab'],
  ['strike', 'jab', 'brace'],
  ['strike', 'slam', 'brace'],
  ['strike', 'jab', 'rattle'],
  ['strike', 'slam', 'windup', 'finisher'],
  ['strike', 'scorch', 'jab'],
  ['strike', 'drain', 'smoke'],
  ['slam', 'jab', 'rattle', 'brace'],
  ['strike', 'scorch', 'windup'],
  ['slam', 'scorch', 'windup', 'finisher'],
  ['strike', 'drain', 'smoke', 'brace'],
  ['slam', 'jab', 'rattle', 'scorch'],
  ['strike', 'drain', 'windup', 'smoke'],
  ['slam', 'scorch', 'rattle', 'brace'],
  ['slam', 'drain', 'smoke', 'finisher'],
  ['strike', 'scorch', 'windup', 'rattle'],
  ['slam', 'drain', 'smoke', 'brace'],
  ['strike', 'scorch', 'rattle', 'windup'],
  ['slam', 'drain', 'scorch', 'smoke'],
  ['slam', 'drain', 'scorch', 'rattle', 'windup', 'finisher'],
];

const NAMES = [
  'Pocket Watch', 'Lucky Penny', 'Card Shark', 'Dice Kid', 'The Croupier',
  'Second Hand', 'Snake Eyes', 'Wild Card', 'High Roller', 'The Dealer',
  'Pendulum', 'Red or Black', 'Full House', 'Jackpot', 'The House',
  'Hourglass', 'Double Zero', 'Royal Flush', 'Loaded Die', 'The Clockmaker',
];

/**
 * The order a hero spends its points, as a player might: the stopwatch and some HP, Poker
 * once it opens, I'm Speed, then stats round and round. A node it can't afford yet is
 * skipped for now. The arena's stand-in hero and the ladder's test both spend this way.
 */
export const BUY_ORDER: NodeId[] = [
  'stopwatch', 'hp', 'stopwatch', 'poker', 'def', 'stopwatch', 'hp', 'crit', 'stopwatch', 'speed',
  'poker', 'hp', 'def', 'crit', 'critDmg', 'poker', 'hp', 'speed', 'def', 'crit', 'critDmg', 'stopwatch',
];

/** A tree with `points` spent in BUY_ORDER, then whatever's left on the cheapest stats. */
export function spendPoints(points: number): Tree {
  let tree = { ...FRESH_TREE };
  const afford = (node: NodeId) => canBuy(tree, node, BOT_COUNT) && spent(buy(tree, node)) <= points;
  for (let round = 0; round < 4; round++) for (const node of BUY_ORDER) if (afford(node)) tree = buy(tree, node);
  for (let i = 0; i < 40; i++) {
    const cheapest = (['hp', 'def', 'crit', 'critDmg'] as NodeId[]).filter(afford).sort((a, b) => tree[a] - tree[b])[0];
    if (!cheapest) break;
    tree = buy(tree, cheapest);
  }
  return tree;
}

/** A hero with what a player has by a level: the arena's sparring partner while it's empty. */
export const sparringTree = (level: number): Tree => spendPoints(pointsFor(level - 1) + (isBoss(level) ? 2 : 0));

/** The order a creature spends its points: stats only. */
const STAT_ORDER: StatId[] = ['hp', 'def', 'hp', 'crit', 'hp', 'critDmg'];

function creatureTree(level: number): Tree {
  const tree: Tree = { ...FRESH_TREE, stopwatch: 0 };
  for (let i = 0, points = Math.floor(((level - 1) * 3) / 4); points > 0 && i < 200; i++) {
    const node = STAT_ORDER[i % STAT_ORDER.length];
    if (tree[node] < 10) {
      tree[node]++;
      points--;
    }
  }
  return tree;
}

/** A 100% attack's damage at a level. */
const powerAt = (level: number) => 11 + Math.floor((level * 3) / 2) - (isBoss(level) ? 2 + Math.floor(level / 5) : 0);

export const BOT_LEVELS: readonly BotLevel[] = Array.from({ length: BOT_COUNT }, (_, i) => {
  const level = i + 1;
  const boss = isBoss(level);
  return {
    level,
    name: NAMES[i],
    boss,
    tree: creatureTree(level),
    kit: { family: FAMILIES[i], attacks: KITS[i], power: powerAt(level), enrage: boss },
    spread: 2500 - Math.floor(((level - 1) * 2200) / (BOT_COUNT - 1)) - (boss ? 150 : 0),
  };
});

/** A bot level as it fights. */
export const botFighter = (bot: BotLevel): Fighter => ({ name: bot.name, tree: bot.tree, kit: bot.kit });

/**
 * The bot's move on its turn. A creature picks from its kit; a hero (an arena defender)
 * picks a skill weighted toward its strongest, and its stop or pick.
 */
export function botMove(state: HeroState, side: Side, bot: Pick<BotLevel, 'spread'>): Move {
  const turn = state.log.length;
  // The other side played Poker: pick a card of the twelve left.
  if (state.pending) return { skill: 'card', pick: (state.pending.pick + 1 + stream(`${state.seed}:bot:${turn}:card`)(RANKS - 1)) % RANKS };
  const kit = state.fighters[side].kit;
  if (kit) {
    const them = side === 0 ? 1 : 0;
    const hurt = state.hp[side] * 2 < state.stats[side].hp;
    return { skill: 'attack', id: monsterChoice(kit, state.effects[side], state.effects[them], hurt, state.seed, turn) };
  }
  const rng = stream(`${state.seed}:bot:${turn}`);
  const tree = state.fighters[side].tree;
  const choices = ready(state, side);
  if (!choices.length) return { skill: 'rest' };
  const weight = { stopwatch: 4, speed: 4 + tree.speed, roulette: 1 + tree.roulette, poker: 2 + tree.poker };
  const weights = choices.map((skill) => ({ skill, w: weight[skill] }));
  let roll = rng(weights.reduce((sum, x) => sum + x.w, 0));
  const skill = weights.find((x) => (roll -= x.w) < 0)!.skill;
  if (skill === 'roulette') return { skill, pick: rng(WHEEL) };
  if (skill === 'poker') return { skill, pick: rng(RANKS) };
  if (skill === 'speed') return { skill, ms: 150 + rng(Math.floor(bot.spread / 5) + 1) };
  const off = rng(2 * bot.spread + 1) - bot.spread;
  return { skill, ms: Math.max(0, stopwatchTarget(state.seed, turn) + off) };
}
