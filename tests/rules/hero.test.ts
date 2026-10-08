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
const hero = (db: Firestore, uid: string) => doc(db, 'heroes', uid);

const tree = (change: Record<string, number> = {}) => ({ stopwatch: 1, roulette: 0, poker: 0, hp: 0, def: 0, crit: 0, critDmg: 0, ...change });

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

describe('heroes', () => {
  it('are made by their owner, from no more than one level', async () => {
    await assertSucceeds(setDoc(hero(dbFor('ann'), 'ann'), { cleared: 1, tree: tree({ hp: 1 }), updatedAt: serverTimestamp() }));
    await assertFails(setDoc(hero(dbFor('bob'), 'eve'), { cleared: 0, tree: tree(), updatedAt: serverTimestamp() }));
    await assertFails(setDoc(hero(dbFor('bob'), 'bob'), { cleared: 2, tree: tree(), updatedAt: serverTimestamp() }));
  });

  it('are private', async () => {
    await admin(['heroes', 'ann'], { cleared: 0, tree: tree() });
    await assertSucceeds(getDoc(hero(dbFor('ann'), 'ann')));
    await assertFails(getDoc(hero(dbFor('bob'), 'ann')));
  });

  it('clear one level a write and never go back', async () => {
    await admin(['heroes', 'ann'], { cleared: 4, tree: tree() });
    await assertFails(setDoc(hero(dbFor('ann'), 'ann'), { cleared: 6, tree: tree(), updatedAt: serverTimestamp() }));
    await assertFails(setDoc(hero(dbFor('ann'), 'ann'), { cleared: 3, tree: tree(), updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(hero(dbFor('ann'), 'ann'), { cleared: 5, tree: tree(), updatedAt: serverTimestamp() }));
  });

  it("can't spend more points than their levels give", async () => {
    await admin(['heroes', 'ann'], { cleared: 4, tree: tree() });
    // Level 5 is a boss: 5 + 2 = 7 points.
    await assertSucceeds(setDoc(hero(dbFor('ann'), 'ann'), { cleared: 5, tree: tree({ stopwatch: 3, hp: 5 }), updatedAt: serverTimestamp() }));
    await assertFails(setDoc(hero(dbFor('ann'), 'ann'), { cleared: 5, tree: tree({ stopwatch: 3, hp: 6 }), updatedAt: serverTimestamp() }));
    await assertFails(setDoc(hero(dbFor('ann'), 'ann'), { cleared: 5, tree: tree({ stopwatch: 0, hp: 1 }), updatedAt: serverTimestamp() }));
    await assertFails(setDoc(hero(dbFor('ann'), 'ann'), { cleared: 5, tree: tree({ hp: 11 }), updatedAt: serverTimestamp() }));
    await assertFails(setDoc(hero(dbFor('ann'), 'ann'), { cleared: 5, tree: { ...tree(), wings: 1 }, updatedAt: serverTimestamp() }));
  });
});

describe('hero rooms', () => {
  beforeEach(async () => {
    await admin(['heroes', 'ann'], { cleared: 3, tree: tree({ hp: 3 }) });
    await admin(['heroes', 'bob'], { cleared: 1, tree: tree({ def: 1 }) });
  });

  const open = { host: 'ann', playerIds: ['ann'], names: { ann: 'Ann' }, fighters: { ann: tree({ hp: 3 }) }, status: 'lobby' };

  it('open with the host bringing their own hero', async () => {
    await assertSucceeds(setDoc(room(dbFor('ann')), { ...open, createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(dbFor('ann'), 'heroDuels', 'ABCD'), { ...open, fighters: { ann: tree({ hp: 4 }) }, createdAt: serverTimestamp() }));
  });

  it('take a second player with their own hero', async () => {
    await admin(['heroDuels', CODE], open);
    const join = { playerIds: ['ann', 'bob'], names: { ann: 'Ann', bob: 'Bob' } };
    await assertFails(updateDoc(room(dbFor('bob')), { ...join, fighters: { ann: tree({ hp: 3 }), bob: tree({ def: 10 }) } }));
    await assertFails(updateDoc(room(dbFor('bob')), { ...join, fighters: { ann: tree(), bob: tree({ def: 1 }) } }));
    await assertSucceeds(updateDoc(room(dbFor('bob')), { ...join, fighters: { ann: tree({ hp: 3 }), bob: tree({ def: 1 }) } }));
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
