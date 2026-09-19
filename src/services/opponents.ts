import { getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { BALANCE_VERSION } from '../sim/balance';
import type { Placed } from '../sim/combat';
import { fromSnapshot, isLegalBoard, type BoardSnapshot } from '../sim/validate';
import { runsCollection } from './refs';

export interface Ghost {
  runId: string;
  name: string;
  units: Placed[];
}

/**
 * A random real player's board from the same round, from a run on the same balance
 * version. Runs carry a random `rand`, so starting at a random point and taking the next
 * one picks fairly. Null if there's none to be had (the caller falls back to a bot).
 */
export async function findGhost(round: number, uid: string): Promise<Ghost | null> {
  const start = Math.floor(Math.random() * 2 ** 31);
  // From the random point, then from the beginning in case it was past the last run.
  for (const from of [start, 0]) {
    const snap = await getDocs(
      query(
        runsCollection(),
        where('v', '==', BALANCE_VERSION),
        where('rounds', 'array-contains', round),
        where('rand', '>=', from),
        orderBy('rand'),
        limit(2),
      ),
    );
    for (const doc of snap.docs) {
      if (doc.get('uid') === uid) continue;
      const board = doc.get(`boards.r${round}`) as BoardSnapshot | undefined;
      // The rules already check boards; this guards against old or odd data.
      if (!board || !isLegalBoard(board, round) || board.u.length === 0) continue;
      return { runId: doc.id, name: doc.get('name') as string, units: fromSnapshot(board) };
    }
  }
  return null;
}
