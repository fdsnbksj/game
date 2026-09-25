import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { LADDER_VERSION } from '../../src/sim/puzzle';

// The puzzle ladder: puzzles/{uid}_{LADDER_VERSION}. These mirror writeClear() in
// src/services/puzzles.ts.

let env: RulesTestEnvironment;

const asModular = (db: unknown) => db as Firestore;
const dbFor = (uid: string) => asModular(env.authenticatedContext(uid).firestore());
const hourAgo = () => Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
const ladder = (uid: string) => `${uid}_${LADDER_VERSION}`;

type Board = { u: string[]; c: number[]; s: number[]; it?: string[]; ia?: number[] };
const board = (units: [string, number][], cells?: number[]): Board => ({
  u: units.map(([id]) => id),
  c: cells ?? units.map((_, i) => i),
  s: units.map(([, star]) => star),
});
const good = board([['sparkmouse', 1], ['voltmoth', 2]]);

async function asAdmin(write: (db: Firestore) => Promise<unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await write(asModular(ctx.firestore()));
  });
}

async function seedPlayer(uid: string, displayName = 'Alice') {
  await asAdmin((db) => setDoc(doc(db, 'players', uid), { displayName, createdAt: hourAgo(), runsStarted: 0, lastRunStartAt: hourAgo() }));
}

/** A ladder already `level` levels up. */
async function seedLadder(uid: string, level: number, lastAt = hourAgo()) {
  const solutions = Object.fromEntries(Array.from({ length: level }, (_, i) => [`l${i + 1}`, good]));
  await asAdmin((db) =>
    setDoc(doc(db, 'puzzles', ladder(uid)), { uid, name: 'Alice', v: LADDER_VERSION, level, solutions, startedAt: hourAgo(), lastAt }),
  );
}

function start(db: Firestore, uid: string, overrides: Record<string, unknown> = {}, id = ladder(uid)) {
  return setDoc(doc(db, 'puzzles', id), {
    uid,
    name: 'Alice',
    v: LADDER_VERSION,
    level: 1,
    solutions: { l1: good },
    startedAt: serverTimestamp(),
    lastAt: serverTimestamp(),
    ...overrides,
  });
}

function clear(db: Firestore, uid: string, level: number, solution: unknown = good, overrides: Record<string, unknown> = {}) {
  return updateDoc(doc(db, 'puzzles', ladder(uid)), {
    level,
    [`solutions.l${level}`]: solution,
    name: 'Alice',
    lastAt: serverTimestamp(),
    ...overrides,
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-game',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await seedPlayer('alice');
});

describe('starting a puzzle ladder', () => {
  it('starts with the first clear', async () => {
    await assertSucceeds(start(dbFor('alice'), 'alice'));
  });

  it('rejects starting past level 1', async () => {
    await assertFails(start(dbFor('alice'), 'alice', { level: 5, solutions: { l5: good } }));
  });

  it("rejects another version's id, or someone else's", async () => {
    await assertFails(start(dbFor('alice'), 'alice', {}, `alice_${LADDER_VERSION - 1}`));
    await assertFails(start(dbFor('alice'), 'alice', { v: LADDER_VERSION - 1 }));
    await seedPlayer('bob', 'Bob');
    await assertFails(start(dbFor('alice'), 'bob', { name: 'Bob' }, ladder('bob')));
  });

  it("rejects a name that isn't the player's", async () => {
    await assertFails(start(dbFor('alice'), 'alice', { name: 'Someone famous' }));
  });

  it('rejects extra fields', async () => {
    await assertFails(start(dbFor('alice'), 'alice', { score: 99 }));
  });
});

describe('climbing the ladder', () => {
  beforeEach(() => seedLadder('alice', 3));

  it('accepts the next level', async () => {
    await assertSucceeds(clear(dbFor('alice'), 'alice', 4));
  });

  it('accepts a solution with items', async () => {
    await assertSucceeds(clear(dbFor('alice'), 'alice', 4, { ...good, it: ['heavy_plate'], ia: [1] }));
  });

  it('rejects skipping a level, or going back', async () => {
    await assertFails(clear(dbFor('alice'), 'alice', 5));
    await assertFails(clear(dbFor('alice'), 'alice', 3));
  });

  it('rejects a level without its solution', async () => {
    await assertFails(updateDoc(doc(dbFor('alice'), 'puzzles', ladder('alice')), { level: 4, name: 'Alice', lastAt: serverTimestamp() }));
  });

  it('rejects changing an earlier solution', async () => {
    await assertFails(clear(dbFor('alice'), 'alice', 4, good, { 'solutions.l2': board([['solaris', 3]]) }));
  });

  it('rejects malformed solutions', async () => {
    const db = dbFor('alice');
    await assertFails(clear(db, 'alice', 4, board([])));
    await assertFails(clear(db, 'alice', 4, board([['not_a_unit', 1]])));
    await assertFails(clear(db, 'alice', 4, board([['sparkmouse', 4]])));
    await assertFails(clear(db, 'alice', 4, board([['sparkmouse', 1], ['voltmoth', 1]], [3, 3])));
    await assertFails(clear(db, 'alice', 4, board([['sparkmouse', 1]], [28])));
    await assertFails(clear(db, 'alice', 4, board(Array.from({ length: 9 }, () => ['sparkmouse', 1] as [string, number]))));
    await assertFails(clear(db, 'alice', 4, { ...good, it: ['heavy_plate', 'razor_fang'], ia: [0, 0] }));
    await assertFails(clear(db, 'alice', 4, { ...good, extra: true }));
  });

  it('rejects clears faster than a fight can be played', async () => {
    await seedLadder('alice', 3, Timestamp.now());
    await assertFails(clear(dbFor('alice'), 'alice', 4));
  });

  it("rejects climbing someone else's ladder", async () => {
    await seedPlayer('mallory', 'Alice');
    await assertFails(clear(dbFor('mallory'), 'alice', 4));
  });

  it('takes a new name along after a rename', async () => {
    await asAdmin((db) => updateDoc(doc(db, 'players', 'alice'), { displayName: 'Ally' }));
    await assertFails(clear(dbFor('alice'), 'alice', 4));
    await assertSucceeds(clear(dbFor('alice'), 'alice', 4, good, { name: 'Ally' }));
  });

  it('lets signed-in players read ladders', async () => {
    await assertSucceeds(getDoc(doc(dbFor('bob'), 'puzzles', ladder('alice'))));
  });
});
