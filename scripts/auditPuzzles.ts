import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Star } from '../src/sim/balance';
import { simulate, type Placed } from '../src/sim/combat';
import { SIDE_CELLS } from '../src/sim/hex';
import { LADDER_VERSION, puzzle, puzzleSeed, type Puzzle } from '../src/sim/puzzle';

// Replays the puzzle ladder and reports climbs that don't add up.
//
// The rules check each saved solution's shape, not that it wins or that it uses the
// creatures the level hands out; they can't make a level or run a fight. Levels come
// from their number alone, so here each one is made again and its solution replayed.
// Read-only: it writes nothing.
//
//   npm run audit                       # the emulator (runs this after the runs audit)
//   AUDIT_PROJECT_ID=<project-id> npm run audit -- --limit 200

const projectId = process.env.AUDIT_PROJECT_ID;
if (projectId === '') throw new Error('AUDIT_PROJECT_ID is set but empty');
if (!projectId) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.METADATA_SERVER_DETECTION ??= 'none';
}
const limitFlag = process.argv.indexOf('--limit');
const limit = limitFlag > 0 ? Number(process.argv[limitFlag + 1]) : 50;

const db = getFirestore(initializeApp({ projectId: projectId ?? 'demo-game' }, 'puzzles'));

interface LadderDoc {
  uid: string;
  name: string;
  v: number;
  level: number;
  solutions: Record<string, { u: string[]; c: number[]; s: number[]; it?: string[]; ia?: number[] }>;
}

const made = new Map<number, Puzzle>();
function level(n: number): Puzzle {
  if (!made.has(n)) made.set(n, puzzle(n));
  return made.get(n)!;
}

/** What's wrong with one level's solution, if anything. */
function check(n: number, board: LadderDoc['solutions'][string] | undefined): string | null {
  if (!board) return 'no solution saved';
  const p = level(n);
  const units: Placed[] = board.u.map((unitId, i) => {
    const held = board.it && board.ia ? board.it[board.ia.indexOf(i)] : undefined;
    return { unitId, cell: board.c[i], star: board.s[i] as Star, ...(held ? { item: held } : {}) };
  });
  // A level can be won without placing the whole hand, so a solution uses some of it.
  const key = (u: { unitId: string; star: number }) => `${u.unitId}:${u.star}`;
  if (!isSubset(units.map(key), p.hand.map(key))) return 'uses creatures the level does not hand out';
  if (!isSubset(board.it ?? [], p.items)) return 'uses items the level does not hand out';
  if (!units.every((u) => Number.isInteger(u.cell) && u.cell >= 0 && u.cell < SIDE_CELLS) || new Set(board.c).size !== board.c.length) {
    return 'places creatures off the board or on top of each other';
  }
  if (simulate(units, p.enemy, puzzleSeed(n), p.rivalPercent).winner !== 'a') return 'does not win when replayed';
  return null;
}

/** Whether every entry of `part` can be matched to a different entry of `whole`. */
function isSubset(part: string[], whole: string[]): boolean {
  const left = [...whole];
  for (const x of part) {
    const i = left.indexOf(x);
    if (i < 0) return false;
    left.splice(i, 1);
  }
  return true;
}

const snap = await db.collection('puzzles').where('v', '==', LADDER_VERSION).orderBy('level', 'desc').limit(limit).get();
let clean = 0;
const flagged: string[] = [];
for (const doc of snap.docs) {
  const ladder = doc.data() as LadderDoc;
  const problems: string[] = [];
  for (let n = 1; n <= ladder.level; n++) {
    const problem = check(n, ladder.solutions[`l${n}`]);
    if (problem) problems.push(`level ${n}: ${problem}`);
  }
  if (problems.length === 0) clean += 1;
  else flagged.push(`${doc.id} (${ladder.name}, level ${ladder.level}): ${problems.slice(0, 5).join('; ')}${problems.length > 5 ? ` and ${problems.length - 5} more` : ''}`);
}

console.log(`Checked ${snap.size} puzzle ladders from ${projectId ?? 'the emulator'}: ${clean} add up.`);
if (flagged.length > 0) console.log(`\n${flagged.length} to look at:\n  ${flagged.join('\n  ')}`);
await db.terminate();
