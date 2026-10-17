import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { dayId } from '../../src/shared/constants';

// Neon Flap's data stays in the database, but the game that wrote it is gone: nothing may
// write it, and the only thing still read is a player's own old profile, for their name.

let env: RulesTestEnvironment;
const asModular = (db: unknown) => db as Firestore;
const dbFor = (uid: string) => asModular(env.authenticatedContext(uid).firestore());

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-game',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = asModular(ctx.firestore());
    await setDoc(doc(db, 'users', 'alice'), { displayName: 'Alice', bestScore: 12, gamesPlayed: 3 });
    await setDoc(doc(db, 'users', 'alice', 'inventory', 'hat_cap'), { unlockedAt: serverTimestamp() });
    await setDoc(doc(db, 'users', 'alice', 'meta', 'loadout'), { body: 'body_round' });
    await setDoc(doc(db, 'leaderboards', dayId(), 'entries', 'alice'), { score: 12, displayName: 'Alice' });
    await setDoc(doc(db, 'items', 'hat_cap'), { slot: 'hat', unlockScore: 5 });
  });
});

describe('retired Neon Flap data', () => {
  it('lets a player read their own old profile, for their name', async () => {
    await assertSucceeds(getDoc(doc(dbFor('alice'), 'users', 'alice')));
  });

  it("keeps other players' old profiles private", async () => {
    await assertFails(getDoc(doc(dbFor('bob'), 'users', 'alice')));
  });

  it('rejects creating, changing or deleting an old profile', async () => {
    const db = dbFor('alice');
    await assertFails(setDoc(doc(db, 'users', 'carol'), { displayName: 'Carol', bestScore: 0, gamesPlayed: 0 }));
    await assertFails(updateDoc(doc(db, 'users', 'alice'), { displayName: 'Ally' }));
    await assertFails(deleteDoc(doc(db, 'users', 'alice')));
  });

  it('closes inventories and loadouts', async () => {
    const db = dbFor('alice');
    await assertFails(getDoc(doc(db, 'users', 'alice', 'inventory', 'hat_cap')));
    await assertFails(setDoc(doc(db, 'users', 'alice', 'inventory', 'hat_crown'), { unlockedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, 'users', 'alice', 'meta', 'loadout'), { body: 'body_chunky' }));
  });

  it('closes the old leaderboards and item catalog', async () => {
    const db = dbFor('alice');
    await assertFails(getDoc(doc(db, 'leaderboards', dayId(), 'entries', 'alice')));
    await assertFails(setDoc(doc(db, 'leaderboards', dayId(), 'entries', 'alice'), { score: 999, displayName: 'Alice' }));
    await assertFails(getDoc(doc(db, 'items', 'hat_cap')));
    await assertFails(setDoc(doc(db, 'items', 'hat_cap'), { slot: 'hat', unlockScore: 0 }));
  });
});

// Hero Gambit's Summon (wardrobes) and arena were removed; their data stays, closed.
describe('retired Hero Gambit wardrobes and arena', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = asModular(ctx.firestore());
      await setDoc(doc(db, 'wardrobes', 'alice'), { gems: 900, owned: [], pity: 0 });
      await setDoc(doc(db, 'arena', 'alice'), { name: 'Alice', rating: 1000, wins: 0, losses: 0 });
    });
  });

  it('closes them to their owner too', async () => {
    const db = dbFor('alice');
    await assertFails(getDoc(doc(db, 'wardrobes', 'alice')));
    await assertFails(setDoc(doc(db, 'wardrobes', 'alice'), { gems: 99999, owned: [], pity: 0 }));
    await assertFails(getDoc(doc(db, 'arena', 'alice')));
    await assertFails(updateDoc(doc(db, 'arena', 'alice'), { rating: 1035, wins: 1 }));
  });
});

// Stick Brawl was removed; its rooms and handshakes stay, closed.
describe('retired Stick Brawl rooms', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = asModular(ctx.firestore());
      await setDoc(doc(db, 'brawls', 'ABCD'), { host: 'alice', playerIds: ['alice'], names: { alice: 'Alice' }, status: 'lobby' });
      await setDoc(doc(db, 'brawls', 'ABCD', 'signals', 'offer'), { sdp: 'v=0' });
    });
  });

  it('closes them to their players too', async () => {
    const db = dbFor('alice');
    await assertFails(getDoc(doc(db, 'brawls', 'ABCD')));
    await assertFails(setDoc(doc(db, 'brawls', 'WXYZ'), { host: 'alice', playerIds: ['alice'], names: { alice: 'Alice' }, status: 'lobby', createdAt: serverTimestamp() }));
    await assertFails(getDoc(doc(db, 'brawls', 'ABCD', 'signals', 'offer')));
    await assertFails(deleteDoc(doc(db, 'brawls', 'ABCD')));
  });
});

// Rival Wonders was removed; its rooms and moves stay, closed.
describe('retired Rival Wonders rooms', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = asModular(ctx.firestore());
      await setDoc(doc(db, 'duels', 'ABCD'), { host: 'alice', playerIds: ['alice', 'bob'], names: { alice: 'Alice', bob: 'Bob' }, status: 'playing', seed: 'seed123' });
      await setDoc(doc(db, 'duels', 'ABCD', 'moves', '0'), { n: 0, by: 'alice', move: { type: 'discard', slot: 0 } });
    });
  });

  it('closes them to their players too', async () => {
    const db = dbFor('alice');
    await assertFails(getDoc(doc(db, 'duels', 'ABCD')));
    await assertFails(setDoc(doc(db, 'duels', 'WXYZ'), { host: 'alice', playerIds: ['alice'], names: { alice: 'Alice' }, status: 'lobby', createdAt: serverTimestamp() }));
    await assertFails(getDoc(doc(db, 'duels', 'ABCD', 'moves', '0')));
    await assertFails(setDoc(doc(db, 'duels', 'ABCD', 'moves', '1'), { n: 1, by: 'alice', move: {} }));
    await assertFails(deleteDoc(doc(db, 'duels', 'ABCD')));
  });
});
