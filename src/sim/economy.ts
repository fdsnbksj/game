import { ITEM_EVERY, ITEM_OFFSET, LEVEL_XP, MAX_INTEREST, MAX_LEVEL, SURGE_FROM, SURGE_PERCENT, WIN_BONUS, XP_COST, XP_PER_BUY, XP_PER_ROUND, type Star } from './balance';

export function baseIncome(round: number): number {
  return Math.min(5, round + 2);
}

export function interest(gold: number): number {
  return Math.min(MAX_INTEREST, Math.floor(gold / 10));
}

/** Gold paid at the start of a round's planning, on top of what was banked. */
export function income(round: number, banked: number, wonLast: boolean): number {
  return baseIncome(round) + interest(banked) + (wonLast ? WIN_BONUS : 0);
}

export function passiveXp(round: number): number {
  return (round - 1) * XP_PER_ROUND;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= LEVEL_XP[level + 1]) level += 1;
  return level;
}

/** Gold a player must have spent on XP to be at `level` by `round`. */
export function xpGoldForLevel(level: number, round: number): number {
  const needed = LEVEL_XP[level] - passiveXp(round);
  return needed > 0 ? Math.ceil(needed / XP_PER_BUY) * XP_COST : 0;
}

/** Copies of the 1-star unit that a unit of this star level is made of. */
export function copies(star: Star | number): number {
  return star === 1 ? 1 : star === 2 ? 3 : 9;
}

/** Selling refunds exactly what the copies cost, so selling can never make gold. */
export function sellValue(cost: number, star: Star | number): number {
  return cost * copies(star);
}

/** The round after which income can't grow any more; firestore.rules hardcodes the same. */
export const MAX_GOLD_STEADY_FROM = 8;
export const MAX_INCOME = 5 + MAX_INTEREST + WIN_BONUS;

/**
 * Most gold a player can have received by the planning phase of `round`. Spending never
 * earns anything back, so banking every coin and winning every round is the best possible
 * case. Units on a board plus XP bought can't be worth more. From round 9 on the bank is
 * past 50, so every round pays the most there is: base, full interest and the win bonus.
 */
export function maxGold(round: number): number {
  let bank = 0;
  for (let r = 1; r <= Math.min(round, MAX_GOLD_STEADY_FROM); r++) bank += income(r, bank, r > 1);
  return bank + Math.max(0, round - MAX_GOLD_STEADY_FROM) * MAX_INCOME;
}

/** HP a loss costs: a base that grows with the round, plus a point per surviving enemy star. */
export function stageDamage(round: number): number {
  return 2 + Math.floor(round / 2);
}

export function lossDamage(round: number, survivorStars: number): number {
  return stageDamage(round) + survivorStars;
}

/** Whether an item drops after this round. */
export function dropsItem(round: number): boolean {
  return round >= ITEM_OFFSET && (round - ITEM_OFFSET) % ITEM_EVERY === 0;
}

/** The first round from `round` on that drops an item. */
export function nextDropRound(round: number): number {
  let r = Math.max(round, ITEM_OFFSET);
  while (!dropsItem(r)) r += 1;
  return r;
}

/** Items held by the planning phase of `round`: one per drop round gone by. */
export function maxItems(round: number): number {
  return round <= ITEM_OFFSET ? 0 : Math.floor((round - ITEM_OFFSET - 1) / ITEM_EVERY) + 1;
}

/**
 * How strong the rival is in `round`, as a percent of its health and damage: 100 until
 * SURGE_FROM, then SURGE_PERCENT% more each round, compounding. Integer steps rather than
 * floating-point powers, so every device gets the same number.
 */
export function surgePercent(round: number): number {
  let percent = 100;
  for (let r = SURGE_FROM + 1; r <= round; r++) percent = Math.floor((percent * (100 + SURGE_PERCENT)) / 100);
  return percent;
}
