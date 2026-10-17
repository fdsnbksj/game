import { FirebaseError } from 'firebase/app';
import type { Unsubscribe } from 'firebase/firestore';
import type { Move } from '../games/hero/skills';
import { HERO_VERSION, type Recorded } from '../games/hero/state';
import { useGameStore } from '../store';
import { followRoom, poke, rest, restDoc } from './resilient';
import { newCode } from './roomCode';

// Hero Gambit in Firestore: heroDuels/{code} is a fight between two phones (every hero is
// the same, so a room holds only the players and the seed), and the moves are appended in
// order, one document each. tests/rules/hero.test.ts mirrors these writes.
//
// Room writes go over plain HTTPS and rooms are followed with a backup read, as in every
// party game (src/services/resilient.ts says why).

// ---------- Rooms ----------

export interface HeroRoom {
  code: string;
  host: string;
  playerIds: string[];
  names: Record<string, string>;
  status: 'lobby' | 'playing' | 'done';
  seed: string | null;
  /** The HERO_VERSION of the phone that opened it; null for a room from before rooms said. */
  version: number | null;
  /** The number of this fight's first move: 0, or where the latest rematch began. */
  from: number;
}

/** Why this phone can't play in a room made by another version of the game, if it can't. */
export const versionProblem = (version: number | null) =>
  version === HERO_VERSION ? null : version !== null && version > HERO_VERSION ? 'This fight is on a newer version of the game. Reload to get it.' : 'This fight was opened on an older version of the game. Reload, and open a new room.';

const roomRest = (code: string) => restDoc('heroDuels', code);
const moveRest = (code: string, n: number) => restDoc('heroDuels', code, 'moves', String(n));

function me() {
  const { uid, player } = useGameStore.getState();
  if (!uid || !player) throw new Error('Not connected yet. Try again in a moment.');
  return { uid, name: player.displayName };
}

export async function createHeroRoom(): Promise<string> {
  const { uid, name } = me();
  for (let tries = 0; tries < 5; tries++) {
    const code = newCode();
    try {
      await rest.setDoc(roomRest(code), { host: uid, playerIds: [uid], names: { [uid]: name }, status: 'lobby', version: HERO_VERSION, createdAt: rest.serverTimestamp() });
      return code;
    } catch (error) {
      if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
    }
  }
  throw new Error('Could not open a room. Try again.');
}

/** Joins as the second player. Returns why not, if you can't. */
export async function joinHeroRoom(code: string): Promise<string | null> {
  const { uid, name } = me();
  const snap = await rest.getDoc(roomRest(code));
  if (!snap.exists()) return 'No room with that code.';
  const room = snap.data();
  if ((room.playerIds as string[]).includes(uid)) return null;
  // Two versions would play the same moves differently, and the fight would stall.
  const problem = versionProblem((room.version as number | undefined) ?? null);
  if (problem) return problem;
  if (room.status !== 'lobby' || room.playerIds.length >= 2) return 'That fight is full.';
  await rest.updateDoc(roomRest(code), {
    playerIds: [...room.playerIds, uid],
    names: { ...room.names, [uid]: name },
  });
  poke(`heroDuels/${code}`);
  return null;
}

const newSeed = () => Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');

export async function startHeroRoom(code: string) {
  await rest.updateDoc(roomRest(code), { status: 'playing', seed: newSeed(), startedAt: rest.serverTimestamp() });
  poke(`heroDuels/${code}`);
}

/**
 * Another fight in the same room, once one is over: `from` is how many moves the room has,
 * so the new fight's moves follow on. If the other player got there first, that's fine.
 */
export async function rematchHeroRoom(code: string, from: number) {
  try {
    await rest.updateDoc(roomRest(code), { status: 'playing', seed: newSeed(), startedAt: rest.serverTimestamp(), from });
  } catch (error) {
    if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
  }
  poke(`heroDuels/${code}`);
}

export async function sendHeroMove(code: string, n: number, move: Move) {
  const { uid } = me();
  await rest.setDoc(moveRest(code, n), { n, by: uid, move });
  poke(`heroDuels/${code}`);
}

export async function finishHeroRoom(code: string) {
  await rest.updateDoc(roomRest(code), { status: 'done', endedAt: rest.serverTimestamp() });
  poke(`heroDuels/${code}`);
}

export interface HeroRoomData {
  room: HeroRoom | null;
  missing: boolean;
  moves: Recorded[];
}

/**
 * Follows a room and its moves: live listeners, backed up by reads over HTTPS every few
 * seconds and right after each write (src/services/resilient.ts).
 */
export function watchHeroRoom(code: string, uid: string, onChange: (data: HeroRoomData) => void): Unsubscribe {
  return followRoom<HeroRoom, Move>(
    'heroDuels',
    code,
    (d) => ({
      code,
      host: d.host as string,
      playerIds: d.playerIds as string[],
      names: d.names as Record<string, string>,
      status: d.status as HeroRoom['status'],
      seed: (d.seed as string | undefined) ?? null,
      version: (d.version as number | undefined) ?? null,
      from: (d.from as number | undefined) ?? 0,
    }),
    // Only the two players may read the moves, once the fight has started.
    (room) => room.playerIds.includes(uid) && room.status !== 'lobby',
    onChange,
    { rematch: true },
  );
}
