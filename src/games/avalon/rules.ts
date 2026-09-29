// The Resistance: Avalon, as tables. Everything here is from the published rules.

export type Role = 'merlin' | 'percival' | 'servant' | 'assassin' | 'morgana' | 'mordred' | 'oberon' | 'minion';

/** Roles the host can add. Merlin and the Assassin are always in; the rest are plain servants and minions. */
export type OptionalRole = 'percival' | 'morgana' | 'mordred' | 'oberon';
export const OPTIONAL_ROLES: OptionalRole[] = ['percival', 'morgana', 'mordred', 'oberon'];

export const EVIL_ROLES: Role[] = ['assassin', 'morgana', 'mordred', 'oberon', 'minion'];
export const isEvil = (role: Role) => EVIL_ROLES.includes(role);

export const ROLE_NAMES: Record<Role, string> = {
  merlin: 'Merlin',
  percival: 'Percival',
  servant: 'Loyal Servant of Arthur',
  assassin: 'Assassin',
  morgana: 'Morgana',
  mordred: 'Mordred',
  oberon: 'Oberon',
  minion: 'Minion of Mordred',
};

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;

/** How many of each side, by number of players. */
export const SIDES: Record<number, { good: number; evil: number }> = {
  5: { good: 3, evil: 2 },
  6: { good: 4, evil: 2 },
  7: { good: 4, evil: 3 },
  8: { good: 5, evil: 3 },
  9: { good: 6, evil: 3 },
  10: { good: 6, evil: 4 },
};

/** Team size for each of the five quests, by number of players. */
export const TEAM_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

export const QUESTS = 5;
/** Quests one side needs to win. */
export const TO_WIN = 3;
/** Teams rejected in a row on one quest before evil wins outright. */
export const MAX_REJECTIONS = 5;

/** Fail cards that sink a quest: two on the fourth quest with seven or more players. */
export const failsToSink = (players: number, quest: number) => (quest === 3 && players >= 7 ? 2 : 1);

/**
 * Every role in a game of `players` with the chosen optional roles, or a reason it can't
 * work (more special evil roles than evil seats).
 */
export function roleList(players: number, optional: readonly OptionalRole[]): Role[] | string {
  const sides = SIDES[players];
  if (!sides) return `Avalon needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`;
  const evil: Role[] = ['assassin', ...(['morgana', 'mordred', 'oberon'] as const).filter((r) => optional.includes(r))];
  if (evil.length > sides.evil) return `${players} players have ${sides.evil} evil seats: too many evil roles chosen.`;
  const good: Role[] = ['merlin', ...(optional.includes('percival') ? (['percival'] as const) : [])];
  return [
    ...good,
    ...Array<Role>(sides.good - good.length).fill('servant'),
    ...evil,
    ...Array<Role>(sides.evil - evil.length).fill('minion'),
  ];
}
