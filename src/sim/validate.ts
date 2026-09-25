import { getUnit, ITEMS, MAX_LEVEL, UNITS, type Star } from './balance';
import type { Placed } from './combat';
import { copies, maxGold, maxItems, xpGoldForLevel } from './economy';
import { SIDE_CELLS } from './hex';

// A board as it's stored online: the team a player fought a round with. Firestore rules
// can't loop, so it's parallel lists rather than a list of objects, and isValidBoard() in
// firestore.rules checks exactly what isLegalBoard() checks here.

export interface BoardSnapshot {
  /** Level, which caps the number of units. */
  lv: number;
  u: string[];
  /** Own-board cells, 0–27. */
  c: number[];
  s: number[];
  /** Who this board fought: a ghost's `runId:round`, or `ai`. */
  o: string;
  /** Item ids the board carried; left out when it carried none. */
  it?: string[];
  /** Which slot of `u` holds each item in `it`. */
  ia?: number[];
}

export function toSnapshot(units: readonly Placed[], level: number, opponent: string): BoardSnapshot {
  const board: BoardSnapshot = {
    lv: level,
    u: units.map((unit) => unit.unitId),
    c: units.map((unit) => unit.cell),
    s: units.map((unit) => unit.star),
    o: opponent,
  };
  const held = units.flatMap((unit, slot) => (unit.item ? [{ item: unit.item, slot }] : []));
  if (held.length > 0) {
    board.it = held.map((entry) => entry.item);
    board.ia = held.map((entry) => entry.slot);
  }
  return board;
}

export function fromSnapshot(board: BoardSnapshot): Placed[] {
  return board.u.map((unitId, i) => {
    const held = board.it && board.ia ? board.it[board.ia.indexOf(i)] : undefined;
    return { unitId, cell: board.c[i], star: board.s[i] as Star, ...(held ? { item: held } : {}) };
  });
}

/** Gold that units on the board plus the XP for its level must have cost. */
export function boardSpend(board: BoardSnapshot, round: number): number {
  const units = board.u.reduce((sum, id, i) => sum + getUnit(id).cost * copies(board.s[i]), 0);
  return units + xpGoldForLevel(board.lv, round);
}

const UNIT_IDS = new Set(UNITS.map((unit) => unit.id));
const ITEM_IDS = new Set(ITEMS.map((item) => item.id));

/**
 * Whether a player could have fielded this board in `round`. It can't prove the shop
 * offered those units, only that the board isn't impossible: no more units than the level,
 * one per cell, and no more gold's worth than could have been earned by then.
 */
export function isLegalBoard(board: BoardSnapshot, round: number): boolean {
  const { lv, u, c, s } = board;
  if (!Number.isInteger(lv) || lv < 1 || lv > MAX_LEVEL) return false;
  if (u.length > lv || c.length !== u.length || s.length !== u.length) return false;
  if (!u.every((id) => UNIT_IDS.has(id))) return false;
  if (!c.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < SIDE_CELLS)) return false;
  if (new Set(c).size !== c.length) return false;
  if (!s.every((star) => star === 1 || star === 2 || star === 3)) return false;
  if (!Number.isInteger(round) || round < 1 || boardSpend(board, round) > maxGold(round)) return false;

  const it = board.it ?? [];
  const ia = board.ia ?? [];
  if (it.length !== ia.length || it.length > maxItems(round)) return false;
  if (!it.every((id) => ITEM_IDS.has(id))) return false;
  if (!ia.every((slot) => Number.isInteger(slot) && slot >= 0 && slot < MAX_LEVEL)) return false;
  // One item per creature.
  return new Set(ia).size === ia.length;
}
