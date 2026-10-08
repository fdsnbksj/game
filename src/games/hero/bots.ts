import { stream } from '../../nonogram/rng';
import { stopwatchTarget, WHEEL, type Move } from './skills';
import { BOT_COUNT, FRESH_TREE, isBoss, NODES, type NodeId, type Tree } from './stats';
import { usable, type HeroState, type Side } from './state';

// The bot ladder: twenty levels, a boss every fifth. Each one is a hero built with a fixed
// number of points spent in a fixed order, plus how far off its stopwatch stops can be.

export interface BotLevel {
  level: number;
  name: string;
  boss: boolean;
  tree: Tree;
  /** The bot's stopwatch stops land up to this many ms either side of the target. */
  spread: number;
}

const NAMES = [
  'Pocket Watch', 'Lucky Penny', 'Card Shark', 'Dice Kid', 'The Croupier',
  'Second Hand', 'Snake Eyes', 'Wild Card', 'High Roller', 'The Dealer',
  'Pendulum', 'Red or Black', 'Full House', 'Jackpot', 'The House',
  'Hourglass', 'Double Zero', 'Royal Flush', 'Loaded Die', 'The Clockmaker',
];

/** The order a bot spends its points: skills as they open, then stats round and round. */
const ORDER: NodeId[] = ['stopwatch', 'hp', 'stopwatch', 'def', 'hp', 'crit', 'stopwatch', 'critDmg', 'hp', 'def', 'stopwatch', 'crit', 'hp', 'critDmg'];

function botTree(level: number, points: number): Tree {
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

export const BOT_LEVELS: readonly BotLevel[] = Array.from({ length: BOT_COUNT }, (_, i) => {
  const level = i + 1;
  const boss = isBoss(level);
  // About what the player has by then, a little more at a boss.
  const points = Math.floor((level - 1) * 1.3) + (boss ? 3 : 0);
  return { level, name: NAMES[i], boss, tree: botTree(level, points), spread: 2500 - Math.floor(((level - 1) * 2200) / (BOT_COUNT - 1)) - (boss ? 150 : 0) };
});

/** The bot's move on its turn: a skill weighted toward its strongest, and its stop or pick. Arena defenders use it too. */
export function botMove(state: HeroState, side: Side, bot: Pick<BotLevel, 'spread'>): Move {
  const turn = state.log.length;
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
