import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

// Mirrors the writes in src/services/pass.ts.

let env: RulesTestEnvironment;
const asModular = (db: unknown) => db as Firestore;
const dbFor = (uid: string) => asModular(env.authenticatedContext(uid).firestore());
const CODE = 'PASS';
const ref = (db: Firestore) => doc(db, 'passes', CODE);
const NAMES = { ann: 'Ann', bob: 'Bob', cat: 'Cat' };

async function seed(data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(ref(asModular(ctx.firestore())), { host: 'ann', names: NAMES, version: 1, createdAt: serverTimestamp(), ...data });
  });
}

const move = (uid: string, n: number, by = uid) => setDoc(doc(dbFor(uid), 'passes', CODE, 'moves', String(n)), { n, by, move: { type: 'pay' } });

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-game', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

describe('pass rooms', () => {
  it('open with yourself as host and the version, and nothing else', async () => {
    const room = { host: 'ann', seats: ['ann'], names: { ann: 'Ann' }, status: 'lobby', version: 1, createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(ref(dbFor('ann')), room));
    const { version: _, ...noVersion } = room;
    await assertFails(setDoc(doc(dbFor('ann'), 'passes', 'ABCD'), noVersion));
    await assertFails(setDoc(doc(dbFor('ann'), 'passes', 'ABCE'), { ...room, version: '1' }));
    await assertFails(setDoc(doc(dbFor('ann'), 'passes', 'ABCF'), { ...room, seats: ['ann', 'bot:1'] }));
    await assertFails(setDoc(doc(dbFor('bob'), 'passes', 'ABCG'), room));
  });

  it('let people join and leave themselves, up to six seats', async () => {
    await seed({ seats: ['ann'], status: 'lobby' });
    await assertSucceeds(updateDoc(ref(dbFor('bob')), { seats: ['ann', 'bob'], names: { ...NAMES } }));
    await assertFails(updateDoc(ref(dbFor('cat')), { seats: ['ann', 'bob', 'dan'], names: { ...NAMES, dan: 'Dan' } }));
    await assertFails(updateDoc(ref(dbFor('cat')), { seats: ['ann', 'bob', 'cat'], names: { ...NAMES }, version: 2 }));
    await assertSucceeds(updateDoc(ref(dbFor('bob')), { seats: ['ann'] }));
    await assertFails(updateDoc(ref(dbFor('ann')), { seats: [] }));
    await seed({ seats: ['ann', 'b', 'c', 'd', 'e', 'f'], status: 'lobby' });
    await assertFails(updateDoc(ref(dbFor('cat')), { seats: ['ann', 'b', 'c', 'd', 'e', 'f', 'cat'], names: { ...NAMES } }));
    await seed({ seats: ['ann', 'bob'], status: 'playing', seed: 'abcdef12' });
    await assertFails(updateDoc(ref(dbFor('cat')), { seats: ['ann', 'bob', 'cat'], names: { ...NAMES } }));
  });

  it('let the host change the seating, but no one else, and not who sits', async () => {
    await seed({ seats: ['ann', 'bob', 'cat'], status: 'lobby' });
    await assertFails(updateDoc(ref(dbFor('bob')), { seats: ['bob', 'ann', 'cat'] }));
    await assertFails(updateDoc(ref(dbFor('ann')), { seats: ['ann', 'bob', 'eve'] }));
    await assertFails(updateDoc(ref(dbFor('ann')), { seats: ['ann', 'bob'] }));
    await assertSucceeds(updateDoc(ref(dbFor('ann')), { seats: ['cat', 'ann', 'bob'] }));
  });

  it('let the host add, remove and seat bots, up to six seats, but not people', async () => {
    await seed({ seats: ['ann', 'bob'], status: 'lobby' });
    const bots = { ...NAMES, 'bot:1': 'Bot 1', 'bot:2': 'Bot 2' };
    await assertFails(updateDoc(ref(dbFor('bob')), { seats: ['ann', 'bob', 'bot:1'], names: bots }));
    await assertFails(updateDoc(ref(dbFor('ann')), { seats: ['ann', 'bob', 'bot:7'], names: { ...NAMES, 'bot:7': 'Bot 7' } }));
    await assertFails(updateDoc(ref(dbFor('ann')), { seats: ['ann', 'bob', 'bot:1', 'bot:1'], names: bots }));
    await assertSucceeds(updateDoc(ref(dbFor('ann')), { seats: ['ann', 'bot:1', 'bob', 'bot:2'], names: bots }));
    await assertFails(updateDoc(ref(dbFor('ann')), { seats: ['ann', 'bot:1', 'bot:2'], names: bots }));
    await assertSucceeds(updateDoc(ref(dbFor('ann')), { seats: ['ann', 'bob', 'bot:2'], names: bots }));
    await assertFails(updateDoc(ref(dbFor('ann')), { seats: ['ann', 'bob', 'bot:2', 'bot:3', 'bot:4', 'bot:5', 'bot:6'], names: bots }));
    await assertSucceeds(updateDoc(ref(dbFor('ann')), { seats: ['ann', 'bob', 'bot:2', 'bot:3', 'bot:4', 'bot:5'], names: bots }));
    await assertFails(updateDoc(ref(dbFor('cat')), { seats: ['ann', 'bob', 'bot:2', 'bot:3', 'bot:4', 'bot:5', 'cat'], names: { ...bots } }));
  });

  it('start only by the host, with two to six seats', async () => {
    await seed({ seats: ['ann'], status: 'lobby' });
    await assertFails(updateDoc(ref(dbFor('ann')), { status: 'playing', seed: 'abcdef12', startedAt: serverTimestamp() }));
    await seed({ seats: ['ann', 'bob'], status: 'lobby' });
    await assertFails(updateDoc(ref(dbFor('bob')), { status: 'playing', seed: 'abcdef12', startedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref(dbFor('ann')), { status: 'playing', seed: 'abc', startedAt: serverTimestamp() }));
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
      for (const n of [0, 1, 2]) await setDoc(doc(asModular(ctx.firestore()), 'passes', CODE, 'moves', String(n)), { n, by: 'ann', move: { type: 'pay' } });
    });
    const past = [{ seed: 'abcdef12', from: 0 }];
    const again = (uid: string, from: number, extra: Record<string, unknown> = {}) =>
      updateDoc(ref(dbFor(uid)), { status: 'playing', seed: 'ghijkl34', startedAt: serverTimestamp(), from, past, ...extra });
    await assertFails(again('eve', 3));
    await assertFails(again('bob', 2));
    await assertFails(again('bob', 4));
    await assertFails(again('bob', 3, { seed: 'abcdef12' }));
    await assertFails(again('bob', 3, { seats: ['ann'] }));
    // The game just over goes onto `past`, exactly.
    await assertFails(again('bob', 3, { past: [] }));
    await assertFails(again('bob', 3, { past: [{ seed: 'abcdef12', from: 1 }] }));
    await assertFails(again('bob', 3, { past: [{ seed: 'other123', from: 0 }] }));
    await assertFails(updateDoc(ref(dbFor('bob')), { status: 'playing', seed: 'ghijkl34', startedAt: serverTimestamp(), from: 3 }));
    await assertSucceeds(again('bob', 3));
    await assertFails(again('ann', 3, { seed: 'mnopqr56' }));
    await assertSucceeds(move('ann', 3));
  });

  it('rematch again adds the next game to the room history, keeping the earlier ones', async () => {
    const past = [{ seed: 'aaaaaa11', from: 0 }];
    await seed({ seats: ['ann', 'bob'], status: 'done', seed: 'bbbbbb22', from: 2, past });
    await env.withSecurityRulesDisabled(async (ctx) => {
      for (const n of [0, 1, 2, 3]) await setDoc(doc(asModular(ctx.firestore()), 'passes', CODE, 'moves', String(n)), { n, by: 'ann', move: { type: 'pay' } });
    });
    const again = (next: unknown[]) => updateDoc(ref(dbFor('ann')), { status: 'playing', seed: 'cccccc33', startedAt: serverTimestamp(), from: 4, past: next });
    await assertFails(again([{ seed: 'bbbbbb22', from: 2 }]));
    await assertFails(again([...past, { seed: 'bbbbbb22', from: 2 }, { seed: 'xxxxxx99', from: 3 }]));
    await assertSucceeds(again([...past, { seed: 'bbbbbb22', from: 2 }]));
  });
});

describe('pass moves', () => {
  beforeEach(() => seed({ seats: ['ann', 'bob'], status: 'playing', seed: 'abcdef12' }));

  it('are appended in order, each by its own player', async () => {
    await assertSucceeds(move('bob', 0));
    await assertFails(move('ann', 0));
    await assertFails(move('ann', 2));
    await assertSucceeds(move('ann', 1));
    await assertFails(move('ann', 2, 'bob'));
    await assertFails(move('eve', 2));
  });

  it("by a bot that's seated, written only by the host", async () => {
    await seed({ seats: ['ann', 'bob', 'bot:1'], status: 'playing', seed: 'abcdef12' });
    await assertFails(move('bob', 0, 'bot:1'));
    await assertSucceeds(move('ann', 0, 'bot:1'));
    await assertFails(move('ann', 1, 'bot:2'));
    await assertSucceeds(move('bob', 1));
  });

  it('only while playing', async () => {
    await seed({ seats: ['ann', 'bob'], status: 'lobby' });
    await assertFails(move('ann', 0));
  });

  it('are private to the players', async () => {
    await assertSucceeds(move('ann', 0));
    await assertSucceeds(getDoc(doc(dbFor('bob'), 'passes', CODE, 'moves', '0')));
    await assertFails(getDoc(doc(dbFor('eve'), 'passes', CODE, 'moves', '0')));
  });
});
