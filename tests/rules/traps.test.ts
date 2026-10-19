import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

// Mirrors the writes in src/services/traps.ts.

let env: RulesTestEnvironment;
const asModular = (db: unknown) => db as Firestore;
const dbFor = (uid: string) => asModular(env.authenticatedContext(uid).firestore());
const CODE = 'TRAP';
const ref = (db: Firestore) => doc(db, 'traps', CODE);
const NAMES = { ann: 'Ann', bob: 'Bob', cat: 'Cat' };
const PICK = { type: 'pick', round: 0, index: 1 };

async function seed(data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(ref(asModular(ctx.firestore())), { host: 'ann', names: NAMES, version: 1, createdAt: serverTimestamp(), ...data });
  });
}

const move = (uid: string, n: number, m: Record<string, unknown> = PICK, by = uid) => setDoc(doc(dbFor(uid), 'traps', CODE, 'moves', String(n)), { n, by, move: m });

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-game', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

describe('trap tower rooms', () => {
  it('open with yourself as host and a version, and nothing else', async () => {
    const room = { host: 'ann', seats: ['ann'], names: { ann: 'Ann' }, status: 'lobby', version: 1, createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(ref(dbFor('ann')), room));
    await assertFails(setDoc(doc(dbFor('ann'), 'traps', 'ABCD'), { ...room, version: 'one' }));
    await assertFails(setDoc(doc(dbFor('ann'), 'traps', 'ABCD'), { ...room, seed: 'abcdef12' }));
    await assertFails(setDoc(doc(dbFor('bob'), 'traps', 'ABCD'), room));
  });

  it('let people join and leave themselves, up to four seats', async () => {
    await seed({ seats: ['ann'], status: 'lobby' });
    await assertSucceeds(updateDoc(ref(dbFor('bob')), { seats: ['ann', 'bob'], names: { ...NAMES } }));
    await assertFails(updateDoc(ref(dbFor('cat')), { seats: ['ann', 'bob', 'dan'], names: { ...NAMES, dan: 'Dan' } }));
    await assertSucceeds(updateDoc(ref(dbFor('bob')), { seats: ['ann'] }));
    await seed({ seats: ['ann', 'b', 'c', 'd'], status: 'lobby' });
    await assertFails(updateDoc(ref(dbFor('cat')), { seats: ['ann', 'b', 'c', 'd', 'cat'], names: { ...NAMES } }));
  });

  it('let the host reorder the seats, but not add bots or people', async () => {
    await seed({ seats: ['ann', 'bob'], status: 'lobby' });
    await assertSucceeds(updateDoc(ref(dbFor('ann')), { seats: ['bob', 'ann'] }));
    await assertFails(updateDoc(ref(dbFor('bob')), { seats: ['ann', 'bob'] }));
    await assertFails(updateDoc(ref(dbFor('ann')), { seats: ['bob', 'ann', 'bot:1'], names: { ...NAMES, 'bot:1': 'Bot 1' } }));
    await assertFails(updateDoc(ref(dbFor('ann')), { seats: ['ann'] }));
  });

  it('start only by the host, with two to four seats', async () => {
    await seed({ seats: ['ann'], status: 'lobby' });
    await assertFails(updateDoc(ref(dbFor('ann')), { status: 'playing', seed: 'abcdef12', startedAt: serverTimestamp() }));
    await seed({ seats: ['ann', 'bob'], status: 'lobby' });
    await assertFails(updateDoc(ref(dbFor('bob')), { status: 'playing', seed: 'abcdef12', startedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref(dbFor('ann')), { status: 'playing', seed: 'abcdef12', startedAt: serverTimestamp(), version: 2 }));
    await assertSucceeds(updateDoc(ref(dbFor('ann')), { status: 'playing', seed: 'abcdef12', startedAt: serverTimestamp() }));
  });

  it('finish only by a player, once playing', async () => {
    await seed({ seats: ['ann', 'bob'], status: 'playing', seed: 'abcdef12' });
    await assertFails(updateDoc(ref(dbFor('eve')), { status: 'done', endedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref(dbFor('bob')), { status: 'done', endedAt: serverTimestamp() }));
  });

  it('rematch by a player once done, following on exactly from the last move', async () => {
    await seed({ seats: ['ann', 'bob'], status: 'done', seed: 'abcdef12' });
    await env.withSecurityRulesDisabled(async (ctx) => {
      for (const n of [0, 1, 2]) await setDoc(doc(asModular(ctx.firestore()), 'traps', CODE, 'moves', String(n)), { n, by: 'ann', move: PICK });
    });
    const again = (uid: string, from: number, extra: Record<string, unknown> = {}) =>
      updateDoc(ref(dbFor(uid)), { status: 'playing', seed: 'ghijkl34', startedAt: serverTimestamp(), from, ...extra });
    await assertFails(again('eve', 3));
    await assertFails(again('bob', 2));
    await assertFails(again('bob', 4));
    await assertFails(again('bob', 3, { seed: 'abcdef12' }));
    await assertSucceeds(again('bob', 3));
    await assertSucceeds(move('ann', 3));
  });
});

describe('trap tower moves', () => {
  beforeEach(() => seed({ seats: ['ann', 'bob'], status: 'playing', seed: 'abcdef12' }));

  it('are appended in order, each by its own player', async () => {
    await assertSucceeds(move('bob', 0));
    await assertFails(move('ann', 0));
    await assertFails(move('ann', 2));
    await assertSucceeds(move('ann', 1, { type: 'place', round: 0, x: 3, y: 4, rot: 1 }));
    await assertFails(move('ann', 2, PICK, 'bob'));
    await assertFails(move('eve', 2));
  });

  it('are picks, places or runs, with a log of a sensible size', async () => {
    await assertSucceeds(move('ann', 0, { type: 'run', round: 0, log: '2a,6f,0z' }));
    await assertFails(move('ann', 1, { type: 'jump', round: 0 }));
    await assertFails(move('ann', 1, { type: 'pick', round: 0, index: 1, points: 99 }));
    await assertFails(move('ann', 1, { type: 'run', round: 0, log: 'x'.repeat(20001) }));
    await assertFails(move('ann', 1, { type: 'pick', round: '0', index: 1 }));
  });

  it('are private to the players', async () => {
    await assertSucceeds(move('ann', 0));
    await assertSucceeds(getDoc(doc(dbFor('bob'), 'traps', CODE, 'moves', '0')));
    await assertFails(getDoc(doc(dbFor('eve'), 'traps', CODE, 'moves', '0')));
  });
});
