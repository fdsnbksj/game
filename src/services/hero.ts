import { FirebaseError } from 'firebase/app';
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
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
      await setDoc(roomRef(code), { host: uid, playerIds: [uid], names: { [uid]: name }, fighters: { [uid]: tree }, status: 'lobby', createdAt: serverTimestamp() });
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
  const snap = await getDoc(roomRef(code));
  if (!snap.exists()) return 'No room with that code.';
  const room = snap.data();
  if ((room.playerIds as string[]).includes(uid)) return null;
  if (room.status !== 'lobby' || room.playerIds.length >= 2) return 'That fight is full.';
  await ready();
  const tree = heroTree();
  await updateDoc(roomRef(code), {
    playerIds: [...room.playerIds, uid],
    names: { ...room.names, [uid]: name },
    fighters: { ...room.fighters, [uid]: tree },
  });
  return null;
}

export async function startHeroRoom(code: string) {
  const seed = Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');
  await updateDoc(roomRef(code), { status: 'playing', seed, startedAt: serverTimestamp() });
}

export async function sendHeroMove(code: string, n: number, move: Move) {
  const { uid } = me();
  await setDoc(doc(db, 'heroDuels', code, 'moves', String(n)), { n, by: uid, move });
}

export async function finishHeroRoom(code: string) {
  await updateDoc(roomRef(code), { status: 'done', endedAt: serverTimestamp() });
}

export interface HeroRoomData {
  room: HeroRoom | null;
  missing: boolean;
  moves: Recorded[];
}

/** Follows a room and its moves live. */
export function watchHeroRoom(code: string, uid: string, onChange: (data: HeroRoomData) => void): Unsubscribe {
  let data: HeroRoomData = { room: null, missing: false, moves: [] };
  const update = (patch: Partial<HeroRoomData>) => {
    data = { ...data, ...patch };
    onChange(data);
  };
  let movesSub: Unsubscribe | null = null;
  const roomSub = onSnapshot(roomRef(code), (snap) => {
    if (!snap.exists()) return update({ missing: true, room: null });
    const d = snap.data();
    const room: HeroRoom = { code, host: d.host, playerIds: d.playerIds, names: d.names, fighters: d.fighters, status: d.status, seed: d.seed ?? null };
    update({ room, missing: false });
    // Only the two players may read the moves.
    if (!movesSub && room.playerIds.includes(uid) && room.status !== 'lobby') {
      movesSub = onSnapshot(
        collection(db, 'heroDuels', code, 'moves'),
        (s) =>
          update({
            moves: s.docs
              .map((x) => x.data() as { n: number; by: string; move: Move })
              .sort((a, b) => a.n - b.n)
              .map(({ by, move }) => ({ by, move })),
          }),
        () => {},
      );
    }
  });
  return () => {
    roomSub();
    movesSub?.();
  };
}
