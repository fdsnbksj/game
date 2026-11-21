import { FirebaseError } from 'firebase/app';
import type { Unsubscribe } from 'firebase/firestore';
import { PIGS_VERSION } from '../games/pigs/sim';
import { useGameStore } from '../store';
import { followRoom, poke, rest, restDoc, type Recorded } from './resilient';
import { newCode } from './roomCode';

// Pig Lasso in Firestore: pigs/{code} is a match between two phones, and each throw is a
// move appended in order (`{t}`, the tick it was thrown at). Both phones throw whenever
// they like, so a throw may find its number taken by the other phone's: it tries the next.
// The game starts COUNTDOWN_MS after the server's `startedAt`, and each phone measures how
// far its own clock is from the server's, so both see the same pen at the same moment.
// tests/rules/pigs.test.ts mirrors these writes.

export type Throw = { t: number };

export interface PigRoom {
  code: string;
  host: string;
  playerIds: string[];
  names: Record<string, string>;
  status: 'lobby' | 'playing' | 'done';
  seed: string | null;
  version: number | null;
  /** Server time the game was started, in ms; the pen opens COUNTDOWN_MS later. */
  startedAt: number | null;
  /** The number of this game's first move. */
  from: number;
  /** Counts the games in this room, so a rematch after a game with no throws is still news. */
  game: number;
}

/** The 3-2-1 before the pen opens: the rules count from the same moment. */
export const COUNTDOWN_MS = 3000;

export const versionProblem = (version: number | null) =>
  version === PIGS_VERSION ? null : version !== null && version > PIGS_VERSION ? 'This room is on a newer version of the game. Reload to get it.' : 'This room was opened on an older version of the game. Reload, and open a new room.';

const roomRef = (code: string) => restDoc('pigs', code);

function me() {
  const { uid, player } = useGameStore.getState();
  if (!uid || !player) throw new Error('Not connected yet. Try again in a moment.');
  return { uid, name: player.displayName };
}

export async function createPigRoom(): Promise<string> {
  const { uid, name } = me();
  for (let tries = 0; tries < 5; tries++) {
    const code = newCode();
    try {
      await rest.setDoc(roomRef(code), { host: uid, playerIds: [uid], names: { [uid]: name }, status: 'lobby', version: PIGS_VERSION, game: 0, createdAt: rest.serverTimestamp() });
      return code;
    } catch (error) {
      if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
    }
  }
  throw new Error('Could not open a room. Try again.');
}

export async function joinPigRoom(code: string): Promise<string | null> {
  const { uid, name } = me();
  const snap = await rest.getDoc(roomRef(code));
  if (!snap.exists()) return 'No room with that code.';
  const room = snap.data();
  if ((room.playerIds as string[]).includes(uid)) return null;
  const problem = versionProblem((room.version as number | undefined) ?? null);
  if (problem) return problem;
  if (room.status !== 'lobby' || room.playerIds.length >= 2) return 'That room is full.';
  await rest.updateDoc(roomRef(code), { playerIds: [...room.playerIds, uid], names: { ...room.names, [uid]: name } });
  poke(`pigs/${code}`);
  return null;
}

export async function leavePigRoom(room: PigRoom) {
  const { uid } = me();
  await rest.updateDoc(roomRef(room.code), { playerIds: room.playerIds.filter((p) => p !== uid) });
  poke(`pigs/${room.code}`);
}

const newSeed = () => Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');

export async function startPigRoom(code: string) {
  await rest.updateDoc(roomRef(code), { status: 'playing', seed: newSeed(), startedAt: rest.serverTimestamp() });
  poke(`pigs/${code}`);
}

/** Another game once one is over, by either player; if the other got there first, that's fine. */
export async function rematchPigRoom(room: PigRoom, from: number) {
  try {
    await rest.updateDoc(roomRef(room.code), { status: 'playing', seed: newSeed(), startedAt: rest.serverTimestamp(), from, game: room.game + 1 });
  } catch (error) {
    if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
  }
  poke(`pigs/${room.code}`);
}

/** Marks the game over; the rules allow it once the minute is up by the server's clock. */
export async function finishPigRoom(code: string) {
  try {
    await rest.updateDoc(roomRef(code), { status: 'done', endedAt: rest.serverTimestamp() });
  } catch (error) {
    if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
  }
  poke(`pigs/${code}`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Appends a throw as the next move; if the other phone's throw took that number, tries the next. */
export async function sendThrow(code: string, next: () => number, t: number) {
  const { uid } = me();
  let n = next();
  for (let tries = 0; tries < 12; tries++) {
    try {
      await rest.setDoc(restDoc('pigs', code, 'moves', String(n)), { n, by: uid, move: { t } });
      poke(`pigs/${code}`);
      return;
    } catch (error) {
      if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
      // Taken, most likely: the next free number is at least one on.
      n = Math.max(n + 1, next());
      poke(`pigs/${code}`);
      await sleep(60 + Math.random() * 120);
    }
  }
  throw new Error('That throw didn’t go through.');
}

/** Gives up on a request that hasn't answered in `ms` (a phone's connection can hang without failing). */
function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms))]);
}

/**
 * How far the server's clock is ahead of this phone's, in ms, or null if it couldn't tell:
 * stamps the room's heartbeat with the server's time and reads it back, a few times,
 * trusting the quickest round trip. A sample that fails or hangs is skipped.
 */
export async function measureClock(code: string): Promise<number | null> {
  let best: { rtt: number; offset: number } | null = null;
  for (let i = 0; i < 3; i++) {
    try {
      const sent = Date.now();
      await within(rest.updateDoc(roomRef(code), { seenAt: rest.serverTimestamp() }), 4000);
      const back = Date.now();
      const snap = await within(rest.getDoc(roomRef(code)), 4000);
      const seenAt = millis(snap.data()?.seenAt);
      // The stamp was made somewhere in the write's round trip; the read adds nothing to that.
      if (seenAt !== null && (!best || back - sent < best.rtt)) best = { rtt: back - sent, offset: seenAt - (sent + back) / 2 };
    } catch {
      // Offline for a moment, or the request hung: try the next sample.
    }
  }
  return best?.offset ?? null;
}

export interface PigRoomData {
  room: PigRoom | null;
  missing: boolean;
  moves: Recorded<Throw>[];
}

const millis = (t: unknown) => (t && typeof (t as { toMillis?: unknown }).toMillis === 'function' ? (t as { toMillis(): number }).toMillis() : null);

export function watchPigRoom(code: string, uid: string, onChange: (data: PigRoomData) => void): Unsubscribe {
  return followRoom<PigRoom, Throw>(
    'pigs',
    code,
    (d) => ({
      code,
      host: d.host as string,
      playerIds: d.playerIds as string[],
      names: d.names as Record<string, string>,
      status: d.status as PigRoom['status'],
      seed: (d.seed as string | undefined) ?? null,
      version: (d.version as number | undefined) ?? null,
      startedAt: millis(d.startedAt),
      from: (d.from as number | undefined) ?? 0,
      game: (d.game as number | undefined) ?? 0,
    }),
    (room) => room.playerIds.includes(uid) && room.status !== 'lobby',
    onChange,
    { rematch: true },
  );
}
