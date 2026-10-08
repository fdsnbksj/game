import { FirebaseError } from 'firebase/app';
import type { Unsubscribe } from 'firebase/firestore';
import type { Move, Recorded } from '../games/duel/state';
import { useGameStore } from '../store';
import { followRoom, poke, rest, restDoc } from './resilient';
import { newCode } from './roomCode';

// Rival Wonders rooms in Firestore: duels/{code}, and its moves, one document each, in
// order. firestore.rules lets each player append only their own moves, in sequence;
// tests/rules/duel.test.ts mirrors these writes. Both phones replay the same moves from
// the same seed (src/games/duel/state.ts), so they always show the same game.

export interface Duel {
  code: string;
  host: string;
  playerIds: string[];
  names: Record<string, string>;
  status: 'lobby' | 'playing' | 'done';
  seed: string | null;
}

const duelRef = (code: string) => restDoc('duels', code);

function me() {
  const { uid, player } = useGameStore.getState();
  if (!uid || !player) throw new Error('Not connected yet. Try again in a moment.');
  return { uid, name: player.displayName };
}

export async function createDuel(): Promise<string> {
  const { uid, name } = me();
  for (let tries = 0; tries < 5; tries++) {
    const code = newCode();
    try {
      await rest.setDoc(duelRef(code), { host: uid, playerIds: [uid], names: { [uid]: name }, status: 'lobby', createdAt: rest.serverTimestamp() });
      return code;
    } catch (error) {
      if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
    }
  }
  throw new Error('Could not open a room. Try again.');
}

/** Joins as the second player. Returns why not, if you can't. */
export async function joinDuel(code: string): Promise<string | null> {
  const { uid, name } = me();
  const snap = await rest.getDoc(duelRef(code));
  if (!snap.exists()) return 'No room with that code.';
  const room = snap.data();
  if ((room.playerIds as string[]).includes(uid)) return null;
  if (room.status !== 'lobby' || room.playerIds.length >= 2) return 'That game is full.';
  await rest.updateDoc(duelRef(code), { playerIds: [...room.playerIds, uid], names: { ...room.names, [uid]: name } });
  poke(`duels/${code}`);
  return null;
}

/** Starts the game with a fresh seed: it decides the layouts, tokens and wonders. */
export async function startDuel(code: string) {
  const seed = Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');
  await rest.updateDoc(duelRef(code), { status: 'playing', seed, startedAt: rest.serverTimestamp() });
  poke(`duels/${code}`);
}

/** Writes move number `n`. Refused if someone else already wrote it (the watcher catches up). */
export async function sendMove(code: string, n: number, move: Move) {
  const { uid } = me();
  await rest.setDoc(restDoc('duels', code, 'moves', String(n)), { n, by: uid, move });
  poke(`duels/${code}`);
}

/** The game is over: either phone may say so; replay() decides it the same on both. */
export async function finishDuel(code: string) {
  await rest.updateDoc(duelRef(code), { status: 'done', endedAt: rest.serverTimestamp() });
  poke(`duels/${code}`);
}

export interface DuelData {
  room: Duel | null;
  missing: boolean;
  /** Every move so far, in order. */
  moves: Recorded[];
}

/** Follows a room and its moves, kept fresh even when the phone's stream stalls (src/services/resilient.ts). */
export function watchDuel(code: string, uid: string, onChange: (data: DuelData) => void): Unsubscribe {
  return followRoom<Duel, Move>(
    'duels',
    code,
    (d) => ({
      code,
      host: d.host as string,
      playerIds: d.playerIds as string[],
      names: d.names as Record<string, string>,
      status: d.status as Duel['status'],
      seed: (d.seed as string | undefined) ?? null,
    }),
    // Only the two players may read the moves.
    (room) => room.playerIds.includes(uid) && room.status !== 'lobby',
    onChange,
  );
}
