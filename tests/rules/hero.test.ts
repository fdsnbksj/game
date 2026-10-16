import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

// Mirrors the writes in src/services/hero.ts.

let env: RulesTestEnvironment;
const asModular = (db: unknown) => db as Firestore;
const dbFor = (uid: string) => asModular(env.authenticatedContext(uid).firestore());
const CODE = 'HERO';
const room = (db: Firestore) => doc(db, 'heroDuels', CODE);

async function admin(path: string[], data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(asModular(ctx.firestore()), path.join('/')), data);
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-game', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

describe('retired hero docs', () => {
  it('are closed, even to their owner', async () => {
    await admin(['heroes', 'ann'], { cleared: 3, resets: 0 });
    await assertFails(getDoc(doc(dbFor('ann'), 'heroes', 'ann')));
    await assertFails(setDoc(doc(dbFor('ann'), 'heroes', 'ann'), { cleared: 4, updatedAt: serverTimestamp() }));
  });
});

describe('hero rooms', () => {
  const open = { host: 'ann', playerIds: ['ann'], names: { ann: 'Ann' }, status: 'lobby', version: 12 };

  it('open with just the host', async () => {
    await assertSucceeds(setDoc(room(dbFor('ann')), { ...open, createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(dbFor('bob'), 'heroDuels', 'ABCD'), { ...open, createdAt: serverTimestamp() })); // as someone else
    await assertFails(setDoc(doc(dbFor('ann'), 'heroDuels', 'ABCE'), { ...open, fighters: { ann: {} }, createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(dbFor('ann'), 'heroDuels', 'abcd'), { ...open, createdAt: serverTimestamp() }));
    const { version: _, ...unversioned } = open;
    await assertFails(setDoc(doc(dbFor('ann'), 'heroDuels', 'ABCF'), { ...unversioned, createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(dbFor('ann'), 'heroDuels', 'ABCG'), { ...open, version: '12', createdAt: serverTimestamp() }));
  });

  it('take a second player, once', async () => {
    await admin(['heroDuels', CODE], open);
    await assertFails(updateDoc(room(dbFor('bob')), { playerIds: ['ann', 'bob'], names: { ann: 'Ann', bob: '' } }));
    await assertFails(updateDoc(room(dbFor('bob')), { playerIds: ['ann', 'bob'], names: { ann: 'Ann', bob: 'Bob' }, host: 'bob' }));
    await assertSucceeds(updateDoc(room(dbFor('bob')), { playerIds: ['ann', 'bob'], names: { ann: 'Ann', bob: 'Bob' } }));
    await assertFails(updateDoc(room(dbFor('eve')), { playerIds: ['ann', 'bob', 'eve'], names: { ann: 'Ann', bob: 'Bob', eve: 'Eve' } }));
  });

  it("can't be joined if made before every hero was the same", async () => {
    await admin(['heroDuels', CODE], { ...open, fighters: { ann: {} } });
    await assertFails(updateDoc(room(dbFor('bob')), { playerIds: ['ann', 'bob'], names: { ann: 'Ann', bob: 'Bob' } }));
  });

  it('start by the host with two players, and moves go in order', async () => {
    await admin(['heroDuels', CODE], { ...open, playerIds: ['ann', 'bob'], names: { ann: 'Ann', bob: 'Bob' } });
    await assertFails(updateDoc(room(dbFor('bob')), { status: 'playing', seed: 'abcdef12', startedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(room(dbFor('ann')), { status: 'playing', seed: 'abcdef12', startedAt: serverTimestamp() }));
    const move = (uid: string, n: number) => setDoc(doc(dbFor(uid), 'heroDuels', CODE, 'moves', String(n)), { n, by: uid, move: { skill: 'poker' } });
    await assertFails(move('ann', 1));
    await assertSucceeds(move('ann', 0));
    await assertSucceeds(move('bob', 1));
    await assertFails(move('eve', 2));
    await assertFails(getDoc(doc(dbFor('eve'), 'heroDuels', CODE, 'moves', '0')));
    await assertSucceeds(updateDoc(room(dbFor('bob')), { status: 'done', endedAt: serverTimestamp() }));
  });
});
