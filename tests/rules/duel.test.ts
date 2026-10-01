import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

// Mirrors the writes in src/services/duel.ts.

let env: RulesTestEnvironment;
const asModular = (db: unknown) => db as Firestore;
const dbFor = (uid: string) => asModular(env.authenticatedContext(uid).firestore());
const CODE = 'WXYZ';
const ref = (db: Firestore) => doc(db, 'duels', CODE);

async function seed(data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(ref(asModular(ctx.firestore())), { host: 'ann', names: { ann: 'Ann', bob: 'Bob' }, createdAt: serverTimestamp(), ...data });
  });
}

const move = (uid: string, n: number) => setDoc(doc(dbFor(uid), 'duels', CODE, 'moves', String(n)), { n, by: uid, move: { type: 'discard', slot: 0 } });

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-game', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

describe('duel rooms', () => {
  it('open with yourself as host', async () => {
    const room = { host: 'ann', playerIds: ['ann'], names: { ann: 'Ann' }, status: 'lobby', createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(ref(dbFor('ann')), room));
    await assertFails(setDoc(doc(dbFor('bob'), 'duels', 'ABCD'), room));
    await assertFails(setDoc(doc(dbFor('ann'), 'duels', 'ABCD'), { ...room, status: 'playing' }));
  });

  it('take one more player, who adds themselves', async () => {
    await seed({ playerIds: ['ann'], names: { ann: 'Ann' }, status: 'lobby' });
    await assertFails(updateDoc(ref(dbFor('bob')), { playerIds: ['ann', 'eve'], names: { ann: 'Ann', eve: 'Eve' } }));
    await assertSucceeds(updateDoc(ref(dbFor('bob')), { playerIds: ['ann', 'bob'], names: { ann: 'Ann', bob: 'Bob' } }));
    await assertFails(updateDoc(ref(dbFor('eve')), { playerIds: ['ann', 'bob', 'eve'], names: { ann: 'Ann', bob: 'Bob', eve: 'Eve' } }));
  });

  it('start only by the host, with two players and a seed', async () => {
    await seed({ playerIds: ['ann', 'bob'], status: 'lobby' });
    await assertFails(updateDoc(ref(dbFor('bob')), { status: 'playing', seed: 'abcdef12', startedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref(dbFor('ann')), { status: 'playing', seed: 'x', startedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref(dbFor('ann')), { status: 'playing', seed: 'abcdef12', startedAt: serverTimestamp() }));
  });

  it("won't start alone", async () => {
    await seed({ playerIds: ['ann'], status: 'lobby' });
    await assertFails(updateDoc(ref(dbFor('ann')), { status: 'playing', seed: 'abcdef12', startedAt: serverTimestamp() }));
  });
});

describe('duel moves', () => {
  beforeEach(() => seed({ playerIds: ['ann', 'bob'], status: 'playing', seed: 'abcdef12' }));

  it('are appended in order, each by its own player', async () => {
    await assertFails(move('ann', 1));
    await assertSucceeds(move('ann', 0));
    await assertFails(move('bob', 0));
    await assertSucceeds(move('bob', 1));
    await assertFails(move('ann', 3));
    await assertFails(setDoc(doc(dbFor('ann'), 'duels', CODE, 'moves', '2'), { n: 2, by: 'bob', move: {} }));
  });

  it('are private to the players', async () => {
    await assertSucceeds(move('ann', 0));
    await assertSucceeds(getDoc(doc(dbFor('bob'), 'duels', CODE, 'moves', '0')));
    await assertFails(getDoc(doc(dbFor('eve'), 'duels', CODE, 'moves', '0')));
    await assertFails(move('eve', 1));
  });

  it("can't be changed once written", async () => {
    await assertSucceeds(move('ann', 0));
    await assertFails(updateDoc(doc(dbFor('ann'), 'duels', CODE, 'moves', '0'), { move: { type: 'build', slot: 3 } }));
  });

  it('end by either player saying so', async () => {
    await assertFails(updateDoc(ref(dbFor('eve')), { status: 'done', endedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref(dbFor('bob')), { status: 'done', endedAt: serverTimestamp() }));
  });
});
