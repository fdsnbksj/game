import { FirebaseError } from 'firebase/app';
import type { Unsubscribe } from 'firebase/firestore';
import { KITCHEN_VERSION } from '../games/kitchen/sim';
import { useGameStore } from '../store';
import { followRoom, poke, rest, restDoc, type Recorded } from './resilient';
import { newCode } from './roomCode';
import { measureRoomClock } from './clock';

// Short Order in Firestore: kitchens/{code} is a shift for one to four phones, and each tap
// is a move appended in order (`{t, x, y}`: the tick it was made at and the tile). Every
// phone taps whenever it likes, so a tap may find its number taken by another phone's: it
// tries the next. The shift starts COUNTDOWN_MS after the server's `startedAt`, and each
// phone measures how far its own clock is from the server's, so all see the same kitchen
// at the same moment. tests/rules/kitchen.test.ts mirrors these writes.

export type Tap = { t: number; x: number; y: number };

export interface KitchenRoom {
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
  /** Counts the games in this room, so a rematch after a game with no taps is still news. */
  game: number;
  /** Which kitchen (an index into KITCHENS). */
  kitchen: number;
}

export const MAX_COOKS = 4;

/** The 3-2-1 before the pen opens: the rules count from the same moment. */
export const COUNTDOWN_MS = 3000;

export const versionProblem = (version: number | null) =>
  version === KITCHEN_VERSION ? null : version !== null && version > KITCHEN_VERSION ? 'This room is on a newer version of the game. Reload to get it.' : 'This room was opened on an older version of the game. Reload, and open a new room.';

const roomRef = (code: string) => restDoc('kitchens', code);

function me() {
  const { uid, player } = useGameStore.getState();
  if (!uid || !player) throw new Error('Not connected yet. Try again in a moment.');
  return { uid, name: player.displayName };
}

export async function createKitchenRoom(): Promise<string> {
  const { uid, name } = me();
  for (let tries = 0; tries < 5; tries++) {
    const code = newCode();
    try {
      await rest.setDoc(roomRef(code), { host: uid, playerIds: [uid], names: { [uid]: name }, status: 'lobby', version: KITCHEN_VERSION, game: 0, createdAt: rest.serverTimestamp() });
      return code;
    } catch (error) {
      if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
    }
  }
  throw new Error('Could not open a room. Try again.');
}

export async function joinKitchenRoom(code: string): Promise<string | null> {
  const { uid, name } = me();
  const snap = await rest.getDoc(roomRef(code));
  if (!snap.exists()) return 'No room with that code.';
  const room = snap.data();
  if ((room.playerIds as string[]).includes(uid)) return null;
  const problem = versionProblem((room.version as number | undefined) ?? null);
  if (problem) return problem;
  if (room.status !== 'lobby' || room.playerIds.length >= MAX_COOKS) return 'That room is full.';
  await rest.updateDoc(roomRef(code), { playerIds: [...room.playerIds, uid], names: { ...room.names, [uid]: name } });
  poke(`kitchens/${code}`);
  return null;
}

export async function leaveKitchenRoom(room: KitchenRoom) {
  const { uid } = me();
  await rest.updateDoc(roomRef(room.code), { playerIds: room.playerIds.filter((p) => p !== uid) });
  poke(`kitchens/${room.code}`);
}

const newSeed = () => Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');

export async function startKitchenRoom(code: string, kitchen: number) {
  await rest.updateDoc(roomRef(code), { status: 'playing', seed: newSeed(), startedAt: rest.serverTimestamp(), kitchen });
  poke(`kitchens/${code}`);
}

/** Another game once one is over, by either player; if the other got there first, that's fine. */
export async function rematchKitchenRoom(room: KitchenRoom, from: number, kitchen: number) {
  try {
    await rest.updateDoc(roomRef(room.code), { status: 'playing', seed: newSeed(), startedAt: rest.serverTimestamp(), from, game: room.game + 1, kitchen });
  } catch (error) {
    if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
  }
  poke(`kitchens/${room.code}`);
}

/** Marks the shift over; the rules allow it once the three minutes are up by the server's clock. */
export async function finishKitchenRoom(code: string) {
  try {
    await rest.updateDoc(roomRef(code), { status: 'done', endedAt: rest.serverTimestamp() });
  } catch (error) {
    if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
  }
  poke(`kitchens/${code}`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Appends a tap as the next move; if another phone's tap took that number, tries the next. */
export async function sendTap(code: string, next: () => number, tap: Tap) {
  const { uid } = me();
  let n = next();
  for (let tries = 0; tries < 12; tries++) {
    try {
      await rest.setDoc(restDoc('kitchens', code, 'moves', String(n)), { n, by: uid, move: tap });
      poke(`kitchens/${code}`);
      return;
    } catch (error) {
      if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
      // Taken, most likely: the next free number is at least one on.
      n = Math.max(n + 1, next());
      poke(`kitchens/${code}`);
      await sleep(60 + Math.random() * 120);
    }
  }
  throw new Error('That tap didn’t go through.');
}

/** How far the server's clock is ahead of this phone's, in ms, or null if it couldn't tell. */
export const measureClock = (code: string) => measureRoomClock('kitchens', code);

export interface KitchenRoomData {
  room: KitchenRoom | null;
  missing: boolean;
  moves: Recorded<Tap>[];
}

const millis = (t: unknown) => (t && typeof (t as { toMillis?: unknown }).toMillis === 'function' ? (t as { toMillis(): number }).toMillis() : null);

export function watchKitchenRoom(code: string, uid: string, onChange: (data: KitchenRoomData) => void): Unsubscribe {
  return followRoom<KitchenRoom, Tap>(
    'kitchens',
    code,
    (d) => ({
      code,
      host: d.host as string,
      playerIds: d.playerIds as string[],
      names: d.names as Record<string, string>,
      status: d.status as KitchenRoom['status'],
      seed: (d.seed as string | undefined) ?? null,
      version: (d.version as number | undefined) ?? null,
      startedAt: millis(d.startedAt),
      from: (d.from as number | undefined) ?? 0,
      game: (d.game as number | undefined) ?? 0,
      kitchen: (d.kitchen as number | undefined) ?? 0,
    }),
    (room) => room.playerIds.includes(uid) && room.status !== 'lobby',
    onChange,
    { rematch: true },
  );
}
