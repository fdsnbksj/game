import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { aiOpponent } from '../src/sim/ai';
import { simulate, type Placed } from '../src/sim/combat';
import { lossDamage } from '../src/sim/economy';
import { START_HP } from '../src/sim/balance';
import { fromSnapshot, isLegalBoard, type BoardSnapshot } from '../src/sim/validate';

// Replays saved runs and reports any whose results couldn't have happened.
//
// The rules can't replay a fight, so a scripted client can claim wins it didn't earn. Every
// board records the opponent it fought and fights are deterministic, so a run can be replayed
// here and checked. Read-only: it writes nothing.
//
//   npm run audit                       # the emulator
//   gcloud auth application-default login
//   AUDIT_PROJECT_ID=<project-id> npm run audit -- --limit 200

const projectId = process.env.AUDIT_PROJECT_ID;
if (projectId === '') throw new Error('AUDIT_PROJECT_ID is set but empty');
if (!projectId) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.METADATA_SERVER_DETECTION ??= 'none';
}
const limitFlag = process.argv.indexOf('--limit');
const limit = limitFlag > 0 ? Number(process.argv[limitFlag + 1]) : 50;

const db = getFirestore(initializeApp({ projectId: projectId ?? 'demo-game' }));

interface RunDoc {
  uid: string;
  name: string;
  v: number;
  rand: number;
  round: number;
  hp: number;
  wins: number;
  boards: Record<string, BoardSnapshot>;
}

const ghosts = new Map<string, RunDoc | null>();

async function ghostBoard(ref: string, round: number): Promise<Placed[] | null> {
  const [runId] = ref.split(':');
  if (!ghosts.has(runId)) {
    const snap = await db.collection('runs').doc(runId).get();
    ghosts.set(runId, snap.exists ? (snap.data() as RunDoc) : null);
  }
  const board = ghosts.get(runId)?.boards[`r${round}`];
  return board ? fromSnapshot(board) : null;
}

/** Replays a run round by round. Returns what's wrong with it, if anything. */
async function audit(runId: string, run: RunDoc): Promise<string[]> {
  const problems: string[] = [];
  const seed = `${runId}:${run.rand}`;
  let hp = START_HP;
  let wins = 0;
  let unchecked = 0;

  for (let round = 1; round <= run.round; round++) {
    const board = run.boards[`r${round}`];
    if (!board) {
      problems.push(`round ${round}: no board saved`);
      continue;
    }
    if (!isLegalBoard(board, round)) problems.push(`round ${round}: board is not one a player could have had`);

    const opponent = board.o === 'ai' ? aiOpponent(`${seed}:opp${round}`, round).units : await ghostBoard(board.o, round);
    if (!opponent) {
      // The rival's run is gone, so this round can't be checked.
      unchecked += 1;
      continue;
    }
    const result = simulate(fromSnapshot(board), opponent, `${seed}:fight${round}`);
    if (result.winner === 'a') wins += 1;
    else hp = Math.max(0, hp - lossDamage(round, result.winner === 'draw' ? 0 : result.survivorStars));
  }

  if (unchecked === 0) {
    if (wins !== run.wins) problems.push(`claims ${run.wins} wins, replay gives ${wins}`);
    if (hp !== run.hp) problems.push(`claims ${run.hp} HP, replay gives ${hp}`);
  } else if (wins > run.wins || hp < run.hp) {
    // Some rounds couldn't be replayed, so only impossible directions are worth reporting.
    problems.push(`claims ${run.wins} wins and ${run.hp} HP; ${unchecked} rounds could not be replayed`);
  }
  return problems;
}

const snap = await db.collection('runs').orderBy('startedAt', 'desc').limit(limit).get();
let clean = 0;
const flagged: string[] = [];
for (const doc of snap.docs) {
  const run = doc.data() as RunDoc;
  const problems = await audit(doc.id, run);
  if (problems.length === 0) clean += 1;
  else flagged.push(`${doc.id} (${run.name}, v${run.v}): ${problems.join('; ')}`);
}

console.log(`Checked ${snap.size} runs from ${projectId ?? 'the emulator'}: ${clean} add up.`);
if (flagged.length > 0) console.log(`\n${flagged.length} to look at:\n  ${flagged.join('\n  ')}`);
await db.terminate();
