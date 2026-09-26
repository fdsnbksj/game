// Spaced repetition in five boxes (Leitner): a line recalled on the first try moves up a
// box and waits longer before it comes back; a miss starts it over. Days are counted as
// whole UTC days since 1970, passed in, so this stays free of the clock.

/** Days to wait after landing in each box. */
export const INTERVALS = [0, 1, 3, 7, 16, 35];

export interface Review {
  /** 0 to INTERVALS.length - 1. */
  box: number;
  /** The first day it's due again. */
  due: number;
  seen: number;
}

export const newReview = (today: number): Review => ({ box: 0, due: today, seen: 0 });

export function review(r: Review, firstTry: boolean, today: number): Review {
  const box = firstTry ? Math.min(r.box + 1, INTERVALS.length - 1) : 0;
  return { box, due: today + INTERVALS[box], seen: r.seen + 1 };
}

/** Days since 1970-01-01 for a YYYY-MM-DD day, by arithmetic alone (Howard Hinnant's days_from_civil). */
export function dayNumber(day: string): number {
  let y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7));
  const d = Number(day.slice(8, 10));
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/**
 * Which line to ask about next: the most overdue of those due (the least known first on a
 * tie), never the one just asked if there's another. When nothing is due, the one due
 * soonest, since the next level still wants a question.
 */
export function nextDue<T extends { id: string; review: Review }>(items: readonly T[], today: number, lastId: string | null): T | null {
  const pool = items.length > 1 ? items.filter((item) => item.id !== lastId) : items;
  const order = (a: T, b: T) => a.review.due - b.review.due || a.review.box - b.review.box || a.id.localeCompare(b.id);
  const due = pool.filter((item) => item.review.due <= today).sort(order);
  return due[0] ?? [...pool].sort(order)[0] ?? null;
}
