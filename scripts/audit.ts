import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { cluesOf, sameClue, type Clues } from '../src/nonogram/clues';
import { dailyNonogram, nonogram, NONOGRAM_VERSION } from '../src/nonogram/generate';

// Checks saved solves against their puzzles and reports ones that don't add up.
//
// The rules check each solve's shape (a grid of the right size, levels in order), not
// that it answers the puzzle: they can't make one. Puzzles come from their level or day
// alone, so here each is made again and every saved grid checked against its clues.
// Read-only: it writes nothing.
//
//   npm run audit                                   # the emulator
//   AUDIT_PROJECT_ID=<project-id> npm run audit -- --limit 200 --days 7

const projectId = process.env.AUDIT_PROJECT_ID;
if (projectId === '') throw new Error('AUDIT_PROJECT_ID is set but empty');
if (!projectId) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.METADATA_SERVER_DETECTION ??= 'none';
}
const flag = (name: string, fallback: number) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const limit = flag('--limit', 50);
const days = flag('--days', 3);

const db = getFirestore(initializeApp({ projectId: projectId ?? 'demo-game' }));

/** What's wrong with one saved grid, if anything. */
function check(grid: unknown, puzzle: Clues & { size: number }): string | null {
  if (typeof grid !== 'string') return 'no grid saved';
  if (grid.length !== puzzle.size * puzzle.size || !/^[01]*$/.test(grid)) return 'grid is the wrong shape';
  const clues = cluesOf([...grid].map(Number), puzzle.size);
  const matches = clues.rows.every((c, i) => sameClue(c, puzzle.rows[i])) && clues.cols.every((c, i) => sameClue(c, puzzle.cols[i]));
  return matches ? null : "doesn't match the clues";
}

// The ladders furthest up, level by level.
const ladders = await db.collection('ladders').where('v', '==', NONOGRAM_VERSION).orderBy('level', 'desc').limit(limit).get();
let clean = 0;
const flagged: string[] = [];
for (const doc of ladders.docs) {
  const { name, level, solutions } = doc.data() as { name: string; level: number; solutions: Record<string, unknown> };
  const problems: string[] = [];
  for (let n = 1; n <= level; n++) {
    const problem = check(solutions[`l${n}`], nonogram(n));
    if (problem) problems.push(`level ${n}: ${problem}`);
  }
  if (problems.length === 0) clean += 1;
  else flagged.push(`${doc.id} (${name}, level ${level}): ${problems.slice(0, 5).join('; ')}${problems.length > 5 ? ` and ${problems.length - 5} more` : ''}`);
}
console.log(`Checked ${ladders.size} ladders from ${projectId ?? 'the emulator'}: ${clean} add up.`);

// Every solve of the last few daily puzzles.
let solves = 0;
for (let back = 0; back < days; back++) {
  const day = new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10);
  const puzzle = dailyNonogram(day);
  const snap = await db.collection('dailySolves').doc(day).collection('entries').get();
  for (const doc of snap.docs) {
    solves += 1;
    const problem = doc.get('v') === NONOGRAM_VERSION ? check(doc.get('g'), puzzle) : 'made by another generator version';
    if (problem) flagged.push(`daily ${day} ${doc.id} (${doc.get('name')}): ${problem}`);
  }
}
console.log(`Checked ${solves} daily solves over ${days} days.`);

if (flagged.length > 0) console.log(`\n${flagged.length} to look at:\n  ${flagged.join('\n  ')}`);
await db.terminate();
