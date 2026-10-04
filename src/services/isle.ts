import { FirebaseError } from 'firebase/app';
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { Move, Recorded } from '../games/isle/state';
import { useGameStore } from '../store';
import { newCode } from './roomCode';

// Island Settlers rooms: isles/{code}, and its moves, one document each, in order. Most
// moves are the current player's, but discards after a 7 and answers to a trade offer
// come from several phones at once, so two may race for the same move number; the rules
// refuse the second, which simply tries the next number. Bots are seats named `bot:N`
// whose moves only the host's phone writes. tests/rules/isle.test.ts mirrors these writes.

export interface IsleRoom {
  code: string;
  host: string;
  seats: string[];
  names: Record<string, string>;
  status: 'lobby' | 'playing' | 'done';
  seed: string | null;
}

export const MAX_SEATS = 4;
export const isBot = (seat: string) => seat.startsWith('bot:');
const roomRef = (code: string) => doc(db, 'isles', code);

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
      await setDoc(roomRef(code), { host: uid, seats: [uid], names: { [uid]: name }, status: 'lobby', createdAt: serverTimestamp() });
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
  if (room.seats.length >= MAX_SEATS) return 'That room is full.';
  await updateDoc(roomRef(code), { seats: [...room.seats, uid], names: { ...room.names, [uid]: name } });
  return null;
}

export async function leaveRoom(room: IsleRoom) {
  const { uid } = me();
  await updateDoc(roomRef(room.code), { seats: room.seats.filter((s) => s !== uid) });
}

/** The host's lobby controls: bots in or out, and the seating order. */
export async function setSeats(room: IsleRoom, seats: string[]) {
  const names = { ...room.names };
  for (const seat of seats) if (isBot(seat) && !names[seat]) names[seat] = `Bot ${seat.slice(4)}`;
  await updateDoc(roomRef(room.code), { seats, names });
}

export async function addBot(room: IsleRoom) {
  const free = [1, 2, 3, 4, 5, 6].map((i) => `bot:${i}`).find((id) => !room.seats.includes(id));
  if (free) await setSeats(room, [...room.seats, free]);
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
      await setDoc(doc(db, 'isles', code, 'moves', String(n)), { n, by: by ?? uid, move });
      return;
    } catch (error) {
      if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
      await sleep(200 + Math.random() * 400);
    }
  }
  throw new Error('That move didn’t go through. Try again.');
}

export interface IsleData {
  room: IsleRoom | null;
  missing: boolean;
  moves: Recorded[];
}

export function watchRoom(code: string, uid: string, onChange: (data: IsleData) => void): Unsubscribe {
  let data: IsleData = { room: null, missing: false, moves: [] };
  const update = (patch: Partial<IsleData>) => {
    data = { ...data, ...patch };
    onChange(data);
  };
  let movesSub: Unsubscribe | null = null;
  const roomSub = onSnapshot(roomRef(code), (snap) => {
    if (!snap.exists()) return update({ missing: true, room: null });
    const d = snap.data();
    const room: IsleRoom = { code, host: d.host, seats: d.seats, names: d.names, status: d.status, seed: d.seed ?? null };
    update({ room, missing: false });
    if (!movesSub && room.seats.includes(uid) && room.status !== 'lobby') {
      movesSub = onSnapshot(
        collection(db, 'isles', code, 'moves'),
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
