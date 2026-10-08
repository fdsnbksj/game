import { FirebaseError } from 'firebase/app';
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from 'firebase/firestore';
import * as rest from 'firebase/firestore/lite';
import { db, dbRest } from '../firebase';
import type { Move } from '../games/hero/skills';
import type { Recorded } from '../games/hero/state';
import { validTree, type Tree } from '../games/hero/stats';
import { useGameStore } from '../store';
import { newCode } from './roomCode';

// Hero Gambit in Firestore. heroes/{uid} is your hero (levels cleared and the tree), which
// only you can read or write; firestore.rules caps the tree by the points those levels give.
// heroDuels/{code} is a fight between two phones: each player brings the tree on their hero
// doc (the rules compare them), and the moves are appended in order, one document each.
// tests/rules/hero.test.ts mirrors these writes.
//
// Room writes and the backup reads go over plain HTTPS (dbRest, Firestore Lite): each one
// lands or fails then and there. Through the main SDK a write can sit pending behind a
// stalled stream, so a phone shows its move as made while the other phone never gets it.

export interface HeroDoc {
  cleared: number;
  tree: Tree;
}

const heroRef = (uid: string) => doc(db, 'heroes', uid);

export async function fetchHero(uid: string): Promise<HeroDoc | null> {
  const snap = await getDoc(heroRef(uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  const tree = validTree(d.tree, d.cleared);
  return tree && Number.isInteger(d.cleared) ? { cleared: d.cleared, tree } : null;
}

/** One write: the rules let `cleared` go up by at most one at a time. */
export async function writeHero(uid: string, hero: HeroDoc) {
  await setDoc(heroRef(uid), { cleared: hero.cleared, tree: hero.tree, updatedAt: serverTimestamp() });
}

// ---------- Rooms ----------

export interface HeroRoom {
  code: string;
  host: string;
  playerIds: string[];
  names: Record<string, string>;
  /** Each player's tree, as it was on their hero when they came in. */
  fighters: Record<string, Tree>;
  status: 'lobby' | 'playing' | 'done';
  seed: string | null;
}

const roomRef = (code: string) => doc(db, 'heroDuels', code);
const roomRest = (code: string) => rest.doc(dbRest, 'heroDuels', code);
const movesRest = (code: string) => rest.collection(dbRest, 'heroDuels', code, 'moves');

function me() {
  const { uid, player } = useGameStore.getState();
  if (!uid || !player) throw new Error('Not connected yet. Try again in a moment.');
  return { uid, name: player.displayName };
}

/** `ready` puts your hero doc up to date first, since the rules check the tree (read after it) against it. */
export async function createHeroRoom(heroTree: () => Tree, ready: () => Promise<void>): Promise<string> {
  const { uid, name } = me();
  await ready();
  const tree = heroTree();
  for (let tries = 0; tries < 5; tries++) {
    const code = newCode();
    try {
      await rest.setDoc(roomRest(code), { host: uid, playerIds: [uid], names: { [uid]: name }, fighters: { [uid]: tree }, status: 'lobby', createdAt: rest.serverTimestamp() });
      return code;
    } catch (error) {
      if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
    }
  }
  throw new Error('Could not open a room. Try again.');
}

/** Joins as the second player. Returns why not, if you can't. */
export async function joinHeroRoom(code: string, heroTree: () => Tree, ready: () => Promise<void>): Promise<string | null> {
  const { uid, name } = me();
  const snap = await rest.getDoc(roomRest(code));
  if (!snap.exists()) return 'No room with that code.';
  const room = snap.data();
  if ((room.playerIds as string[]).includes(uid)) return null;
  if (room.status !== 'lobby' || room.playerIds.length >= 2) return 'That fight is full.';
  await ready();
  const tree = heroTree();
  await rest.updateDoc(roomRest(code), {
    playerIds: [...room.playerIds, uid],
    names: { ...room.names, [uid]: name },
    fighters: { ...room.fighters, [uid]: tree },
  });
  return null;
}

export async function startHeroRoom(code: string) {
  const seed = Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');
  await rest.updateDoc(roomRest(code), { status: 'playing', seed, startedAt: rest.serverTimestamp() });
  pokeHeroRoom(code);
}

export async function sendHeroMove(code: string, n: number, move: Move) {
  const { uid } = me();
  await rest.setDoc(rest.doc(movesRest(code), String(n)), { n, by: uid, move });
  pokeHeroRoom(code);
}

export async function finishHeroRoom(code: string) {
  await rest.updateDoc(roomRest(code), { status: 'done', endedAt: rest.serverTimestamp() });
}

export interface HeroRoomData {
  room: HeroRoom | null;
  missing: boolean;
  moves: Recorded[];
}

const STAGES = { lobby: 0, playing: 1, done: 2 };
/** How far along a room is: its stage, then how many have joined. */
const progress = (room: HeroRoom) => STAGES[room.status] * 10 + room.playerIds.length;

/** How often an open room double-checks the server, in case the live connection has stalled. */
const POLL_MS = 5000;

/** What the watcher needs of a document, from either SDK. */
interface Snap {
  exists(): boolean;
  data(): Record<string, unknown> | undefined;
}

/** Rooms on screen, to check the server at once after this phone writes. */
const pokes = new Map<string, () => void>();
const pokeHeroRoom = (code: string) => pokes.get(code)?.();

const roomOf = (code: string, d: Record<string, unknown>): HeroRoom => ({
  code,
  host: d.host as string,
  playerIds: d.playerIds as string[],
  names: d.names as Record<string, string>,
  fighters: d.fighters as Record<string, Tree>,
  status: d.status as HeroRoom['status'],
  seed: (d.seed as string | undefined) ?? null,
});

/**
 * Follows a room and its moves. Live listeners do most of the work, but on phones they can
 * stall after the app has been in the background (switching to a chat to share the code,
 * say), leaving each phone waiting on the other. So the listeners are remade whenever the
 * page comes back or the connection returns, retried after an error, and, while the page is
 * showing, the room and any new moves are also read straight from the server every few
 * seconds. Moves are kept by number, so whichever way one arrives, it counts once.
 */
export function watchHeroRoom(code: string, uid: string, onChange: (data: HeroRoomData) => void): Unsubscribe {
  let room: HeroRoom | null = null;
  let missing = false;
  const moves = new Map<number, Recorded>();
  let stopped = false;

  const emit = () => {
    if (stopped) return;
    const list = [...moves.entries()].sort((a, b) => a[0] - b[0]).map(([, m]) => m);
    onChange({ room, missing, moves: list });
  };
  const takeRoom = (snap: Snap) => {
    const next = snap.exists() ? roomOf(code, snap.data()!) : null;
    // The listener and the reads can arrive in either order: never step back to an earlier stage of the room.
    if (room && next && progress(next) < progress(room)) return;
    missing = !snap.exists();
    room = next;
    emit();
    if (room && canReadMoves()) listenMoves();
  };
  const takeMoves = (docs: { data(): Record<string, unknown> }[]) => {
    let added = false;
    for (const x of docs) {
      const { n, by, move } = x.data() as unknown as { n: number; by: string; move: Move };
      if (!moves.has(n)) {
        moves.set(n, { by, move });
        added = true;
      }
    }
    if (added) emit();
  };
  // Only the two players may read the moves, once the fight has started.
  const canReadMoves = () => !!room && room.playerIds.includes(uid) && room.status !== 'lobby';

  let roomSub: Unsubscribe | null = null;
  let movesSub: Unsubscribe | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const again = () => {
    clearTimeout(retry);
    retry = setTimeout(() => !stopped && relisten(), 3000);
  };
  const listenMoves = () => {
    if (movesSub || stopped) return;
    movesSub = onSnapshot(collection(db, 'heroDuels', code, 'moves'), (s) => takeMoves(s.docs), () => {
      movesSub = null;
      again();
    });
  };
  const listen = () => {
    if (stopped) return;
    roomSub = onSnapshot(roomRef(code), (snap) => takeRoom(snap), () => {
      roomSub = null;
      again();
    });
    if (canReadMoves()) listenMoves();
  };
  const unlisten = () => {
    roomSub?.();
    movesSub?.();
    roomSub = movesSub = null;
  };
  const relisten = () => {
    unlisten();
    listen();
  };

  /** Straight from the server over HTTPS, whatever the listeners are doing. */
  let polling = false;
  const poll = async () => {
    if (stopped || polling || document.visibilityState !== 'visible') return;
    polling = true;
    try {
      takeRoom(await rest.getDoc(roomRest(code)));
      if (canReadMoves()) takeMoves((await rest.getDocs(rest.query(movesRest(code), rest.where('n', '>=', moves.size), rest.orderBy('n')))).docs);
    } catch {
      // Offline for now: the next poll tries again.
    } finally {
      polling = false;
    }
  };
  pokes.set(code, () => void poll());

  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    relisten();
    void poll();
  };
  const onOnline = () => {
    relisten();
    void poll();
  };

  listen();
  void poll();
  const timer = setInterval(() => {
    // A finished fight needs no more checking.
    if (room?.status !== 'done') void poll();
  }, POLL_MS);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);

  return () => {
    stopped = true;
    clearInterval(timer);
    clearTimeout(retry);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
    pokes.delete(code);
    unlisten();
  };
}
