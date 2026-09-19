import { LEVEL_XP, MAX_INTEREST, MAX_LEVEL, MAX_ROUNDS, WIN_BONUS, XP_COST, XP_PER_BUY, XP_PER_ROUND, type Star } from './balance';

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

/**
 * Most gold a player can have received by the planning phase of each round (index =
 * round). Spending never earns anything back, so banking every coin and winning every
 * round is the best possible case. Units on a board plus XP bought can't be worth more.
 */
export function maxGoldByRound(): number[] {
  const result = [0];
  let bank = 0;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    bank += income(round, bank, round > 1);
    result.push(bank);
  }
  return result;
}

/** HP a loss costs: a base that grows with the round, plus a point per surviving enemy star. */
export function stageDamage(round: number): number {
  return 2 + Math.floor(round / 2);
}

export function lossDamage(round: number, survivorStars: number): number {
  return stageDamage(round) + survivorStars;
}
