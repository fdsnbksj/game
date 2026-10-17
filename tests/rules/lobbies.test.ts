import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

// Mirrors src/services/lobbies.ts: every party game's lobby takes a heartbeat from its
// players, and a lobby nobody has been in for 10 minutes may be deleted by anyone.

let env: RulesTestEnvironment;
const asModular = (db: unknown) => db as Firestore;
const dbFor = (uid: string) => asModular(env.authenticatedContext(uid).firestore());
const CODE = 'LOBY';

async function admin(path: string, code: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(asModular(ctx.firestore()), path, code), data);
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-game', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const ago = (minutes: number) => Timestamp.fromMillis(Date.now() - minutes * 60_000);

const GAMES = [
  { path: 'rooms', room: { host: 'ann', playerIds: ['ann', 'bob'], names: { ann: 'Ann', bob: 'Bob' }, optional: [], lady: false } },
  { path: 'heroDuels', room: { host: 'ann', playerIds: ['ann', 'bob'], names: { ann: 'Ann', bob: 'Bob' }, version: 13 } },
  { path: 'wonders', room: { host: 'ann', seats: ['ann', 'bob'], names: { ann: 'Ann', bob: 'Bob' }, sides: 'A' } },
  { path: 'isles', room: { host: 'ann', seats: ['ann', 'bob'], names: { ann: 'Ann', bob: 'Bob' } } },
  { path: 'bluffs', room: { host: 'ann', seats: ['ann', 'bob'], names: { ann: 'Ann', bob: 'Bob' } } },
];

for (const { path, room } of GAMES) {
  describe(`${path} lobbies`, () => {
    const ref = (uid: string) => doc(dbFor(uid), path, CODE);

    it('take a heartbeat from their players only, and only while waiting', async () => {
      await admin(path, CODE, { ...room, status: 'lobby', createdAt: ago(1) });
      await assertSucceeds(updateDoc(ref('bob'), { seenAt: serverTimestamp() }));
      await assertFails(updateDoc(ref('eve'), { seenAt: serverTimestamp() }));
      await assertFails(updateDoc(ref('bob'), { seenAt: ago(0) }));
      await assertFails(updateDoc(ref('bob'), { seenAt: serverTimestamp(), host: 'bob' }));
      await admin(path, CODE, { ...room, status: 'playing', createdAt: ago(1) });
      await assertFails(updateDoc(ref('bob'), { seenAt: serverTimestamp() }));
    });

    it('may be deleted by anyone once nobody has been in for 10 minutes', async () => {
      await admin(path, CODE, { ...room, status: 'lobby', createdAt: ago(60), seenAt: ago(2) });
      await assertFails(deleteDoc(ref('eve')));
      await admin(path, CODE, { ...room, status: 'lobby', createdAt: ago(60), seenAt: ago(11) });
      await assertSucceeds(deleteDoc(ref('eve')));
      // Before its first heartbeat, by when it was made.
      await admin(path, CODE, { ...room, status: 'lobby', createdAt: ago(3) });
      await assertFails(deleteDoc(ref('eve')));
      await admin(path, CODE, { ...room, status: 'lobby', createdAt: ago(11) });
      await assertSucceeds(deleteDoc(ref('eve')));
    });

    it('are kept once the game is under way or over, however long ago', async () => {
      for (const status of ['playing', 'done']) {
        await admin(path, CODE, { ...room, status, createdAt: ago(600), seenAt: ago(600) });
        await assertFails(deleteDoc(ref('ann')));
      }
    });

    it('can be listed while waiting', async () => {
      await admin(path, CODE, { ...room, status: 'lobby', createdAt: ago(1) });
      await assertSucceeds(getDocs(query(collection(dbFor('eve'), path), where('status', '==', 'lobby'))));
    });
  });
}
