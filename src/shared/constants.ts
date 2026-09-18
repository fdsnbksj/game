// MAX_SCORE, MIN_SECONDS_BETWEEN_RUNS and MAX_RUNS_PER_SAVE are duplicated in firestore.rules.
// Change both together.
export const MAX_SCORE = 1000;
export const MIN_SECONDS_BETWEEN_RUNS = 5;
/** Runs are counted locally between saves, so one save can add several games played. */
export const MAX_RUNS_PER_SAVE = 100;

export const LEADERBOARD_SIZE = 50;
export const LEADERBOARD_REFRESH_MS = 60_000;

/** The daily course changes at 00:00 UTC. Also the leaderboard id for that day. */
export function dayId(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Whether `day` is the UTC day right after `previous`. Mirrors isNextDay() in firestore.rules. */
export function isNextDay(previous: string, day: string): boolean {
  return Date.parse(`${day}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`) === 24 * 60 * 60 * 1000;
}
