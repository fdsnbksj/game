/** A UTC day as YYYY-MM-DD: the id of that day's rankings. They reset at 00:00 UTC. */
export function dayId(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
