import { FirebaseError } from 'firebase/app';
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { SideChoice } from '../games/wonders/setup';
import type { Move, Recorded } from '../games/wonders/state';
import { useGameStore } from '../store';
import { newCode } from './roomCode';

// Ancient Wonders rooms: wonders/{code}, and its moves, one document each, in order.
// Several phones pick at the same time, so two may race for the same move number; the
// rules refuse the second, which simply tries the next number. Bots are seats named
// `bot:N` whose moves only the host's phone writes. tests/rules/wonders.test.ts mirrors
// these writes.

export interface WondersRoom {
  code: string;
  host: string;
  seats: string[];
  names: Record<string, string>;
  status: 'lobby' | 'playing' | 'done';
  sides: SideChoice;
  seed: string | null;
}

export const isBot = (seat: string) => seat.startsWith('bot:');
const roomRef = (code: string) => doc(db, 'wonders', code);

function me() {
  const { uid, player } = useGameStore.getState();
  if (!uid || !player) throw new Error('Not connected yet. Try again in a moment.');
  return { uid, name: player.displayName };
}

export async function createRoom(): Promise<string> {
  const { uid, name } = me();
  for (let tries = 0; tries < 5; tries++) {
    const code = newCode();
    try {
      await setDoc(roomRef(code), { host: uid, seats: [uid], names: { [uid]: name }, status: 'lobby', sides: 'A', createdAt: serverTimestamp() });
      return code;
    } catch (error) {
      if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
    }
  }
  throw new Error('Could not open a room. Try again.');
}

export async function joinRoom(code: string): Promise<string | null> {
  const { uid, name } = me();
  const snap = await getDoc(roomRef(code));
  if (!snap.exists()) return 'No room with that code.';
  const room = snap.data();
  if ((room.seats as string[]).includes(uid)) return null;
  if (room.status !== 'lobby') return 'That game has already started.';
  if (room.seats.length >= 7) return 'That room is full.';
  await updateDoc(roomRef(code), { seats: [...room.seats, uid], names: { ...room.names, [uid]: name } });
  return null;
}

export async function leaveRoom(room: WondersRoom) {
  const { uid } = me();
  await updateDoc(roomRef(room.code), { seats: room.seats.filter((s) => s !== uid) });
}

/** The host's lobby controls: seats (bots in or out, and the order) and the wonder sides. */
export async function setup(room: WondersRoom, patch: { seats?: string[]; sides?: SideChoice }) {
  const seats = patch.seats ?? room.seats;
  const names = { ...room.names };
  for (const seat of seats) if (isBot(seat) && !names[seat]) names[seat] = `Bot ${seat.slice(4)}`;
  await updateDoc(roomRef(room.code), { seats, names, sides: patch.sides ?? room.sides });
}

export async function addBot(room: WondersRoom) {
  const free = [1, 2, 3, 4, 5, 6].map((i) => `bot:${i}`).find((id) => !room.seats.includes(id));
  if (free) await setup(room, { seats: [...room.seats, free] });
}

export async function startGame(code: string) {
  const seed = Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');
  await updateDoc(roomRef(code), { status: 'playing', seed, startedAt: serverTimestamp() });
}

export async function finishGame(code: string) {
  await updateDoc(roomRef(code), { status: 'done', endedAt: serverTimestamp() });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Appends a move as `by` (yourself, or a bot when you're the host). `next()` gives the
 * next free move number as the watcher knows it; if another phone took that number
 * first, wait for the watcher to catch up and try again.
 */
export async function sendMove(code: string, next: () => number, move: Move, by?: string) {
  const { uid } = me();
  for (let tries = 0; tries < 12; tries++) {
    const n = next();
    try {
      await setDoc(doc(db, 'wonders', code, 'moves', String(n)), { n, by: by ?? uid, move });
      return;
    } catch (error) {
      if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
      await sleep(200 + Math.random() * 400);
    }
  }
  throw new Error('That move didn’t go through. Try again.');
}

export interface WondersData {
  room: WondersRoom | null;
  missing: boolean;
  moves: Recorded[];
}

export function watchRoom(code: string, uid: string, onChange: (data: WondersData) => void): Unsubscribe {
  let data: WondersData = { room: null, missing: false, moves: [] };
  const update = (patch: Partial<WondersData>) => {
    data = { ...data, ...patch };
    onChange(data);
  };
  let movesSub: Unsubscribe | null = null;
  const roomSub = onSnapshot(roomRef(code), (snap) => {
    if (!snap.exists()) return update({ missing: true, room: null });
    const d = snap.data();
    const room: WondersRoom = { code, host: d.host, seats: d.seats, names: d.names, status: d.status, sides: d.sides ?? 'A', seed: d.seed ?? null };
    update({ room, missing: false });
    if (!movesSub && room.seats.includes(uid) && room.status !== 'lobby') {
      movesSub = onSnapshot(
        collection(db, 'wonders', code, 'moves'),
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
