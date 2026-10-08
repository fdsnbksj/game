import { FirebaseError } from 'firebase/app';
import type { Unsubscribe } from 'firebase/firestore';
import type { Move, Recorded } from '../games/isle/state';
import { useGameStore } from '../store';
import { followRoom, poke, rest, restDoc } from './resilient';
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
const roomRef = (code: string) => restDoc('isles', code);

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
      await rest.setDoc(roomRef(code), { host: uid, seats: [uid], names: { [uid]: name }, status: 'lobby', createdAt: rest.serverTimestamp() });
      return code;
    } catch (error) {
      if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
    }
  }
  throw new Error('Could not open a room. Try again.');
}

export async function joinRoom(code: string): Promise<string | null> {
  const { uid, name } = me();
  const snap = await rest.getDoc(roomRef(code));
  if (!snap.exists()) return 'No room with that code.';
  const room = snap.data();
  if ((room.seats as string[]).includes(uid)) return null;
  if (room.status !== 'lobby') return 'That game has already started.';
  if (room.seats.length >= MAX_SEATS) return 'That room is full.';
  await rest.updateDoc(roomRef(code), { seats: [...room.seats, uid], names: { ...room.names, [uid]: name } });
  poke(`isles/${code}`);
  return null;
}

export async function leaveRoom(room: IsleRoom) {
  const { uid } = me();
  await rest.updateDoc(roomRef(room.code), { seats: room.seats.filter((s) => s !== uid) });
  poke(`isles/${room.code}`);
}

/** The host's lobby controls: bots in or out, and the seating order. */
export async function setSeats(room: IsleRoom, seats: string[]) {
  const names = { ...room.names };
  for (const seat of seats) if (isBot(seat) && !names[seat]) names[seat] = `Bot ${seat.slice(4)}`;
  await rest.updateDoc(roomRef(room.code), { seats, names });
  poke(`isles/${room.code}`);
}

export async function addBot(room: IsleRoom) {
  const free = [1, 2, 3, 4, 5, 6].map((i) => `bot:${i}`).find((id) => !room.seats.includes(id));
  if (free) await setSeats(room, [...room.seats, free]);
}

export async function startGame(code: string) {
  const seed = Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');
  await rest.updateDoc(roomRef(code), { status: 'playing', seed, startedAt: rest.serverTimestamp() });
  poke(`isles/${code}`);
}

export async function finishGame(code: string) {
  await rest.updateDoc(roomRef(code), { status: 'done', endedAt: rest.serverTimestamp() });
  poke(`isles/${code}`);
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
      await rest.setDoc(restDoc('isles', code, 'moves', String(n)), { n, by: by ?? uid, move });
      poke(`isles/${code}`);
      return;
    } catch (error) {
      if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
      poke(`isles/${code}`);
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

/** Follows a room and its moves, kept fresh even when the phone's stream stalls (src/services/resilient.ts). */
export function watchRoom(code: string, uid: string, onChange: (data: IsleData) => void): Unsubscribe {
  return followRoom<IsleRoom, Move>(
    'isles',
    code,
    (d) => ({ code, host: d.host as string, seats: d.seats as string[], names: d.names as Record<string, string>, status: d.status as IsleRoom['status'], seed: (d.seed as string | undefined) ?? null }),
    (room) => room.seats.includes(uid) && room.status !== 'lobby',
    onChange,
  );
}
