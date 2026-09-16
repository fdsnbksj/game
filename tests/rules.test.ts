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
import { MAX_RUNS_PER_SAVE, MAX_SCORE } from '../src/shared/constants';
import { DEFAULT_ITEM_IDS, DEFAULT_LOADOUT, ITEMS } from '../src/shared/items';

const TODAY = '2026-09-16';
const YESTERDAY = '2026-09-15';

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

interface SeedOptions {
  bestScore?: number;
  dailyId?: string;
  dailyScore?: number;
  gamesPlayed?: number;
  lastRunAt?: Timestamp;
  inventory?: string[];
}

async function seedPlayer(uid: string, options: SeedOptions = {}) {
  const {
    bestScore = 0,
    dailyId = TODAY,
    dailyScore = 0,
    gamesPlayed = 3,
    lastRunAt = hourAgo(),
    inventory = DEFAULT_ITEM_IDS,
  } = options;
  await asAdmin(async (db) => {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid), {
      displayName: 'Alice',
      bestScore,
      gamesPlayed,
      createdAt: hourAgo(),
      lastRunAt,
      dailyId,
      dailyScore,
    });
    for (const itemId of inventory) batch.set(doc(db, 'users', uid, 'inventory', itemId), { unlockedAt: hourAgo() });
    batch.set(doc(db, 'users', uid, 'meta', 'loadout'), DEFAULT_LOADOUT);
    await batch.commit();
  });
}

interface RunOptions {
  day?: string;
  entryDay?: string;
  entryScore?: number;
  bestScore?: number;
  runs?: number;
}

/** Mirrors submitRun() in src/services/runs.ts. */
function submitRun(db: Firestore, uid: string, score: number, options: RunOptions = {}) {
  const { day = TODAY, entryDay = day, entryScore = score, bestScore = score, runs = 1 } = options;
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), {
    bestScore,
    dailyId: day,
    dailyScore: score,
    gamesPlayed: increment(runs),
    lastRunAt: serverTimestamp(),
  });
  batch.set(doc(db, 'leaderboards', entryDay, 'entries', uid), {
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
      dailyId: TODAY,
      dailyScore: 0,
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
        dailyId: TODAY,
        dailyScore: 0,
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

describe('runs and the daily leaderboard', () => {
  it("accepts a new daily best with today's leaderboard entry", async () => {
    await seedPlayer('alice', { bestScore: 10, dailyScore: 4 });
    await assertSucceeds(submitRun(dbFor('alice'), 'alice', 7, { bestScore: 10 }));
  });

  it('accepts several attempts counted in one save', async () => {
    await seedPlayer('alice', { dailyScore: 2 });
    await assertSucceeds(submitRun(dbFor('alice'), 'alice', 9, { runs: MAX_RUNS_PER_SAVE }));
  });

  it('rejects counting more attempts than the cap', async () => {
    await seedPlayer('alice', { dailyScore: 2 });
    await assertFails(submitRun(dbFor('alice'), 'alice', 9, { runs: MAX_RUNS_PER_SAVE + 1 }));
  });

  it('accepts a save from a profile created before daily scores existed', async () => {
    await asAdmin(async (db) => {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', 'legacy'), {
        // Same name the submitRun helper writes on the entry; the rules require them to match.
        displayName: 'Alice',
        bestScore: 32,
        gamesPlayed: 3,
        createdAt: hourAgo(),
        lastRunAt: hourAgo(),
      });
      for (const itemId of DEFAULT_ITEM_IDS) {
        batch.set(doc(db, 'users', 'legacy', 'inventory', itemId), { unlockedAt: hourAgo() });
      }
      batch.set(doc(db, 'users', 'legacy', 'meta', 'loadout'), DEFAULT_LOADOUT);
      await batch.commit();
    });
    await assertSucceeds(submitRun(dbFor('legacy'), 'legacy', 4, { bestScore: 32 }));
  });

  it('rejects a score above the maximum', async () => {
    await seedPlayer('alice');
    await assertFails(submitRun(dbFor('alice'), 'alice', MAX_SCORE + 1));
  });

  it('rejects a daily score that does not beat the stored one', async () => {
    await seedPlayer('alice', { bestScore: 20, dailyScore: 12 });
    await assertFails(submitRun(dbFor('alice'), 'alice', 12, { bestScore: 20 }));
  });

  it('lets a new day start below the all-time best', async () => {
    await seedPlayer('alice', { bestScore: 40, dailyId: YESTERDAY, dailyScore: 40 });
    await assertSucceeds(submitRun(dbFor('alice'), 'alice', 3, { bestScore: 40 }));
  });

  it('rejects lowering the all-time best', async () => {
    await seedPlayer('alice', { bestScore: 40, dailyScore: 5 });
    await assertFails(submitRun(dbFor('alice'), 'alice', 9, { bestScore: 9 }));
  });

  it('rejects an entry on a different day than the run', async () => {
    await seedPlayer('alice', { dailyId: YESTERDAY });
    await assertFails(submitRun(dbFor('alice'), 'alice', 9, { day: TODAY, entryDay: YESTERDAY }));
  });

  it('rejects an entry score that differs from the saved daily score', async () => {
    await seedPlayer('alice');
    await assertFails(submitRun(dbFor('alice'), 'alice', 9, { entryScore: 40, bestScore: 40 }));
  });

  it('rejects runs saved too soon after the previous one', async () => {
    await seedPlayer('alice', { lastRunAt: Timestamp.now() });
    await assertFails(submitRun(dbFor('alice'), 'alice', 9));
  });

  it('rejects a leaderboard entry without a run in the same batch', async () => {
    await seedPlayer('alice', { bestScore: 9, dailyScore: 9 });
    await assertFails(
      setDoc(doc(dbFor('alice'), 'leaderboards', TODAY, 'entries', 'alice'), {
        score: 9,
        displayName: 'Alice',
        loadout: DEFAULT_LOADOUT,
        submittedAt: serverTimestamp(),
      }),
    );
  });

  it("rejects writing another player's leaderboard entry", async () => {
    await seedPlayer('alice');
    await assertFails(submitRun(dbFor('mallory'), 'alice', 9));
  });

  it('lets signed-in players read the leaderboard', async () => {
    await assertSucceeds(getDoc(doc(dbFor('bob'), 'leaderboards', TODAY, 'entries', 'alice')));
  });
});

describe('unlocks', () => {
  it('rejects unlocking an item the player has not earned', async () => {
    await seedPlayer('alice', { bestScore: 5 });
    await assertFails(setDoc(doc(dbFor('alice'), 'users', 'alice', 'inventory', 'hat_crown'), { unlockedAt: serverTimestamp() }));
  });

  it('allows unlocking an earned item', async () => {
    await seedPlayer('alice', { bestScore: 50 });
    await assertSucceeds(setDoc(doc(dbFor('alice'), 'users', 'alice', 'inventory', 'hat_crown'), { unlockedAt: serverTimestamp() }));
  });

  it('rejects unlocking an item that is not in the catalog', async () => {
    await seedPlayer('alice', { bestScore: 50 });
    await assertFails(setDoc(doc(dbFor('alice'), 'users', 'alice', 'inventory', 'free_money'), { unlockedAt: serverTimestamp() }));
  });
});

describe('loadout', () => {
  const withSparks = [...DEFAULT_ITEM_IDS, 'trail_spark'];

  it('allows equipping owned items', async () => {
    await seedPlayer('alice', { bestScore: 12, inventory: withSparks });
    await assertSucceeds(
      setDoc(doc(dbFor('alice'), 'users', 'alice', 'meta', 'loadout'), { ...DEFAULT_LOADOUT, trail: 'trail_spark' }),
    );
  });

  it('rejects equipping an item the player does not own', async () => {
    await seedPlayer('alice');
    await assertFails(
      setDoc(doc(dbFor('alice'), 'users', 'alice', 'meta', 'loadout'), { ...DEFAULT_LOADOUT, hat: 'hat_crown' }),
    );
  });

  it('rejects an item in the wrong slot', async () => {
    await seedPlayer('alice', { bestScore: 12, inventory: withSparks });
    await assertFails(
      setDoc(doc(dbFor('alice'), 'users', 'alice', 'meta', 'loadout'), { ...DEFAULT_LOADOUT, hat: 'trail_spark' }),
    );
  });

  it('rejects out-of-range colors', async () => {
    await seedPlayer('alice');
    await assertFails(
      setDoc(doc(dbFor('alice'), 'users', 'alice', 'meta', 'loadout'), {
        ...DEFAULT_LOADOUT,
        colors: { ...DEFAULT_LOADOUT.colors, body: -1 },
      }),
    );
  });
});

describe('catalog', () => {
  it('rejects client writes to items', async () => {
    await assertFails(
      setDoc(doc(dbFor('alice'), 'items', 'hat_crown'), {
        slot: 'hat',
        name: 'Crown',
        rarity: 'epic',
        unlockScore: 0,
        spriteKey: 'hat_crown',
      }),
    );
  });
});
