import { useEffect } from 'react';
import { HERO_VERSION } from '../games/hero/state';
import { useGameStore } from '../store';
import { rest } from './resilient';
import { dbRest } from '../firebase';

// Every party game's open rooms (the user's asks, 2026-10-18): each game's home lists the
// rooms still waiting for players, to join with a tap. A player on a room's page says
// they're there about once a minute (`seenAt`). A lobby nobody has been in for STALE_MS is
// left out of the list and deleted by the phone that finds it, and so is a started or
// finished game nobody has been in for GAME_STALE_MS, with everything under it. Spark has no
// scheduled jobs, so the game homes do the clearing; firestore.rules lets anyone delete a
// room that stale.

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
/** A started or finished game nobody has been in for this long is abandoned (30 m in the rules too). */
export const GAME_STALE_MS = 30 * 60_000;
/** Abandoned games cleared per visit to a game's home, to spread the deletes over Spark's daily quota. */
const CLEAR_PER_VISIT = 3;
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

/** What lies under a room: Avalon's records (quests hold each card), or every other game's moves. */
const UNDER: Record<RoomCollection, string[]> = {
  rooms: ['secrets', 'proposals', 'votes', 'quests', 'lady', 'ladyResults'],
  heroDuels: ['moves'],
  wonders: ['moves'],
  isles: ['moves'],
  bluffs: ['moves'],
};

const millis = (t: unknown) => (t && typeof (t as { toMillis?: unknown }).toMillis === 'function' ? (t as { toMillis(): number }).toMillis() : null);

/**
 * The rooms of a game still waiting for players, newest first. Empty ones found on the way
 * are deleted (best effort: another phone may already have).
 */
export async function openRooms(path: RoomCollection): Promise<OpenRoom[]> {
  const { uid } = useGameStore.getState();
  const { members, max } = SPEC[path];
  void clearAbandoned(path).catch(() => {});
  const snap = await rest.getDocs(rest.query(rest.collection(dbRest, path), rest.where('status', '==', 'lobby'), rest.limit(50)));
  const now = Date.now();
  const open: (OpenRoom & { at: number })[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    const at = millis(data.seenAt) ?? millis(data.createdAt) ?? now;
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

/**
 * Deletes a few games nobody has been in for GAME_STALE_MS, oldest first: what's under each
 * room, then the room, so a half-done clear is finished by the next visit.
 */
async function clearAbandoned(path: RoomCollection) {
  const snap = await rest.getDocs(rest.query(rest.collection(dbRest, path), rest.orderBy('createdAt'), rest.limit(20)));
  const now = Date.now();
  const stale = snap.docs.filter((d) => {
    const data = d.data();
    return data.status !== 'lobby' && now - (millis(data.seenAt) ?? millis(data.createdAt) ?? now) > GAME_STALE_MS;
  });
  for (const room of stale.slice(0, CLEAR_PER_VISIT)) {
    for (const name of UNDER[path]) {
      const docs = (await rest.getDocs(rest.collection(room.ref, name))).docs;
      if (name === 'quests') for (const quest of docs) await deleteAll((await rest.getDocs(rest.collection(quest.ref, 'cards'))).docs);
      await deleteAll(docs);
    }
    await rest.deleteDoc(room.ref);
  }
}

async function deleteAll(docs: { ref: rest.DocumentReference }[]) {
  for (let i = 0; i < docs.length; i += 20) await Promise.all(docs.slice(i, i + 20).map((d) => rest.deleteDoc(d.ref)));
}

/** While `here` (you're in this room, waiting or playing), say so now, every minute, and whenever the page comes back. */
export function useRoomHeartbeat(path: RoomCollection, code: string, here: boolean) {
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
