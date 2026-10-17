import { useEffect } from 'react';
import { HERO_VERSION } from '../games/hero/state';
import { useGameStore } from '../store';
import { rest } from './resilient';
import { dbRest } from '../firebase';

// Every party game's open rooms (the user's ask, 2026-10-18): each game's home lists the
// rooms still waiting for players, to join with a tap. A player on a lobby page says they're
// there about once a minute (`seenAt`); a lobby nobody has been in for STALE_MS is left out
// of the list and deleted by the phone that finds it (Spark has no scheduled jobs, so the
// lists do the clearing; firestore.rules lets anyone delete a lobby that old). Only lobbies:
// a game under way is kept for phones that went to sleep.

export type RoomCollection = 'rooms' | 'heroDuels' | 'wonders' | 'isles' | 'bluffs';

/** Who's in a room, by collection, and how many it holds. */
const SPEC: Record<RoomCollection, { members: 'playerIds' | 'seats'; max: number }> = {
  rooms: { members: 'playerIds', max: 10 },
  heroDuels: { members: 'playerIds', max: 2 },
  wonders: { members: 'seats', max: 7 },
  isles: { members: 'seats', max: 4 },
  bluffs: { members: 'seats', max: 4 },
};

/** A lobby nobody has been in for this long is empty; firestore.rules says the same (10 m). */
export const STALE_MS = 10 * 60_000;
const BEAT_MS = 60_000;

export interface OpenRoom {
  code: string;
  /** Everyone in it, host first, bots too. */
  names: string[];
  count: number;
  max: number;
  /** You're already in it. */
  mine: boolean;
}

const millis = (t: unknown) => (t && typeof (t as { toMillis?: unknown }).toMillis === 'function' ? (t as { toMillis(): number }).toMillis() : null);

/**
 * The rooms of a game still waiting for players, newest first. Empty ones found on the way
 * are deleted (best effort: another phone may already have).
 */
export async function openRooms(path: RoomCollection): Promise<OpenRoom[]> {
  const { uid } = useGameStore.getState();
  const { members, max } = SPEC[path];
  const snap = await rest.getDocs(rest.query(rest.collection(dbRest, path), rest.where('status', '==', 'lobby'), rest.limit(50)));
  const now = Date.now();
  const open: (OpenRoom & { at: number })[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    const at = millis(data.seenAt) ?? millis(data.createdAt) ?? 0;
    if (now - at > STALE_MS) {
      void rest.deleteDoc(d.ref).catch(() => {});
      continue;
    }
    // A fight on another version can't be joined from this phone.
    if (path === 'heroDuels' && data.version !== HERO_VERSION) continue;
    const ids = (data[members] as string[] | undefined) ?? [];
    const names = data.names as Record<string, string> | undefined;
    open.push({ code: d.id, names: ids.map((id) => names?.[id] ?? '?'), count: ids.length, max, mine: !!uid && ids.includes(uid), at });
  }
  return open.sort((a, b) => b.at - a.at).map(({ at: _, ...room }) => room);
}

/** While `here` (you're in this room's lobby), say so now, every minute, and whenever the page comes back. */
export function useLobbyHeartbeat(path: RoomCollection, code: string, here: boolean) {
  useEffect(() => {
    if (!here) return;
    const beat = () => {
      if (document.visibilityState !== 'visible') return;
      void rest.updateDoc(rest.doc(dbRest, path, code), { seenAt: rest.serverTimestamp() }).catch(() => {});
    };
    beat();
    const timer = setInterval(beat, BEAT_MS);
    document.addEventListener('visibilitychange', beat);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [path, code, here]);
}
