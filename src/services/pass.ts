import { FirebaseError } from 'firebase/app';
import type { Unsubscribe } from 'firebase/firestore';
import { MAX_SEATS, PASS_VERSION, type Move, type Recorded } from '../games/pass/state';
import { useGameStore } from '../store';
import { followRoom, poke, rest, restDoc } from './resilient';
import { newCode } from './roomCode';

// Pass or Pay rooms: passes/{code}, and its moves, one document each, in order, like Bluff
// Table's. Only the player whose turn it is moves. A room records the PASS_VERSION that
// opened it: a phone on another version would replay the moves differently, so it can't
// join. tests/rules/pass.test.ts mirrors these writes.

export interface PassRoom {
  code: string;
  host: string;
  seats: string[];
  names: Record<string, string>;
  status: 'lobby' | 'playing' | 'done';
  seed: string | null;
  version: number | null;
  /** The number of this game's first move: 0, or where the latest rematch began. */
  from: number;
}

/** Why this phone can't play in a room made by another version of the game, if it can't. */
export const versionProblem = (version: number | null) =>
  version === PASS_VERSION ? null : version !== null && version > PASS_VERSION ? 'This room is on a newer version of the game. Reload to get it.' : 'This room was opened on an older version of the game. Reload, and open a new room.';

const roomRef = (code: string) => restDoc('passes', code);

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
      await rest.setDoc(roomRef(code), { host: uid, seats: [uid], names: { [uid]: name }, status: 'lobby', version: PASS_VERSION, createdAt: rest.serverTimestamp() });
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
  poke(`passes/${code}`);
  return null;
}

export async function leaveRoom(room: PassRoom) {
  const { uid } = me();
  await rest.updateDoc(roomRef(room.code), { seats: room.seats.filter((s) => s !== uid) });
  poke(`passes/${room.code}`);
}

/** The host's seating order. */
export async function setSeats(room: PassRoom, seats: string[]) {
  await rest.updateDoc(roomRef(room.code), { seats });
  poke(`passes/${room.code}`);
}

const newSeed = () => Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');

export async function startGame(code: string) {
  await rest.updateDoc(roomRef(code), { status: 'playing', seed: newSeed(), startedAt: rest.serverTimestamp() });
  poke(`passes/${code}`);
}

/** Another game with the same seats once one is over; whichever phone asks first starts it. */
export async function rematch(code: string, from: number) {
  try {
    await rest.updateDoc(roomRef(code), { status: 'playing', seed: newSeed(), startedAt: rest.serverTimestamp(), from });
  } catch (error) {
    if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
  }
  poke(`passes/${code}`);
}

export async function finishGame(code: string) {
  await rest.updateDoc(roomRef(code), { status: 'done', endedAt: rest.serverTimestamp() });
  poke(`passes/${code}`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Appends your move as the next one; if another write took that number, waits for the watcher to catch up and tries again. */
export async function sendMove(code: string, next: () => number, move: Move) {
  const { uid } = me();
  for (let tries = 0; tries < 12; tries++) {
    const n = next();
    try {
      await rest.setDoc(restDoc('passes', code, 'moves', String(n)), { n, by: uid, move });
      poke(`passes/${code}`);
      return;
    } catch (error) {
      if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
      poke(`passes/${code}`);
      await sleep(200 + Math.random() * 400);
    }
  }
  throw new Error('That move didn’t go through. Try again.');
}

export interface PassData {
  room: PassRoom | null;
  missing: boolean;
  moves: Recorded[];
}

/** Follows a room and its moves, kept fresh even when the phone's stream stalls (src/services/resilient.ts). */
export function watchRoom(code: string, uid: string, onChange: (data: PassData) => void): Unsubscribe {
  return followRoom<PassRoom, Move>(
    'passes',
    code,
    (d) => ({
      code,
      host: d.host as string,
      seats: d.seats as string[],
      names: d.names as Record<string, string>,
      status: d.status as PassRoom['status'],
      seed: (d.seed as string | undefined) ?? null,
      version: (d.version as number | undefined) ?? null,
      from: (d.from as number | undefined) ?? 0,
    }),
    (room) => room.seats.includes(uid) && room.status !== 'lobby',
    onChange,
    { rematch: true },
  );
}
