import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { nonogram, NONOGRAM_VERSION } from '../src/nonogram/generate';

// Sets a player's ladder to a level, as an admin: for moving a player on (or back) by
// hand. Each level up to it is filed with its real answer, so `npm run audit` still finds
// the ladder clean. The player's app picks the level up the next time it's online
// (catchUp() in src/nonogramStore.ts) and carries on from the level after.
//
// Finds the player by their display name, and stops unless exactly one matches.
// Nothing is written without --write.
//
//   npm run set-level -- --name Player3408 --level 38              # the emulator, preview
//   PROJECT_ID=<project-id> npm run set-level -- --name Player3408 --level 38 --write

const projectId = process.env.PROJECT_ID;
if (projectId === '') throw new Error('PROJECT_ID is set but empty');
if (!projectId) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.METADATA_SERVER_DETECTION ??= 'none';
}

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const name = arg('--name');
const level = Number(arg('--level'));
const write = process.argv.includes('--write');
if (!name || !Number.isInteger(level) || level < 1) {
  throw new Error('Usage: set-level -- --name <display name> --level <highest level solved> [--write]');
}

const db = getFirestore(initializeApp({ projectId: projectId ?? 'demo-game' }));
const where = projectId ?? 'the emulator';

const players = await db.collection('players').where('displayName', '==', name).get();
if (players.size !== 1) {
  console.log(`${players.size} players are called "${name}" on ${where}; need exactly one. Nothing written.`);
  for (const p of players.docs) console.log(`  ${p.id}`);
  process.exit(1);
}
const uid = players.docs[0].id;
const ref = db.collection('ladders').doc(`${uid}_${NONOGRAM_VERSION}`);
const before = await ref.get();

// As src/services/solves.ts packs them (that module needs the browser's Firebase).
const packGrid = (cells: readonly number[]) => cells.map((cell) => (cell === 1 ? '1' : '0')).join('');
const solutions = Object.fromEntries(
  Array.from({ length: level }, (_, i) => [`l${i + 1}`, packGrid(nonogram(i + 1).solution)]),
);

console.log(`${name} (${uid}) on ${where}: ladder v${NONOGRAM_VERSION} at level ${before.get('level') ?? 'none'} → ${level}.`);
console.log(`Their app will then open on level ${level + 1}.`);
if (!write) {
  console.log('Preview only. Add --write to save it.');
  process.exit(0);
}

await ref.set({
  uid,
  name,
  v: NONOGRAM_VERSION,
  level,
  solutions,
  startedAt: before.get('startedAt') ?? FieldValue.serverTimestamp(),
  lastAt: FieldValue.serverTimestamp(),
});
console.log('Saved.');
await db.terminate();
