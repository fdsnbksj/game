import { collection, doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import * as rest from 'firebase/firestore/lite';
import { db, dbRest } from '../firebase';

// Rooms that keep working when a phone's Firestore stream stalls.
//
// On phones the main SDK's stream can wedge after the app has been in the background
// (switching to a chat to share a room code, say): listeners stop hearing changes, and a
// write made through it can sit pending forever, so one phone shows its move as made while
// the others never get it. So the party games write over plain HTTPS (`dbRest`, Firestore
// Lite: each write lands or fails then and there), and follow their rooms with live
// listeners that are remade when the page comes back, the connection returns or a listener
// fails, plus a read over HTTPS every few seconds and right after each write.

/** What a room watcher needs of a document, from either SDK. */
export interface Snap {
  exists(): boolean;
  data(): Record<string, unknown> | undefined;
}

/** Rooms on screen, by path, to read at once after this phone writes. */
const pokes = new Map<string, () => void>();

/** This phone just wrote to `path`'s room: check the server now rather than at the next poll. */
export const poke = (path: string) => pokes.get(path)?.();

/**
 * Keeps a room's listeners alive and backs them up with `poll`. `listen(fail)` sets up the
 * listeners and returns their cleanup; a listener calls `fail` on an error, and they're all
 * remade a moment later. `poll(relisten)` may remake them too, when it finds something they missed. `poll` runs every `everyMs` while the page is showing (and `active()`
 * says the room still matters), and whenever this phone writes to the room (`poke(path)`).
 */
export function keepFresh(
  path: string,
  listen: (fail: () => void) => () => void,
  poll: (relisten: () => void) => Promise<void>,
  { everyMs = 5000, active = () => true }: { everyMs?: number; active?: () => boolean } = {},
): Unsubscribe {
  let stopped = false;
  let cleanup: (() => void) | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let polling = false;

  const relisten = () => {
    if (stopped) return;
    cleanup?.();
    cleanup = listen(() => {
      clearTimeout(retry);
      retry = setTimeout(relisten, 3000);
    });
  };
  const check = async () => {
    if (stopped || polling || document.visibilityState !== 'visible') return;
    polling = true;
    try {
      await poll(relisten);
    } catch {
      // Offline for now: the next poll tries again.
    } finally {
      polling = false;
    }
  };
  const back = () => {
    if (document.visibilityState !== 'visible') return;
    relisten();
    void check();
  };

  relisten();
  void check();
  const timer = setInterval(() => active() && void check(), everyMs);
  document.addEventListener('visibilitychange', back);
  window.addEventListener('online', back);
  pokes.set(path, () => void check());

  return () => {
    stopped = true;
    clearInterval(timer);
    clearTimeout(retry);
    document.removeEventListener('visibilitychange', back);
    window.removeEventListener('online', back);
    if (pokes.get(path)) pokes.delete(path);
    cleanup?.();
  };
}

/** How far along a room is; a read that arrives late never steps a room back past this. */
const STAGES: Record<string, number> = { lobby: 0, playing: 1, done: 2 };
const stage = (room: { status: string }) => STAGES[room.status] ?? 0;

export interface Recorded<M> {
  by: string;
  move: M;
}

export interface RoomWithMoves<R, M> {
  room: R | null;
  missing: boolean;
  moves: Recorded<M>[];
}

/**
 * Follows `root/{code}` and its `moves/{n}`, appended in order: Rival Wonders, Ancient
 * Wonders, Island Settlers and Hero Gambit. Moves are kept by number, so whichever way one
 * arrives, it counts once; the moves are read only once `canReadMoves(room)` (the rules let
 * only the room's members read them, once the game has started).
 */
export function followRoom<R extends { status: string }, M>(
  root: string,
  code: string,
  parse: (data: Record<string, unknown>) => R,
  canReadMoves: (room: R) => boolean,
  onChange: (data: RoomWithMoves<R, M>) => void,
): Unsubscribe {
  let room: R | null = null;
  let missing = false;
  const moves = new Map<number, Recorded<M>>();
  let heard = 0;
  let stopped = false;
  let movesSub: Unsubscribe | null = null;
  let fail = () => {};

  const emit = () => {
    if (stopped) return;
    onChange({ room, missing, moves: [...moves.entries()].sort((a, b) => a[0] - b[0]).map(([, m]) => m) });
  };
  const takeMoves = (docs: { data(): Record<string, unknown> }[]): boolean => {
    let added = false;
    for (const x of docs) {
      const { n, by, move } = x.data() as { n: number; by: string; move: M };
      if (!moves.has(n)) {
        moves.set(n, { by, move });
        added = true;
      }
    }
    if (added) emit();
    return added;
  };
  const listenMoves = () => {
    if (movesSub || stopped || !room || !canReadMoves(room)) return;
    movesSub = onSnapshot(
      collection(db, root, code, 'moves'),
      (s) => takeMoves(s.docs),
      () => {
        movesSub = null;
        fail();
      },
    );
  };
  const takeRoom = (snap: Snap) => {
    const next = snap.exists() ? parse(snap.data()!) : null;
    if (room && next && stage(next) < stage(room)) return;
    missing = !snap.exists();
    room = next;
    emit();
    listenMoves();
  };

  const stop = keepFresh(
    `${root}/${code}`,
    (onFail) => {
      fail = onFail;
      const roomSub = onSnapshot(
        doc(db, root, code),
        (snap) => {
          heard++;
          takeRoom(snap);
        },
        onFail,
      );
      listenMoves();
      return () => {
        roomSub();
        movesSub?.();
        movesSub = null;
      };
    },
    async (relisten) => {
      const before = heard;
      const snap = await rest.getDoc(rest.doc(dbRest, root, code));
      // The listener spoke while this read was on its way: what it said is newer.
      if (heard === before) takeRoom(snap);
      if (room && canReadMoves(room)) {
        const fresh = await rest.getDocs(rest.query(rest.collection(dbRest, root, code, 'moves'), rest.where('n', '>=', moves.size), rest.orderBy('n')));
        // Moves the listener should have heard by now: it has stalled, so remake it.
        if (takeMoves(fresh.docs) && movesSub) relisten();
      }
    },
    { active: () => room?.status !== 'done' },
  );
  return () => {
    stopped = true;
    stop();
  };
}

/** A room or move document, for writing over HTTPS. */
export const restDoc = (path: string, ...segments: string[]) => rest.doc(dbRest, path, ...segments);
export { rest };
