import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

// Mirrors the writes in src/services/brawl.ts.

let env: RulesTestEnvironment;
const asModular = (db: unknown) => db as Firestore;
const dbFor = (uid: string) => asModular(env.authenticatedContext(uid).firestore());
const CODE = 'WXYZ';
const ref = (db: Firestore) => doc(db, 'brawls', CODE);
const signal = (db: Firestore, id: string) => doc(db, 'brawls', CODE, 'signals', id);
const sdp = { sdp: 'v=0 fake', at: serverTimestamp() };

async function seed(data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(ref(asModular(ctx.firestore())), {
      host: 'ann',
      playerIds: ['ann', 'bob'],
      names: { ann: 'Ann', bob: 'Bob' },
      createdAt: serverTimestamp(),
      ...data,
    });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-game', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

describe('brawl rooms', () => {
  it('open with yourself as host', async () => {
    const room = { host: 'ann', playerIds: ['ann'], names: { ann: 'Ann' }, status: 'lobby', createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(ref(dbFor('ann')), room));
    await assertFails(setDoc(doc(dbFor('bob'), 'brawls', 'ABCD'), room));
    await assertFails(setDoc(doc(dbFor('ann'), 'brawls', 'ABCD'), { ...room, fighters: { ann: 'knight' } }));
    await assertFails(setDoc(doc(dbFor('ann'), 'brawls', 'ABCD'), { ...room, status: 'playing' }));
  });

  it('take one more player, who adds only themselves', async () => {
    await seed({ playerIds: ['ann'], names: { ann: 'Ann' }, status: 'lobby' });
    await assertFails(updateDoc(ref(dbFor('bob')), { playerIds: ['ann', 'eve'], names: { ann: 'Ann', eve: 'Eve' } }));
    await assertSucceeds(updateDoc(ref(dbFor('bob')), { playerIds: ['ann', 'bob'], names: { ann: 'Ann', bob: 'Bob' } }));
    await assertFails(updateDoc(ref(dbFor('eve')), { playerIds: ['ann', 'bob', 'eve'], names: { ann: 'Ann', bob: 'Bob', eve: 'Eve' } }));
  });

  it('change nothing else in the lobby', async () => {
    await seed({ status: 'lobby' });
    await assertFails(updateDoc(ref(dbFor('bob')), { 'fighters.bob': 'lancer' }));
    await assertFails(updateDoc(ref(dbFor('bob')), { host: 'bob' }));
  });

  it('start only by the host, with two players', async () => {
    await seed({ status: 'lobby' });
    await assertFails(updateDoc(ref(dbFor('bob')), { status: 'playing', seed: 'abcdef', startedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref(dbFor('ann')), { status: 'playing', seed: 'abcdef', startedAt: serverTimestamp() }));
    await seed({ status: 'lobby', playerIds: ['ann'] });
    await assertFails(updateDoc(ref(dbFor('ann')), { status: 'playing', seed: 'abcdef', startedAt: serverTimestamp() }));
  });

  it('start with the host\'s rules, and only sensible ones', async () => {
    const start = (rules: unknown) => updateDoc(ref(dbFor('ann')), { status: 'playing', seed: 'abcdef', startedAt: serverTimestamp(), rules });
    await seed({ status: 'lobby' });
    await assertSucceeds(start({ mode: 'timed', value: 4 }));
    for (const bad of [{ mode: 'timed', value: 9 }, { mode: 'score', value: 4 }, { mode: 'deathmatch', value: 3 }, { mode: 'score', value: 5, extra: 1 }, 'score']) {
      await seed({ status: 'lobby' });
      await assertFails(start(bad));
    }
    await seed({ status: 'lobby' });
    await assertSucceeds(start({ mode: 'score', value: 7 }));
  });

  it('finish by either player', async () => {
    await seed({ status: 'playing', seed: 'abcdef' });
    await assertFails(updateDoc(ref(dbFor('eve')), { status: 'done', endedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref(dbFor('bob')), { status: 'done', endedAt: serverTimestamp() }));
  });
});

describe('brawl handshakes', () => {
  it('take an offer from the host and an answer from the guest, once each', async () => {
    await seed({ status: 'playing', seed: 'abcdef' });
    await assertFails(setDoc(signal(dbFor('bob'), 'offer'), sdp));
    await assertFails(setDoc(signal(dbFor('bob'), 'answer'), sdp));
    await assertSucceeds(setDoc(signal(dbFor('ann'), 'offer'), sdp));
    await assertFails(setDoc(signal(dbFor('ann'), 'offer'), sdp));
    await assertFails(setDoc(signal(dbFor('ann'), 'answer'), sdp));
    await assertSucceeds(setDoc(signal(dbFor('bob'), 'answer'), sdp));
    await assertFails(setDoc(signal(dbFor('bob'), 'answer'), sdp));
  });

  it('allow a numbered retry, and nothing else', async () => {
    await seed({ status: 'playing', seed: 'abcdef' });
    await assertSucceeds(setDoc(signal(dbFor('ann'), 'offer-1'), sdp));
    await assertFails(setDoc(signal(dbFor('bob'), 'answer-2'), sdp));
    await assertSucceeds(setDoc(signal(dbFor('bob'), 'answer-1'), sdp));
    await assertFails(setDoc(signal(dbFor('ann'), 'offer-10'), sdp));
    await assertFails(setDoc(signal(dbFor('ann'), 'chat'), sdp));
    await assertFails(setDoc(signal(dbFor('ann'), 'offer-3'), { sdp: 'x'.repeat(20001), at: serverTimestamp() }));
    await assertFails(setDoc(signal(dbFor('ann'), 'offer-3'), { sdp: 'v=0', at: serverTimestamp(), extra: 1 }));
  });

  it('are read only by the two players, and only while the fight is on', async () => {
    await seed({ status: 'playing', seed: 'abcdef' });
    await setDoc(signal(dbFor('ann'), 'offer'), sdp);
    await assertSucceeds(getDoc(signal(dbFor('bob'), 'offer')));
    await assertFails(getDoc(signal(dbFor('eve'), 'offer')));
    await seed({ status: 'lobby' });
    await assertFails(setDoc(signal(dbFor('ann'), 'offer-1'), sdp));
  });
});
