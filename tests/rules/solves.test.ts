import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { dayId } from '../../src/shared/constants';
import { NONOGRAM_VERSION, sizeFor } from '../../src/nonogram/generate';

// Mirrors the writes in src/services/players.ts and src/services/solves.ts.

let env: RulesTestEnvironment;
const asModular = (db: unknown) => db as Firestore;
const dbFor = (uid: string) => asModular(env.authenticatedContext(uid).firestore());
const hourAgo = () => Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
const TODAY = dayId();

/** Any grid of the right size; the rules check shape, the audit checks answers. */
const grid = (size: number) => '1'.repeat(size * size);
const ladderId = (uid: string) => `${uid}_${NONOGRAM_VERSION}`;

async function asAdmin(write: (db: Firestore) => Promise<unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await write(asModular(ctx.firestore()));
  });
}

const seedPlayer = (uid: string) => asAdmin((db) => setDoc(doc(db, 'players', uid), { displayName: 'Alice', createdAt: hourAgo() }));

async function seedLadder(uid: string, level: number, lastAt = hourAgo()) {
  const solutions = Object.fromEntries(Array.from({ length: level }, (_, i) => [`l${i + 1}`, grid(sizeFor(i + 1))]));
  await asAdmin((db) =>
    setDoc(doc(db, 'ladders', ladderId(uid)), { uid, name: 'Alice', v: NONOGRAM_VERSION, level, solutions, startedAt: hourAgo(), lastAt }),
  );
}

const firstLevel = (uid: string, extra: Record<string, unknown> = {}) => ({
  uid,
  name: 'Alice',
  v: NONOGRAM_VERSION,
  level: 1,
  solutions: { l1: grid(sizeFor(1)) },
  startedAt: serverTimestamp(),
  lastAt: serverTimestamp(),
  ...extra,
});

const nextLevel = (level: number, extra: Record<string, unknown> = {}) => ({
  level,
  [`solutions.l${level}`]: grid(sizeFor(level)),
  name: 'Alice',
  lastAt: serverTimestamp(),
  ...extra,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-game',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(() => env.cleanup());

beforeEach(() => env.clearFirestore());

describe('players', () => {
  it('lets a player create their own profile', async () => {
    await assertSucceeds(setDoc(doc(dbFor('alice'), 'players', 'alice'), { displayName: 'Alice', createdAt: serverTimestamp() }));
  });

  it("rejects someone else's profile, extra fields or a bad name", async () => {
    const db = dbFor('alice');
    await assertFails(setDoc(doc(db, 'players', 'bob'), { displayName: 'Bob', createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, 'players', 'alice'), { displayName: 'Alice', createdAt: serverTimestamp(), level: 99 }));
    await assertFails(setDoc(doc(db, 'players', 'alice'), { displayName: '', createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, 'players', 'alice'), { displayName: 'x'.repeat(21), createdAt: serverTimestamp() }));
  });

  it('allows a rename and nothing else', async () => {
    await seedPlayer('alice');
    const db = dbFor('alice');
    await assertSucceeds(updateDoc(doc(db, 'players', 'alice'), { displayName: 'Ally' }));
    await assertFails(updateDoc(doc(db, 'players', 'alice'), { createdAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(dbFor('bob'), 'players', 'alice'), { displayName: 'Bob' }));
  });

  it('still lets an auto-battler player rename', async () => {
    await asAdmin((db) => setDoc(doc(db, 'players', 'alice'), { displayName: 'Alice', createdAt: hourAgo(), runsStarted: 3, lastRunStartAt: hourAgo() }));
    await assertSucceeds(updateDoc(doc(dbFor('alice'), 'players', 'alice'), { displayName: 'Ally' }));
  });

  it("keeps profiles private", async () => {
    await seedPlayer('alice');
    await assertSucceeds(getDoc(doc(dbFor('alice'), 'players', 'alice')));
    await assertFails(getDoc(doc(dbFor('bob'), 'players', 'alice')));
  });
});

describe('the ladder', () => {
  beforeEach(() => seedPlayer('alice'));

  it('starts with level 1', async () => {
    await assertSucceeds(setDoc(doc(dbFor('alice'), 'ladders', ladderId('alice')), firstLevel('alice')));
  });

  it('rejects a start that skips ahead, is the wrong size or someone else', async () => {
    const db = dbFor('alice');
    const ref = doc(db, 'ladders', ladderId('alice'));
    await assertFails(setDoc(ref, firstLevel('alice', { level: 2 })));
    await assertFails(setDoc(ref, firstLevel('alice', { solutions: { l1: grid(sizeFor(1) + 1) } })));
    await assertFails(setDoc(ref, firstLevel('alice', { solutions: { l1: '2'.repeat(25) } })));
    await assertFails(setDoc(ref, firstLevel('alice', { name: 'Someone' })));
    await assertFails(setDoc(ref, firstLevel('alice', { v: NONOGRAM_VERSION + 1 })));
    await assertFails(setDoc(doc(db, 'ladders', ladderId('bob')), firstLevel('bob')));
    await assertFails(setDoc(doc(db, 'ladders', 'alice_0'), firstLevel('alice')));
  });

  it('adds one level at a time, at its size', async () => {
    await seedLadder('alice', 3);
    const ref = doc(dbFor('alice'), 'ladders', ladderId('alice'));
    await assertFails(updateDoc(ref, nextLevel(5)));
    await assertFails(updateDoc(ref, nextLevel(4, { 'solutions.l4': grid(sizeFor(4) + 1) })));
    await assertSucceeds(updateDoc(ref, nextLevel(4)));
  });

  it('grows the grid with the level', async () => {
    await seedLadder('alice', 38);
    await assertSucceeds(updateDoc(doc(dbFor('alice'), 'ladders', ladderId('alice')), nextLevel(39)));
  });

  it('refuses to change a level already saved', async () => {
    await seedLadder('alice', 3);
    const ref = doc(dbFor('alice'), 'ladders', ladderId('alice'));
    await assertFails(updateDoc(ref, nextLevel(4, { 'solutions.l2': '0'.repeat(25) })));
  });

  it('spaces levels at least 3 s apart', async () => {
    await seedLadder('alice', 3, Timestamp.now());
    await assertFails(updateDoc(doc(dbFor('alice'), 'ladders', ladderId('alice')), nextLevel(4)));
  });

  it("rejects writing someone else's ladder, and deleting", async () => {
    await seedLadder('alice', 3);
    await seedPlayer('bob');
    await assertFails(updateDoc(doc(dbFor('bob'), 'ladders', ladderId('alice')), nextLevel(4)));
    await assertFails(deleteDoc(doc(dbFor('alice'), 'ladders', ladderId('alice'))));
  });

  it('is readable by anyone signed in', async () => {
    await seedLadder('alice', 3);
    await assertSucceeds(getDoc(doc(dbFor('bob'), 'ladders', ladderId('alice'))));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'ladders', ladderId('alice'))));
  });
});

describe("removed games' data, and the removed daily puzzle", () => {
  beforeEach(() =>
    asAdmin(async (db) => {
      await setDoc(doc(db, 'runs', 'alice_0'), { uid: 'alice', round: 3 });
      await setDoc(doc(db, 'puzzles', 'alice_1004'), { uid: 'alice', level: 3 });
      await setDoc(doc(db, 'rankings', TODAY, 'entries', 'alice'), { score: 3000 });
      await setDoc(doc(db, 'dailyRankings', TODAY, 'entries', 'alice'), { score: 3000 });
      await setDoc(doc(db, 'dailySolves', TODAY, 'entries', 'alice'), { name: 'Alice', v: NONOGRAM_VERSION, g: '1'.repeat(100) });
    }),
  );

  it('is closed to reads and writes', async () => {
    const db = dbFor('alice');
    for (const path of [['runs', 'alice_0'], ['puzzles', 'alice_1004'], ['rankings', TODAY, 'entries', 'alice'], ['dailyRankings', TODAY, 'entries', 'alice'], ['dailySolves', TODAY, 'entries', 'alice']]) {
      const [first, ...rest] = path;
      await assertFails(getDoc(doc(db, first, ...rest)));
      await assertFails(setDoc(doc(db, first, ...rest), { uid: 'alice' }));
    }
  });
});
