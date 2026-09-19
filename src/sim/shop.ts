import { POOL_SIZE, SHOP_ODDS, SHOP_SIZE, UNITS, type Cost } from './balance';
import { stream } from './rng';

/** Copies of each unit already taken, counting a 2-star as three and a 3-star as nine. */
export type Taken = Record<string, number>;

/**
 * A fresh shop. `name` seeds it, so the same run, round and reroll always shows the same
 * units. Each slot picks a cost by the level's odds, then a unit of that cost weighted by
 * how many copies are left; if every unit of that cost is gone it tries cheaper ones.
 */
export function rollShop(name: string, level: number, taken: Taken): (string | null)[] {
  const rng = stream(name);
  const odds = SHOP_ODDS[level];
  const shownNow: Taken = {};
  const slots: (string | null)[] = [];
  for (let slot = 0; slot < SHOP_SIZE; slot++) {
    const roll = rng(100);
    let cost = 1;
    let sum = odds[0];
    while (roll >= sum && cost < 5) {
      sum += odds[cost];
      cost += 1;
    }
    slots.push(pickUnit(rng, cost as Cost, taken, shownNow));
  }
  return slots;
}

function pickUnit(rng: (n: number) => number, cost: Cost, taken: Taken, shownNow: Taken): string | null {
  for (let c = cost; c >= 1; c--) {
    const choices = UNITS.filter((unit) => unit.cost === c).map((unit) => ({
      id: unit.id,
      left: POOL_SIZE[unit.cost] - (taken[unit.id] ?? 0) - (shownNow[unit.id] ?? 0),
    }));
    const total = choices.reduce((sum, choice) => sum + Math.max(0, choice.left), 0);
    if (total <= 0) continue;
    let pick = rng(total);
    for (const choice of choices) {
      if (choice.left <= 0) continue;
      if (pick < choice.left) {
        shownNow[choice.id] = (shownNow[choice.id] ?? 0) + 1;
        return choice.id;
      }
      pick -= choice.left;
    }
  }
  return null;
}
