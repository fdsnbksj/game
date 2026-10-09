import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

// Mirrors the writes in src/services/arena.ts.

let env: RulesTestEnvironment;
const asModular = (db: unknown) => db as Firestore;
const dbFor = (uid: string) => asModular(env.authenticatedContext(uid).firestore());
const arena = (db: Firestore, uid: string) => doc(db, 'arena', uid);

const tree = (change: Record<string, number> = {}) => ({ stopwatch: 1, speed: 0, poker: 0, roulette: 0, hp: 0, def: 0, crit: 0, critDmg: 0, ...change });
const ANN = tree({ stopwatch: 3, hp: 2 });
const KIT = ['stopwatch'];

async function admin(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(asModular(ctx.firestore()), path), data);
  });
}

const join = (uid: string, change: Record<string, unknown> = {}) =>
  setDoc(arena(dbFor(uid), uid), { name: 'Ann', tree: ANN, loadout: KIT, rating: 1000, wins: 0, losses: 0, lastFightAt: serverTimestamp(), ...change });

/** A standing whose last fight was long enough ago. */
const settled = (change: Record<string, unknown> = {}) =>
  admin('arena/ann', { name: 'Ann', tree: ANN, loadout: KIT, rating: 1000, wins: 3, losses: 2, lastFightAt: Timestamp.fromMillis(Date.now() - 60_000), ...change });

const result = (rating: number, wins: number, losses: number) =>
  updateDoc(arena(dbFor('ann'), 'ann'), { rating, wins, losses, lastFightAt: serverTimestamp() });

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-game', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await admin('players/ann', { displayName: 'Ann' });
  await admin('heroes/ann', { cleared: 5, tree: ANN, resets: 0, loadout: KIT });
});

describe('joining the arena', () => {
  it('opens once the first boss is beaten, with your own hero and name', async () => {
    await assertSucceeds(join('ann'));
  });

  it('stays shut before level 5', async () => {
    await admin('heroes/ann', { cleared: 4, tree: ANN, resets: 0, loadout: KIT });
    await assertFails(join('ann'));
  });

  it("won't take a made-up hero, name or start", async () => {
    await assertFails(join('ann', { tree: tree({ hp: 10 }) }));
    await assertFails(join('ann', { loadout: ['poker'] }));
    await assertFails(join('ann', { name: 'Champion' }));
    await assertFails(join('ann', { rating: 2000 }));
    await assertFails(join('ann', { wins: 9 }));
    await assertFails(setDoc(arena(dbFor('bob'), 'ann'), { name: 'Ann', tree: ANN, loadout: KIT, rating: 1000, wins: 0, losses: 0, lastFightAt: serverTimestamp() }));
  });

  it('is open for anyone signed in to read, and for no one else to write', async () => {
    await settled();
    await assertSucceeds(getDoc(arena(dbFor('bob'), 'ann')));
    await assertFails(getDoc(arena(asModular(env.unauthenticatedContext().firestore()), 'ann')));
    await assertFails(updateDoc(arena(dbFor('bob'), 'ann'), { rating: 1, wins: 3, losses: 3, lastFightAt: serverTimestamp() }));
  });
});

describe('arena results', () => {
  beforeEach(() => settled());

  it('count a win as 5 to 35 points up and one more win', async () => {
    await assertSucceeds(result(1020, 4, 2));
  });

  it('count a loss as 5 to 35 points down and one more loss', async () => {
    await assertSucceeds(result(980, 3, 3));
  });

  it('refuse too much, the wrong direction, or two counts at once', async () => {
    await assertFails(result(1036, 4, 2));
    await assertFails(result(1002, 4, 2));
    await assertFails(result(1020, 3, 3));
    await assertFails(result(1020, 5, 2));
    await assertFails(result(1020, 4, 3));
  });

  it('wait 10 seconds between results', async () => {
    await settled({ lastFightAt: Timestamp.fromMillis(Date.now() - 2_000) });
    await assertFails(result(1020, 4, 2));
  });
});

describe('the arena hero', () => {
  beforeEach(() => settled());

  it('follows your hero and your name', async () => {
    const grown = tree({ stopwatch: 3, hp: 2, def: 1 });
    await admin('heroes/ann', { cleared: 6, tree: grown, resets: 0, loadout: ['stopwatch'] });
    await assertFails(updateDoc(arena(dbFor('ann'), 'ann'), { tree: tree({ hp: 9 }) }));
    await assertFails(updateDoc(arena(dbFor('ann'), 'ann'), { tree: grown, loadout: ['speed'], name: 'Ann' }));
    await assertSucceeds(updateDoc(arena(dbFor('ann'), 'ann'), { tree: grown, loadout: ['stopwatch'], name: 'Ann' }));
    await assertFails(updateDoc(arena(dbFor('ann'), 'ann'), { name: 'Bob' }));
  });

  it("can't change its rating along with its tree", async () => {
    await assertFails(updateDoc(arena(dbFor('ann'), 'ann'), { tree: ANN, rating: 1500 }));
  });
});
