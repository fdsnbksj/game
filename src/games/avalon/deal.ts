import { isEvil, roleList, type OptionalRole, type Role } from './rules';

// Dealing: who gets which role, and what each player learns in the night phase.

/** What one player is told about another. */
export interface Sighting {
  uid: string;
  /** "evil" for evil seen by Merlin or by other evil; "merlin" when Percival knows it's Merlin for sure; "merlin-or-morgana" when he can't tell. */
  as: 'evil' | 'merlin' | 'merlin-or-morgana';
}

export interface Secret {
  role: Role;
  sees: Sighting[];
}

/**
 * Deals the roles to `playerIds` at random (`random` returns a number from 0 to 1;
 * the client passes a crypto source) and works out everyone's night knowledge.
 */
export function deal(playerIds: readonly string[], optional: readonly OptionalRole[], random: () => number): Record<string, Secret> {
  const roles = roleList(playerIds.length, optional);
  if (typeof roles === 'string') throw new Error(roles);
  // Fisher–Yates.
  const shuffled = [...roles];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const roleOf = Object.fromEntries(playerIds.map((uid, i) => [uid, shuffled[i]]));
  return Object.fromEntries(playerIds.map((uid) => [uid, { role: roleOf[uid], sees: knowledge(uid, roleOf) }]));
}

/** What `uid` learns at night, given everyone's role. */
export function knowledge(uid: string, roleOf: Record<string, Role>): Sighting[] {
  const role = roleOf[uid];
  const others = Object.keys(roleOf).filter((other) => other !== uid);
  switch (role) {
    case 'merlin':
      // All evil, except Mordred, who is hidden from him.
      return others.filter((o) => isEvil(roleOf[o]) && roleOf[o] !== 'mordred').map((o) => ({ uid: o, as: 'evil' }));
    case 'percival': {
      const pair = others.filter((o) => roleOf[o] === 'merlin' || roleOf[o] === 'morgana');
      const unsure = pair.some((o) => roleOf[o] === 'morgana');
      return pair.map((o) => ({ uid: o, as: unsure ? 'merlin-or-morgana' : 'merlin' }));
    }
    case 'oberon':
      // Evil, but alone: he doesn't know the others, and they don't know him.
      return [];
    case 'assassin':
    case 'morgana':
    case 'mordred':
    case 'minion':
      return others.filter((o) => isEvil(roleOf[o]) && roleOf[o] !== 'oberon').map((o) => ({ uid: o, as: 'evil' }));
    default:
      return [];
  }
}
