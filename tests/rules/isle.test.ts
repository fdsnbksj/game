import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

// Mirrors the writes in src/services/isle.ts.

let env: RulesTestEnvironment;
const asModular = (db: unknown) => db as Firestore;
const dbFor = (uid: string) => asModular(env.authenticatedContext(uid).firestore());
const CODE = 'QRST';
const ref = (db: Firestore) => doc(db, 'isles', CODE);
const NAMES = { ann: 'Ann', bob: 'Bob', cat: 'Cat', 'bot:1': 'Bot 1', 'bot:2': 'Bot 2' };

async function seed(data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(ref(asModular(ctx.firestore())), { host: 'ann', names: NAMES, createdAt: serverTimestamp(), ...data });
  });
}

const move = (uid: string, n: number, by = uid) =>
  setDoc(doc(dbFor(uid), 'isles', CODE, 'moves', String(n)), { n, by, move: { type: 'roll' } });

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-game', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

describe('isle rooms', () => {
  it('open with yourself as host, and nothing else', async () => {
    const room = { host: 'ann', seats: ['ann'], names: { ann: 'Ann' }, status: 'lobby', createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(ref(dbFor('ann')), room));
    await assertFails(setDoc(doc(dbFor('ann'), 'isles', 'ABCD'), { ...room, sides: 'A' }));
    await assertFails(setDoc(doc(dbFor('bob'), 'isles', 'ABCD'), room));
  });

  it('let people join and leave themselves, up to four seats', async () => {
    await seed({ seats: ['ann'], status: 'lobby' });
    await assertSucceeds(updateDoc(ref(dbFor('bob')), { seats: ['ann', 'bob'], names: { ...NAMES } }));
    await assertFails(updateDoc(ref(dbFor('cat')), { seats: ['ann', 'bob', 'dan'], names: { ...NAMES, dan: 'Dan' } }));
    await assertSucceeds(updateDoc(ref(dbFor('bob')), { seats: ['ann'] }));
    await seed({ seats: ['ann', 'b', 'c', 'd'], status: 'lobby' });
    await assertFails(updateDoc(ref(dbFor('cat')), { seats: ['ann', 'b', 'c', 'd', 'cat'], names: { ...NAMES } }));
  });

  it('let the host add, remove and seat bots, but not seat people', async () => {
    await seed({ seats: ['ann', 'bob'], status: 'lobby' });
    await assertSucceeds(updateDoc(ref(dbFor('ann')), { seats: ['ann', 'bot:1', 'bob'], names: { ...NAMES } }));
    await assertFails(updateDoc(ref(dbFor('bob')), { seats: ['ann', 'bob', 'bot:2'] }));
    await assertFails(updateDoc(ref(dbFor('ann')), { seats: ['ann', 'bot:1', 'bob', 'eve'] }));
    await assertFails(updateDoc(ref(dbFor('ann')), { seats: ['ann', 'bot:1'] }));
    await assertFails(updateDoc(ref(dbFor('ann')), { seats: ['ann', 'bot:1', 'bob', 'bot:2', 'bot:3'] }));
    await assertSucceeds(updateDoc(ref(dbFor('ann')), { seats: ['bob', 'ann'] }));
  });

  it('start only by the host, with three or four seats', async () => {
    await seed({ seats: ['ann', 'bob'], status: 'lobby' });
    await assertFails(updateDoc(ref(dbFor('ann')), { status: 'playing', seed: 'abcdef12', startedAt: serverTimestamp() }));
    await seed({ seats: ['ann', 'bob', 'bot:1'], status: 'lobby' });
    await assertFails(updateDoc(ref(dbFor('bob')), { status: 'playing', seed: 'abcdef12', startedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref(dbFor('ann')), { status: 'playing', seed: 'abcdef12', startedAt: serverTimestamp() }));
  });

  it('finish only by a player, once playing', async () => {
    await seed({ seats: ['ann', 'bob', 'bot:1'], status: 'playing', seed: 'abcdef12' });
    await assertFails(updateDoc(ref(dbFor('eve')), { status: 'done', endedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref(dbFor('bob')), { status: 'done', endedAt: serverTimestamp() }));
  });
});

describe('isle moves', () => {
  beforeEach(() => seed({ seats: ['ann', 'bob', 'bot:1'], status: 'playing', seed: 'abcdef12' }));

  it('are appended in order, each by its own player', async () => {
    await assertSucceeds(move('bob', 0));
    await assertFails(move('ann', 0));
    await assertFails(move('ann', 2));
    await assertSucceeds(move('ann', 1));
    await assertFails(move('ann', 2, 'bob'));
  });

  it("let only the host move for a bot that's seated", async () => {
    await assertFails(move('bob', 0, 'bot:1'));
    await assertSucceeds(move('ann', 0, 'bot:1'));
    await assertFails(move('ann', 1, 'bot:2'));
  });

  it('are private to the players', async () => {
    await assertSucceeds(move('ann', 0));
    await assertSucceeds(getDoc(doc(dbFor('bob'), 'isles', CODE, 'moves', '0')));
    await assertFails(getDoc(doc(dbFor('eve'), 'isles', CODE, 'moves', '0')));
  });
});
