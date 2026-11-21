import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

// Mirrors the writes in src/services/pigs.ts.

let env: RulesTestEnvironment;
const asModular = (db: unknown) => db as Firestore;
const dbFor = (uid: string) => asModular(env.authenticatedContext(uid).firestore());
const CODE = 'PIGS';
const room = (db: Firestore) => doc(db, 'pigs', CODE);

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

const open = { host: 'ann', playerIds: ['ann'], names: { ann: 'Ann' }, status: 'lobby', version: 1, game: 0 };
const two = { ...open, playerIds: ['ann', 'bob'], names: { ann: 'Ann', bob: 'Bob' } };
const ago = (ms: number) => Timestamp.fromMillis(Date.now() - ms);
const toss = (uid: string, n: number, t: number, extra: Record<string, unknown> = {}) =>
  setDoc(doc(dbFor(uid), 'pigs', CODE, 'moves', String(n)), { n, by: uid, move: { t, ...extra } });

describe('pig rooms', () => {
  it('open with just the host', async () => {
    await assertSucceeds(setDoc(room(dbFor('ann')), { ...open, createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(dbFor('bob'), 'pigs', 'ABCD'), { ...open, createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(dbFor('ann'), 'pigs', 'ABCE'), { ...open, game: 3, createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(dbFor('ann'), 'pigs', 'abcd'), { ...open, createdAt: serverTimestamp() }));
  });

  it('take a second player, once, who may leave before the start', async () => {
    await admin(['pigs', CODE], open);
    await assertFails(updateDoc(room(dbFor('bob')), { playerIds: ['ann', 'bob'], names: { ann: 'Ann', bob: 'Bob' }, host: 'bob' }));
    await assertSucceeds(updateDoc(room(dbFor('bob')), { playerIds: ['ann', 'bob'], names: { ann: 'Ann', bob: 'Bob' } }));
    await assertFails(updateDoc(room(dbFor('eve')), { playerIds: ['ann', 'bob', 'eve'], names: { ann: 'Ann', bob: 'Bob', eve: 'Eve' } }));
    await assertFails(updateDoc(room(dbFor('ann')), { playerIds: ['bob'] })); // the host stays
    await assertSucceeds(updateDoc(room(dbFor('bob')), { playerIds: ['ann'] }));
  });

  it('start by the host with two players', async () => {
    await admin(['pigs', CODE], two);
    await assertFails(updateDoc(room(dbFor('bob')), { status: 'playing', seed: 'abcdef12', startedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(room(dbFor('ann')), { status: 'playing', seed: 'abcdef12', startedAt: serverTimestamp() }));
    await assertFails(getDoc(doc(dbFor('eve'), 'pigs', CODE, 'moves', '0')));
  });

  it('take throws in order, from the players, near the server’s clock', async () => {
    // 23 s since the start: 20 s into the pen, tick 1200.
    await admin(['pigs', CODE], { ...two, status: 'playing', seed: 'abcdef12', startedAt: ago(23_000) });
    await assertFails(toss('ann', 1, 1200)); // out of order
    await assertFails(toss('ann', 0, 1500)); // 5 s ahead
    await assertFails(toss('ann', 0, 500)); // 11 s behind
    await assertFails(toss('ann', 0, 1200, { x: 1 }));
    await assertFails(setDoc(doc(dbFor('ann'), 'pigs', CODE, 'moves', '0'), { n: 0, by: 'bob', move: { t: 1200 } }));
    await assertSucceeds(toss('ann', 0, 1200));
    await assertFails(toss('bob', 0, 1190)); // taken
    await assertSucceeds(toss('bob', 1, 1190));
    await assertFails(toss('eve', 2, 1200));
  });

  it('refuse throws after the minute', async () => {
    await admin(['pigs', CODE], { ...two, status: 'playing', seed: 'abcdef12', startedAt: ago(64_000) });
    await assertFails(toss('ann', 0, 3600));
    await assertSucceeds(toss('ann', 0, 3590));
  });

  it('end once the minute is up, and play again with the moves following on', async () => {
    await admin(['pigs', CODE], { ...two, status: 'playing', seed: 'abcdef12', startedAt: ago(30_000) });
    await assertFails(updateDoc(room(dbFor('bob')), { status: 'done', endedAt: serverTimestamp() })); // too soon
    await admin(['pigs', CODE], { ...two, status: 'playing', seed: 'abcdef12', startedAt: ago(64_000) });
    await assertFails(updateDoc(room(dbFor('eve')), { status: 'done', endedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(room(dbFor('bob')), { status: 'done', endedAt: serverTimestamp() }));

    const again = (uid: string, data: Record<string, unknown>) => updateDoc(room(dbFor(uid)), { status: 'playing', seed: 'zyxwvu98', startedAt: serverTimestamp(), from: 0, game: 1, ...data });
    // A game with no throws: the next starts at 0 too.
    await assertFails(again('eve', {}));
    await assertFails(again('bob', { game: 2 }));
    await assertFails(again('bob', { from: 1 }));
    await assertFails(again('bob', { seed: 'abcdef12' }));
    await assertSucceeds(again('bob', {}));
    await assertFails(again('ann', {})); // only once

    await admin(['pigs', CODE], { ...two, status: 'done', seed: 'zyxwvu98', startedAt: ago(90_000), from: 0, game: 1 });
    await admin(['pigs', CODE, 'moves', '0'], { n: 0, by: 'ann', move: { t: 5 } });
    await admin(['pigs', CODE, 'moves', '1'], { n: 1, by: 'bob', move: { t: 9 } });
    await assertFails(again('ann', { game: 2, from: 1 }));
    await assertFails(again('ann', { game: 2, from: 0 }));
    await assertSucceeds(again('ann', { game: 2, from: 2, seed: 'qwerty77' }));
  });
});
