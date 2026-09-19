import { BENCH_SIZE, getUnit, MAX_LEVEL, MAX_ROUNDS, REROLL_COST, START_HP, XP_COST, XP_PER_BUY, XP_PER_ROUND, type Star } from './balance';
import type { BattleResult, Placed } from './combat';
import { copies, income, levelForXp, lossDamage, sellValue } from './economy';
import { SIDE_CELLS } from './hex';
import { rollShop, type Taken } from './shop';

// A run as plain, serializable data, and every change to it as a pure function. The UI,
// the AI and the tests all drive runs through these same functions.

export interface OwnedUnit {
  /** Unique within the run, so the UI can follow a unit as it moves. */
  uid: number;
  unitId: string;
  star: Star;
}

export interface RoundRecord {
  round: number;
  won: boolean;
  draw: boolean;
  damage: number;
  opponent: string;
}

export interface RunState {
  seed: string;
  round: number;
  hp: number;
  wins: number;
  gold: number;
  xp: number;
  level: number;
  /** Own-board cells 0–27. */
  board: (OwnedUnit | null)[];
  bench: (OwnedUnit | null)[];
  shop: (string | null)[];
  /** Rerolls this round; part of the shop's seed. */
  rolls: number;
  nextUid: number;
  wonLast: boolean;
  history: RoundRecord[];
  done: boolean;
}

export type Slot = { area: 'board' | 'bench'; index: number };

export function newRun(seed: string): RunState {
  const run: RunState = {
    seed,
    round: 1,
    hp: START_HP,
    wins: 0,
    gold: 0,
    xp: 0,
    level: 1,
    board: new Array(SIDE_CELLS).fill(null),
    bench: new Array(BENCH_SIZE).fill(null),
    shop: [],
    rolls: 0,
    nextUid: 1,
    wonLast: false,
    history: [],
    done: false,
  };
  return startPlanning(run);
}

/** Income, round XP and a free shop at the start of each round. */
function startPlanning(run: RunState): RunState {
  const gold = run.gold + income(run.round, run.gold, run.wonLast);
  const xp = run.round > 1 ? run.xp + XP_PER_ROUND : run.xp;
  const next = { ...run, gold, xp, level: levelForXp(xp), rolls: 0 };
  return { ...next, shop: freshShop(next) };
}

function freshShop(run: RunState): (string | null)[] {
  return rollShop(`${run.seed}:shop:${run.round}:${run.rolls}`, run.level, taken(run));
}

export function ownedUnits(run: RunState): OwnedUnit[] {
  return [...run.board, ...run.bench].filter((unit): unit is OwnedUnit => unit !== null);
}

export function boardUnits(run: RunState): Placed[] {
  return run.board.flatMap((unit, cell) => (unit ? [{ unitId: unit.unitId, star: unit.star, cell }] : []));
}

export function boardCount(run: RunState): number {
  return run.board.filter(Boolean).length;
}

function taken(run: RunState): Taken {
  const result: Taken = {};
  for (const unit of ownedUnits(run)) result[unit.unitId] = (result[unit.unitId] ?? 0) + copies(unit.star);
  return result;
}

/** Why an action can't happen right now, or null if it can. */
export function whyNotBuy(run: RunState, shopIndex: number): string | null {
  const unitId = run.shop[shopIndex];
  if (run.done || !unitId) return 'Nothing to buy';
  if (run.gold < getUnit(unitId).cost) return 'Not enough gold';
  // A full bench is fine if the new copy completes a 2-star.
  const sameOneStar = ownedUnits(run).filter((u) => u.unitId === unitId && u.star === 1).length;
  if (!run.bench.includes(null) && sameOneStar < 2) return 'Bench is full';
  return null;
}

export function buy(run: RunState, shopIndex: number): RunState {
  if (whyNotBuy(run, shopIndex)) return run;
  const unitId = run.shop[shopIndex]!;
  const unit: OwnedUnit = { uid: run.nextUid, unitId, star: 1 };
  const bench = [...run.bench];
  const free = bench.indexOf(null);
  let next: RunState = {
    ...run,
    gold: run.gold - getUnit(unitId).cost,
    shop: run.shop.map((id, i) => (i === shopIndex ? null : id)),
    nextUid: run.nextUid + 1,
  };
  if (free >= 0) {
    bench[free] = unit;
    next = { ...next, bench };
    return combine(next);
  }
  // Bench full: the new copy merges straight into the other two.
  return combine({ ...next, bench: [...bench, unit] }, true);
}

/**
 * Three copies of the same unit and star become one of the next star, repeatedly. The
 * merged unit takes the place of a copy on the board if there is one, else the first
 * bench copy.
 */
function combine(run: RunState, trimOverflow = false): RunState {
  let next = run;
  for (;;) {
    const groups = new Map<string, Slot[]>();
    next.board.forEach((u, index) => u && u.star < 3 && push(groups, `${u.unitId}:${u.star}`, { area: 'board', index }));
    next.bench.forEach((u, index) => u && u.star < 3 && push(groups, `${u.unitId}:${u.star}`, { area: 'bench', index }));
    const ready = [...groups.values()].find((slots) => slots.length >= 3);
    if (!ready) break;
    const [keep, ...rest] = ready.slice(0, 3);
    const board = [...next.board];
    const bench = [...next.bench];
    const at = (slot: Slot) => (slot.area === 'board' ? board : bench);
    const kept = at(keep)[keep.index]!;
    for (const slot of rest) at(slot)[slot.index] = null;
    at(keep)[keep.index] = { uid: kept.uid, unitId: kept.unitId, star: (kept.star + 1) as Star };
    next = { ...next, board, bench };
  }
  if (trimOverflow) next = { ...next, bench: next.bench.slice(0, BENCH_SIZE) };
  return next;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function sell(run: RunState, slot: Slot): RunState {
  const unit = (slot.area === 'board' ? run.board : run.bench)[slot.index];
  if (run.done || !unit) return run;
  const area = [...(slot.area === 'board' ? run.board : run.bench)];
  area[slot.index] = null;
  return {
    ...run,
    [slot.area]: area,
    gold: run.gold + sellValue(getUnit(unit.unitId).cost, unit.star),
  };
}

/** Moves a unit, swapping with whatever is there. The board can't hold more units than the level. */
export function move(run: RunState, from: Slot, to: Slot): RunState {
  if (run.done || (from.area === to.area && from.index === to.index)) return run;
  const board = [...run.board];
  const bench = [...run.bench];
  const at = (slot: Slot) => (slot.area === 'board' ? board : bench);
  const moving = at(from)[from.index];
  if (!moving) return run;
  const there = at(to)[to.index];
  at(to)[to.index] = moving;
  at(from)[from.index] = there;
  if (board.filter(Boolean).length > run.level) return run;
  return { ...run, board, bench };
}

export function reroll(run: RunState): RunState {
  if (run.done || run.gold < REROLL_COST) return run;
  const next = { ...run, gold: run.gold - REROLL_COST, rolls: run.rolls + 1 };
  return { ...next, shop: freshShop(next) };
}

export function buyXp(run: RunState): RunState {
  if (run.done || run.gold < XP_COST || run.level >= MAX_LEVEL) return run;
  const xp = run.xp + XP_PER_BUY;
  return { ...run, gold: run.gold - XP_COST, xp, level: levelForXp(xp) };
}

/** Fills empty board cells from the bench, up to the level. Used before a fight so no one forgets. */
export function autoFill(run: RunState): RunState {
  let next = run;
  for (let i = 0; i < next.bench.length && boardCount(next) < next.level; i++) {
    if (!next.bench[i]) continue;
    const cell = FILL_ORDER.find((c) => !next.board[c]);
    if (cell === undefined) break;
    next = move(next, { area: 'bench', index: i }, { area: 'board', index: cell });
  }
  return next;
}

/** Front row middle outwards, then the rows behind. */
const FILL_ORDER = [3, 2, 4, 1, 5, 10, 9, 11, 8, 12, 0, 6, 17, 16, 18, 7, 13, 15, 19, 24, 23, 25];

/** Applies a finished fight: damage on a loss, then on to the next round's planning. */
export function finishRound(run: RunState, result: BattleResult, opponent: string): RunState {
  const won = result.winner === 'a';
  const draw = result.winner === 'draw';
  const damage = won ? 0 : lossDamage(run.round, draw ? 0 : result.survivorStars);
  const hp = Math.max(0, run.hp - damage);
  const history = [...run.history, { round: run.round, won, draw, damage, opponent }];
  const wins = run.wins + (won ? 1 : 0);
  const done = hp <= 0 || run.round >= MAX_ROUNDS;
  const next: RunState = { ...run, hp, wins, history, done };
  return done ? { ...next, wonLast: won } : nextRound(next, won);
}

/** On to the next round's planning, paying the win bonus if the last round was won. */
export function nextRound(run: RunState, wonLast: boolean): RunState {
  return startPlanning({ ...run, round: run.round + 1, wonLast });
}
