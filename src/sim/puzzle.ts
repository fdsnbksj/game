import { BALANCE_VERSION, ITEMS, SHOP_ODDS, UNITS, getUnit, type Cost, type Star } from './balance';
import { simulate, type Placed } from './combat';
import { copies } from './economy';
import { SIDE_CELLS } from './hex';
import { stream, type Rng } from './rng';

// Battle puzzles: a rival already placed, and a hand of creatures to place against it.
// Levels are made from their number alone, so they go on forever and are the same for
// everyone. Each one is played through before it's handed out, so it can be won.
//
// Difficulty is how rarely a placement wins. The rival is drawn first; then the hand is
// made stronger or weaker a step at a time until only about `targetShare(level)` of a
// sample of sensible and random placements beat it, and one that does is kept as the
// solution (it proves the level can be won, and gives the hint).

/** Bump when the generator changes: every level changes with it, so it starts a new ladder. */
export const PUZZLE_VERSION = 1;
/** Levels depend on the generator and on every fight rule, so a ladder is both versions. */
export const LADDER_VERSION = PUZZLE_VERSION * 1000 + BALANCE_VERSION;

export interface HandUnit {
  unitId: string;
  star: Star;
}

export interface Puzzle {
  level: number;
  /** The rival, on its own board's cells. */
  enemy: Placed[];
  /** What the player places, in bench order. */
  hand: HandUnit[];
  /** Items to give out, if any. */
  items: string[];
  /** The rival's health and damage, as a percent; above 100 on deep levels. */
  rivalPercent: number;
  /** A placement of exactly the hand (and items) that wins. */
  solution: Placed[];
  /** Share of the sampled placements that won, 0–1. */
  share: number;
  /** Fights it took to make, for tests and tuning. */
  fights: number;
}

/** Placements tried per candidate hand. */
const SAMPLES = 40;
/** Hand adjustments before settling for the closest candidate. */
const STEPS = 20;

export const puzzleSeed = (level: number) => `puzzle:${LADDER_VERSION}:${level}`;

/** Units on each side: 2 at first, one more every four levels, up to a full board of 8. */
export const puzzleSize = (level: number) => Math.min(8, 2 + Math.floor((level - 1) / 4));

/** How rarely a placement should win: half of them at level 1, one in twenty by level 30. */
export const targetShare = (level: number) => Math.max(0.05, 0.5 * 0.92 ** (level - 1));

/** Deep levels make the rival itself stronger, 2% a level after 40. */
const rivalPercentAt = (level: number) => 100 + Math.max(0, level - 40) * 2;

/** The shop level whose odds pick the costs of both sides. */
const tierLevel = (level: number) => Math.min(8, 1 + Math.floor(level / 3));

function pickCost(rng: Rng, level: number): Cost {
  const odds = SHOP_ODDS[tierLevel(level)];
  const roll = rng(100);
  let sum = 0;
  for (let cost = 1; cost <= 5; cost++) {
    sum += odds[cost - 1];
    if (roll < sum) return cost as Cost;
  }
  return 1;
}

function pickUnit(rng: Rng, cost: Cost): string {
  const choices = UNITS.filter((unit) => unit.cost === cost);
  return choices[rng(choices.length)].id;
}

function pickStar(rng: Rng, level: number): Star {
  const roll = rng(100);
  if (roll < Math.min(40, Math.max(0, (level - 30) * 2))) return 3;
  if (roll < Math.min(70, Math.max(0, (level - 8) * 4))) return 2;
  return 1;
}

const FRONT = [3, 2, 4, 1, 5, 0, 6];
const MIDDLE = [10, 9, 11, 8, 12, 7, 13];
const BACK = [24, 23, 25, 22, 26, 21, 27, 17, 16, 18];

/** Where a unit would sensibly stand: melee up front, casters at the back, the rest between. */
function preferred(unitId: string): number[] {
  const def = getUnit(unitId);
  if (def.range === 1) return [...FRONT, ...MIDDLE];
  return def.role === 'caster' ? [...BACK, ...MIDDLE] : [...MIDDLE, ...BACK];
}

/** A sensible layout, jittered: each unit takes one of the first few free cells it likes. */
function sensibleCells(rng: Rng, unitIds: readonly string[]): number[] {
  const used = new Set<number>();
  return unitIds.map((unitId) => {
    const free = preferred(unitId).filter((cell) => !used.has(cell));
    const cell = free.length > 0 ? free[rng(Math.min(3, free.length))] : firstFree(used);
    used.add(cell);
    return cell;
  });
}

/** 0 to n − 1 in a random order. */
function shuffled(rng: Rng, n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

const randomCells = (rng: Rng, count: number) => shuffled(rng, SIDE_CELLS).slice(0, count);

function firstFree(used: Set<number>): number {
  for (let cell = 0; cell < SIDE_CELLS; cell++) if (!used.has(cell)) return cell;
  return 0;
}

/** Items go to distinct creatures, in the order drawn. */
function withItems(rng: Rng, units: Placed[], items: readonly string[]): Placed[] {
  const order = shuffled(rng, units.length);
  return units.map((unit, i) => {
    const slot = order.indexOf(i);
    return slot >= 0 && slot < items.length ? { ...unit, item: items[slot] } : unit;
  });
}

/** How much a creature is worth, by the copies it's made of. */
const power = (unit: HandUnit) => getUnit(unit.unitId).cost * copies(unit.star);

/** One step weaker: the strongest creature drops a star, or becomes a cheaper one. Null if it can't. */
function weaken(rng: Rng, hand: HandUnit[]): HandUnit[] | null {
  const order = hand.map((unit, i) => ({ unit, i })).sort((x, y) => power(y.unit) - power(x.unit) || x.i - y.i);
  for (const { unit, i } of order) {
    const cost = getUnit(unit.unitId).cost;
    let next: HandUnit | null = null;
    if (unit.star > 1) next = { unitId: unit.unitId, star: (unit.star - 1) as Star };
    else if (cost > 1) next = { unitId: pickUnit(rng, (cost - 1) as Cost), star: 1 };
    if (next) return hand.map((h, j) => (j === i ? next : h));
  }
  return null;
}

/** One step stronger: the weakest creature becomes a dearer one, or gains a star. Null if it can't. */
function strengthen(rng: Rng, hand: HandUnit[]): HandUnit[] | null {
  const order = hand.map((unit, i) => ({ unit, i })).sort((x, y) => power(x.unit) - power(y.unit) || x.i - y.i);
  for (const { unit, i } of order) {
    const cost = getUnit(unit.unitId).cost;
    let next: HandUnit | null = null;
    if (cost < 5 && unit.star === 1) next = { unitId: pickUnit(rng, (cost + 1) as Cost), star: 1 };
    else if (unit.star < 3) next = { unitId: unit.unitId, star: (unit.star + 1) as Star };
    if (next) return hand.map((h, j) => (j === i ? next : h));
  }
  return null;
}

interface Trial {
  hand: HandUnit[];
  rivalPercent: number;
  share: number;
  solution: Placed[] | null;
  fights: number;
}

/**
 * Plays a hand against the rival in SAMPLES placements, half sensible and half random.
 * Stops early once it has clearly won too often to be hard enough.
 */
function trial(level: number, step: number, hand: HandUnit[], items: readonly string[], enemy: Placed[], rivalPercent: number, target: number): Trial {
  const rng = stream(`${puzzleSeed(level)}:place:${step}`);
  const seed = puzzleSeed(level);
  const ids = hand.map((unit) => unit.unitId);
  let wins = 0;
  let fights = 0;
  let solution: Placed[] | null = null;
  for (let sample = 0; sample < SAMPLES; sample++) {
    const cells = sample % 2 === 0 ? sensibleCells(rng, ids) : randomCells(rng, hand.length);
    const placed = withItems(
      rng,
      hand.map((unit, i) => ({ unitId: unit.unitId, star: unit.star, cell: cells[i] })),
      items,
    );
    fights += 1;
    if (simulate(placed, enemy, seed, rivalPercent).winner === 'a') {
      wins += 1;
      solution ??= placed;
      if (wins > Math.ceil(target * SAMPLES)) break;
    }
  }
  return { hand, rivalPercent, share: wins / fights, solution, fights };
}

/** Level `level`, the same on every device. Levels start at 1. */
export function puzzle(level: number): Puzzle {
  const rng = stream(`${puzzleSeed(level)}:draw`);
  const size = puzzleSize(level);
  const target = targetShare(level);
  let rivalPercent = rivalPercentAt(level);

  const enemyIds = Array.from({ length: size }, () => pickUnit(rng, pickCost(rng, level)));
  const enemyCells = sensibleCells(rng, enemyIds);
  const itemCount = level >= 10 ? Math.min(size, Math.floor((level - 6) / 4)) : 0;
  const drawItems = () => Array.from({ length: itemCount }, () => ITEMS[rng(ITEMS.length)].id);
  const enemy = withItems(
    rng,
    enemyIds.map((unitId, i) => ({ unitId, star: pickStar(rng, level), cell: enemyCells[i] })),
    drawItems(),
  );
  const items = drawItems();
  let hand: HandUnit[] = Array.from({ length: size }, () => ({ unitId: pickUnit(rng, pickCost(rng, level)), star: pickStar(rng, level) }));

  let fights = 0;
  let best: Trial | null = null;
  const closer = (a: Trial, b: Trial | null) => !b || Math.abs(a.share - target) < Math.abs(b.share - target);
  for (let step = 0; ; step++) {
    const result = trial(level, step, hand, items, enemy, rivalPercent, target);
    fights += result.fights;
    // In the band: at most the target, and at least half of it, so early levels stay easy.
    const tooHard = !result.solution || result.share < target / 2;
    if (!tooHard && result.share <= target) {
      best = result;
      break;
    }
    if (result.solution && closer(result, best)) best = result;
    if (step >= STEPS && best) break;
    // Every step makes the hand stronger or the rival gentler, so this can't run away.
    if (step > 200) throw new Error(`Puzzle ${level} has no winning placement`);
    // Too easy: a weaker hand. Too hard: a stronger one, and past that a gentler rival.
    const next = tooHard ? strengthen(rng, hand) : weaken(rng, hand);
    if (next) hand = next;
    else if (tooHard) rivalPercent = Math.max(50, rivalPercent - 10);
    else break;
  }

  return { level, enemy, hand: best!.hand, items, rivalPercent: best!.rivalPercent, solution: best!.solution!, share: best!.share, fights };
}
