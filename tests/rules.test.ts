import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { CURRENT_SEASON, MAX_SCORE } from '../src/shared/constants';
import { DEFAULT_ITEM_IDS, DEFAULT_LOADOUT, ITEMS } from '../src/shared/items';

let env: RulesTestEnvironment;

// The test SDK returns compat Firestore instances; the modular functions unwrap them at runtime.
const asModular = (db: unknown) => db as Firestore;
const dbFor = (uid: string) => asModular(env.authenticatedContext(uid).firestore());
const hourAgo = () => Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);

async function asAdmin(write: (db: Firestore) => Promise<unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await write(asModular(ctx.firestore()));
  });
}

async function seedPlayer(
  uid: string,
  { bestScore = 0, lastRunAt = hourAgo(), inventory = DEFAULT_ITEM_IDS }: { bestScore?: number; lastRunAt?: Timestamp; inventory?: string[] } = {},
) {
  await asAdmin(async (db) => {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid), { displayName: 'Alice', bestScore, gamesPlayed: 3, createdAt: hourAgo(), lastRunAt });
    for (const itemId of inventory) batch.set(doc(db, 'users', uid, 'inventory', itemId), { unlockedAt: hourAgo() });
    batch.set(doc(db, 'users', uid, 'meta', 'loadout'), DEFAULT_LOADOUT);
    await batch.commit();
  });
}

/** Mirrors submitRun() in src/services/runs.ts. */
function submitRun(db: Firestore, uid: string, bestScore: number, entryScore = bestScore) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), { bestScore, gamesPlayed: increment(1), lastRunAt: serverTimestamp() });
  batch.set(doc(db, 'leaderboards', CURRENT_SEASON, 'entries', uid), {
    score: entryScore,
    displayName: 'Alice',
    loadout: DEFAULT_LOADOUT,
    submittedAt: serverTimestamp(),
  });
  return batch.commit();
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-game',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await asAdmin(async (db) => {
    const batch = writeBatch(db);
    for (const { id, ...item } of ITEMS) batch.set(doc(db, 'items', id), item);
    await batch.commit();
  });
});

describe('onboarding', () => {
  it('lets a new player create their profile, starter items and loadout in one batch', async () => {
    const db = dbFor('alice');
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', 'alice'), {
      displayName: 'Alice',
      bestScore: 0,
      gamesPlayed: 0,
      createdAt: serverTimestamp(),
      lastRunAt: serverTimestamp(),
    });
    for (const itemId of DEFAULT_ITEM_IDS) {
      batch.set(doc(db, 'users', 'alice', 'inventory', itemId), { unlockedAt: serverTimestamp() });
    }
    batch.set(doc(db, 'users', 'alice', 'meta', 'loadout'), DEFAULT_LOADOUT);
    await assertSucceeds(batch.commit());
  });

  it('rejects a new profile that starts with a score', async () => {
    const db = dbFor('alice');
    await assertFails(
      setDoc(doc(db, 'users', 'alice'), {
        displayName: 'Alice',
        bestScore: 500,
        gamesPlayed: 0,
        createdAt: serverTimestamp(),
        lastRunAt: serverTimestamp(),
      }),
    );
  });

  it("rejects writing another player's profile", async () => {
    await seedPlayer('alice');
    await assertFails(updateDoc(doc(dbFor('mallory'), 'users', 'alice'), { displayName: 'Hacked' }));
  });

  it('lets a player rename themselves', async () => {
    await seedPlayer('alice');
    await assertSucceeds(updateDoc(doc(dbFor('alice'), 'users', 'alice'), { displayName: 'Ally' }));
  });
});

describe('runs and leaderboard', () => {
  it('accepts a new best score with its leaderboard entry', async () => {
    await seedPlayer('alice', { bestScore: 10 });
    await assertSucceeds(submitRun(dbFor('alice'), 'alice', 25));
  });

  it('rejects a score above the maximum', async () => {
    await seedPlayer('alice');
    await assertFails(submitRun(dbFor('alice'), 'alice', MAX_SCORE + 1));
  });

  it('rejects lowering an existing leaderboard score', async () => {
    await seedPlayer('alice', { bestScore: 50 });
    await asAdmin((db) =>
      setDoc(doc(db, 'leaderboards', CURRENT_SEASON, 'entries', 'alice'), {
        score: 50,
        displayName: 'Alice',
        loadout: DEFAULT_LOADOUT,
        submittedAt: hourAgo(),
      }),
    );
    await assertFails(submitRun(dbFor('alice'), 'alice', 50, 40));
  });

  it('rejects runs submitted too soon after the previous one', async () => {
    await seedPlayer('alice', { lastRunAt: Timestamp.now() });
    await assertFails(submitRun(dbFor('alice'), 'alice', 25));
  });

  it('rejects a leaderboard entry without a run in the same batch', async () => {
    await seedPlayer('alice', { bestScore: 25 });
    await assertFails(
      setDoc(doc(dbFor('alice'), 'leaderboards', CURRENT_SEASON, 'entries', 'alice'), {
        score: 25,
        displayName: 'Alice',
        loadout: DEFAULT_LOADOUT,
        submittedAt: serverTimestamp(),
      }),
    );
  });

  it("rejects writing another player's leaderboard entry", async () => {
    await seedPlayer('alice');
    await assertFails(submitRun(dbFor('mallory'), 'alice', 25));
  });

  it('lets signed-in players read the leaderboard', async () => {
    await assertSucceeds(getDoc(doc(dbFor('bob'), 'leaderboards', CURRENT_SEASON, 'entries', 'alice')));
  });
});

describe('unlocks', () => {
  it('rejects unlocking an item the player has not earned', async () => {
    await seedPlayer('alice', { bestScore: 5 });
    await assertFails(setDoc(doc(dbFor('alice'), 'users', 'alice', 'inventory', 'acc_crown'), { unlockedAt: serverTimestamp() }));
  });

  it('allows unlocking an earned item', async () => {
    await seedPlayer('alice', { bestScore: 50 });
    await assertSucceeds(setDoc(doc(dbFor('alice'), 'users', 'alice', 'inventory', 'acc_crown'), { unlockedAt: serverTimestamp() }));
  });

  it('rejects unlocking an item that is not in the catalog', async () => {
    await seedPlayer('alice', { bestScore: 50 });
    await assertFails(setDoc(doc(dbFor('alice'), 'users', 'alice', 'inventory', 'free_money'), { unlockedAt: serverTimestamp() }));
  });
});

describe('loadout', () => {
  const withGlasses = [...DEFAULT_ITEM_IDS, 'acc_glasses'];

  it('allows equipping owned items', async () => {
    await seedPlayer('alice', { bestScore: 10, inventory: withGlasses });
    await assertSucceeds(setDoc(doc(dbFor('alice'), 'users', 'alice', 'meta', 'loadout'), { ...DEFAULT_LOADOUT, accessory: 'acc_glasses' }));
  });

  it('rejects equipping an item the player does not own', async () => {
    await seedPlayer('alice');
    await assertFails(setDoc(doc(dbFor('alice'), 'users', 'alice', 'meta', 'loadout'), { ...DEFAULT_LOADOUT, accessory: 'acc_crown' }));
  });

  it('rejects an item in the wrong slot', async () => {
    await seedPlayer('alice', { bestScore: 10, inventory: withGlasses });
    await assertFails(setDoc(doc(dbFor('alice'), 'users', 'alice', 'meta', 'loadout'), { ...DEFAULT_LOADOUT, hair: 'acc_glasses' }));
  });

  it('rejects out-of-range colors', async () => {
    await seedPlayer('alice');
    await assertFails(
      setDoc(doc(dbFor('alice'), 'users', 'alice', 'meta', 'loadout'), {
        ...DEFAULT_LOADOUT,
        colors: { ...DEFAULT_LOADOUT.colors, skin: -1 },
      }),
    );
  });
});

describe('catalog', () => {
  it('rejects client writes to items', async () => {
    await assertFails(
      setDoc(doc(dbFor('alice'), 'items', 'acc_crown'), { slot: 'accessory', name: 'Crown', rarity: 'epic', unlockScore: 0, spriteKey: 'acc_crown' }),
    );
  });
});
