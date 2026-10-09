import { stream } from '../../nonogram/rng';
import { monsterChoice, type AttackId, type Family, type Kit } from './monsters';
import { stopwatchTarget, WHEEL, type Move } from './skills';
import { BOT_COUNT, FRESH_TREE, isBoss, NODES, type NodeId, type StatId, type Tree } from './stats';
import { usable, type Fighter, type HeroState, type Side } from './state';

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

/** The order a hero stand-in spends its points: skills as they open, then stats round and round. */
const ORDER: NodeId[] = ['stopwatch', 'hp', 'stopwatch', 'def', 'hp', 'crit', 'stopwatch', 'critDmg', 'hp', 'def', 'stopwatch', 'crit', 'hp', 'critDmg'];

/** About what the player has by a level, a little more at a boss. */
const pointsAt = (level: number) => Math.floor((level - 1) * 1.3) + (isBoss(level) ? 3 : 0);

/** A hero with a level's points, skills and all: the arena's sparring partner while it's empty. */
export function sparringTree(level: number): Tree {
  let points = pointsAt(level);
  const tree = { ...FRESH_TREE };
  const add = (node: NodeId) => {
    const max = NODES.find((n) => n.id === node)!.max;
    if (points > 0 && tree[node] < max) {
      tree[node]++;
      points--;
    }
  };
  if (level >= 6) for (let i = 0; i < Math.min(5, 1 + Math.floor((level - 6) / 3)); i++) add('roulette');
  if (level >= 11) for (let i = 0; i < Math.min(5, 1 + Math.floor((level - 11) / 3)); i++) add('poker');
  for (let i = 0; points > 0 && i < 200; i++) add(ORDER[i % ORDER.length]);
  return tree;
}

/** The order a creature spends its points: stats only. */
const STAT_ORDER: StatId[] = ['hp', 'def', 'hp', 'crit', 'hp', 'critDmg'];

function creatureTree(level: number): Tree {
  const tree: Tree = { ...FRESH_TREE, stopwatch: 0 };
  for (let i = 0, points = Math.floor((level - 1) * 1.3); points > 0 && i < 200; i++) {
    const node = STAT_ORDER[i % STAT_ORDER.length];
    if (tree[node] < 10) {
      tree[node]++;
      points--;
    }
  }
  return tree;
}

/** A 100% attack's damage at a level. */
const powerAt = (level: number) => 10 + 2 * level - (isBoss(level) ? 2 + Math.floor(level / 5) : 0);

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
  const kit = state.fighters[side].kit;
  if (kit) {
    const them = side === 0 ? 1 : 0;
    const hurt = state.hp[side] * 2 < state.stats[side].hp;
    return { skill: 'attack', id: monsterChoice(kit, state.effects[side], state.effects[them], hurt, state.seed, turn) };
  }
  const rng = stream(`${state.seed}:bot:${turn}`);
  const tree = state.fighters[side].tree;
  const weights = usable(tree).map((skill) => ({ skill, w: skill === 'stopwatch' ? 4 : skill === 'roulette' ? 1 + tree.roulette : 2 + tree.poker }));
  let roll = rng(weights.reduce((sum, x) => sum + x.w, 0));
  const skill = weights.find((x) => (roll -= x.w) < 0)!.skill;
  if (skill === 'roulette') return { skill, pick: rng(WHEEL) };
  if (skill === 'poker') return { skill };
  const off = rng(2 * bot.spread + 1) - bot.spread;
  return { skill, ms: Math.max(0, stopwatchTarget(state.seed, turn) + off) };
}
