import { FirebaseError } from 'firebase/app';
import type { Unsubscribe } from 'firebase/firestore';
import type { SideChoice } from '../games/wonders/setup';
import type { Move, Recorded } from '../games/wonders/state';
import { useGameStore } from '../store';
import { followRoom, poke, rest, restDoc } from './resilient';
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
const roomRef = (code: string) => restDoc('wonders', code);

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
      await rest.setDoc(roomRef(code), { host: uid, seats: [uid], names: { [uid]: name }, status: 'lobby', sides: 'A', createdAt: rest.serverTimestamp() });
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
  if (room.seats.length >= 7) return 'That room is full.';
  await rest.updateDoc(roomRef(code), { seats: [...room.seats, uid], names: { ...room.names, [uid]: name } });
  poke(`wonders/${code}`);
  return null;
}

export async function leaveRoom(room: WondersRoom) {
  const { uid } = me();
  await rest.updateDoc(roomRef(room.code), { seats: room.seats.filter((s) => s !== uid) });
  poke(`wonders/${room.code}`);
}

/** The host's lobby controls: seats (bots in or out, and the order) and the wonder sides. */
export async function setup(room: WondersRoom, patch: { seats?: string[]; sides?: SideChoice }) {
  const seats = patch.seats ?? room.seats;
  const names = { ...room.names };
  for (const seat of seats) if (isBot(seat) && !names[seat]) names[seat] = `Bot ${seat.slice(4)}`;
  await rest.updateDoc(roomRef(room.code), { seats, names, sides: patch.sides ?? room.sides });
  poke(`wonders/${room.code}`);
}

export async function addBot(room: WondersRoom) {
  const free = [1, 2, 3, 4, 5, 6].map((i) => `bot:${i}`).find((id) => !room.seats.includes(id));
  if (free) await setup(room, { seats: [...room.seats, free] });
}

export async function startGame(code: string) {
  const seed = Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');
  await rest.updateDoc(roomRef(code), { status: 'playing', seed, startedAt: rest.serverTimestamp() });
  poke(`wonders/${code}`);
}

export async function finishGame(code: string) {
  await rest.updateDoc(roomRef(code), { status: 'done', endedAt: rest.serverTimestamp() });
  poke(`wonders/${code}`);
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
      await rest.setDoc(restDoc('wonders', code, 'moves', String(n)), { n, by: by ?? uid, move });
      poke(`wonders/${code}`);
      return;
    } catch (error) {
      if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
      poke(`wonders/${code}`);
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

/** Follows a room and its moves, kept fresh even when the phone's stream stalls (src/services/resilient.ts). */
export function watchRoom(code: string, uid: string, onChange: (data: WondersData) => void): Unsubscribe {
  return followRoom<WondersRoom, Move>(
    'wonders',
    code,
    (d) => ({ code, host: d.host as string, seats: d.seats as string[], names: d.names as Record<string, string>, status: d.status as WondersRoom['status'], sides: (d.sides as WondersRoom['sides'] | undefined) ?? 'A', seed: (d.seed as string | undefined) ?? null }),
    (room) => room.seats.includes(uid) && room.status !== 'lobby',
    onChange,
  );
}
