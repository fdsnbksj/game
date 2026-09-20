import { FirebaseError } from 'firebase/app';
import { getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { dayId } from '../shared/constants';
import { BALANCE_VERSION, START_HP } from '../sim/balance';
import type { BoardSnapshot } from '../sim/validate';
import type { Player } from '../store';
import { playerRef, rankingRef, runRef } from './refs';
import type { RunMode } from '../sim/planning';
import { invalidateRankings } from './rankings';

// Writes a run to Firestore: one batch to start it, then one per round. firestore.rules
// checks each write, so these must match what the rules expect exactly; the rules tests
// in tests/rules/brawl.test.ts mirror them.

/** A round waiting to be written: the board it was fought with and the run after it. */
export interface RoundWrite {
  round: number;
  board: BoardSnapshot;
  hp: number;
  wins: number;
  done: boolean;
}

/**
 * Starts a run. An ordinary run is `${uid}_${player.runsStarted}` and is counted on the
 * player in the same batch; the daily challenge is `${uid}_d${day}`, one per day, and
 * stands alone.
 */
export async function startOnlineRun(uid: string, player: Player, runId: string, rand: number, mode: RunMode, day: string) {
  const batch = writeBatch(db);
  if (mode === 'run') batch.update(playerRef(uid), { runsStarted: player.runsStarted + 1, lastRunStartAt: serverTimestamp() });
  batch.set(runRef(runId), {
    mode,
    day: mode === 'daily' ? day : '',
    uid,
    name: player.displayName,
    v: BALANCE_VERSION,
    rand,
    round: 0,
    rounds: [],
    boards: {},
    hp: START_HP,
    wins: 0,
    done: false,
    startedAt: serverTimestamp(),
    lastAt: serverTimestamp(),
  });
  await batch.commit();
}

/**
 * Writes one round. The last round also files the run on today's rankings, if it beats
 * the player's best today (the rules only accept an improvement).
 */
export async function writeRound(uid: string, player: Player, runId: string, write: RoundWrite, mode: RunMode, day: string) {
  const batch = writeBatch(db);
  batch.update(runRef(runId), {
    round: write.round,
    rounds: Array.from({ length: write.round }, (_, i) => i + 1),
    [`boards.r${write.round}`]: write.board,
    hp: write.hp,
    wins: write.wins,
    done: write.done,
    lastAt: serverTimestamp(),
  });

  let ranked = false;
  if (write.done) {
    // The daily challenge is filed under its own day; an ordinary run under today's.
    const board = mode === 'daily' ? day : dayId();
    const score = write.wins * 1000 + write.hp;
    const best = await getDoc(rankingRef(board, uid, mode)).catch(() => null);
    // Unknown (couldn't read it): skip rather than risk the rules rejecting the whole batch.
    if (best && (!best.exists() || score > (best.get('score') as number))) {
      batch.set(rankingRef(board, uid, mode), {
        score,
        wins: write.wins,
        hp: write.hp,
        runId,
        displayName: player.displayName,
        submittedAt: serverTimestamp(),
      });
      ranked = true;
    }
  }
  await batch.commit();
  if (ranked) invalidateRankings();
}

/**
 * Whether a failed write could succeed if tried again. The rest mean the rules refused it,
 * and retrying the same write won't help.
 */
export function isRetryable(error: unknown) {
  return error instanceof FirebaseError && ['unavailable', 'deadline-exceeded', 'aborted', 'internal', 'unknown'].includes(error.code);
}
