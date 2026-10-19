import { FirebaseError } from 'firebase/app';
import type { Unsubscribe } from 'firebase/firestore';
import { TRAPS_VERSION } from '../games/traps/sim';
import { MAX_SEATS, type Move, type Recorded } from '../games/traps/state';
import { useGameStore } from '../store';
import { followRoom, poke, rest, restDoc } from './resilient';
import { newCode } from './roomCode';

// Trap Tower rooms: traps/{code}, and its moves, one document each, in order. Everyone
// picks, places and runs at the same time, so two phones often race for the same move
// number; the rules refuse the second, which simply tries the next one. A room records the
// TRAPS_VERSION that opened it: runs replay only on the same version, so a phone on another
// can't join. tests/rules/traps.test.ts mirrors these writes.

export interface TrapsRoom {
  code: string;
  host: string;
  seats: string[];
  names: Record<string, string>;
  status: 'lobby' | 'playing' | 'done';
  seed: string | null;
  /** The number of this game's first move: 0, or where the latest rematch began. */
  from: number;
  version: number | null;
}

export { MAX_SEATS };

export const versionProblem = (version: number | null) =>
  version === TRAPS_VERSION ? null : version !== null && version > TRAPS_VERSION ? 'This room is on a newer version of the game. Reload to get it.' : 'This room was opened on an older version of the game. Reload, and open a new room.';

const roomRef = (code: string) => restDoc('traps', code);

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
      await rest.setDoc(roomRef(code), { host: uid, seats: [uid], names: { [uid]: name }, status: 'lobby', version: TRAPS_VERSION, createdAt: rest.serverTimestamp() });
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
  const problem = versionProblem((room.version as number | undefined) ?? null);
  if (problem) return problem;
  if (room.status !== 'lobby') return 'That game has already started.';
  if (room.seats.length >= MAX_SEATS) return 'That room is full.';
  await rest.updateDoc(roomRef(code), { seats: [...room.seats, uid], names: { ...room.names, [uid]: name } });
  poke(`traps/${code}`);
  return null;
}

export async function leaveRoom(room: TrapsRoom) {
  const { uid } = me();
  await rest.updateDoc(roomRef(room.code), { seats: room.seats.filter((s) => s !== uid) });
  poke(`traps/${room.code}`);
}

/** The host's lobby control: the seating order. */
export async function setSeats(room: TrapsRoom, seats: string[]) {
  await rest.updateDoc(roomRef(room.code), { seats });
  poke(`traps/${room.code}`);
}

const newSeed = () => Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');

export async function startGame(code: string) {
  await rest.updateDoc(roomRef(code), { status: 'playing', seed: newSeed(), startedAt: rest.serverTimestamp() });
  poke(`traps/${code}`);
}

/**
 * Another game in the same room and seats, once one is over: `from` is how many moves the
 * room has, so the new game's moves follow on. If another phone got there first, that's fine.
 */
export async function rematch(code: string, from: number) {
  try {
    await rest.updateDoc(roomRef(code), { status: 'playing', seed: newSeed(), startedAt: rest.serverTimestamp(), from });
  } catch (error) {
    if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
  }
  poke(`traps/${code}`);
}

export async function finishGame(code: string) {
  await rest.updateDoc(roomRef(code), { status: 'done', endedAt: rest.serverTimestamp() });
  poke(`traps/${code}`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Appends a move of yours. `next()` gives the
 * next free move number as the watcher knows it; if another phone took that number
 * first, wait for the watcher to catch up and try again.
 */
export async function sendMove(code: string, next: () => number, move: Move) {
  const { uid } = me();
  for (let tries = 0; tries < 12; tries++) {
    const n = next();
    try {
      await rest.setDoc(restDoc('traps', code, 'moves', String(n)), { n, by: uid, move });
      poke(`traps/${code}`);
      return;
    } catch (error) {
      if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
      poke(`traps/${code}`);
      await sleep(200 + Math.random() * 400);
    }
  }
  throw new Error('That move didn’t go through. Try again.');
}

export interface TrapsData {
  room: TrapsRoom | null;
  missing: boolean;
  moves: Recorded[];
}

/** Follows a room and its moves, kept fresh even when the phone's stream stalls (src/services/resilient.ts). */
export function watchRoom(code: string, uid: string, onChange: (data: TrapsData) => void): Unsubscribe {
  return followRoom<TrapsRoom, Move>(
    'traps',
    code,
    (d) => ({ code, host: d.host as string, seats: d.seats as string[], names: d.names as Record<string, string>, status: d.status as TrapsRoom['status'], seed: (d.seed as string | undefined) ?? null, from: (d.from as number | undefined) ?? 0, version: (d.version as number | undefined) ?? null }),
    (room) => room.seats.includes(uid) && room.status !== 'lobby',
    onChange,
    { rematch: true },
  );
}
