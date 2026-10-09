import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

// Mirrors the writes in src/services/hero.ts.

let env: RulesTestEnvironment;
const asModular = (db: unknown) => db as Firestore;
const dbFor = (uid: string) => asModular(env.authenticatedContext(uid).firestore());
const CODE = 'HERO';
const room = (db: Firestore) => doc(db, 'heroDuels', CODE);
const hero = (db: Firestore, uid: string) => doc(db, 'heroes', uid);

const tree = (change: Record<string, number> = {}) => ({ stopwatch: 1, speed: 0, poker: 0, roulette: 0, hp: 0, def: 0, crit: 0, critDmg: 0, ...change });
/** A hero doc as the app writes it. */
const heroDoc = (cleared: number, t: Record<string, unknown> = tree(), change: Record<string, unknown> = {}) => ({ cleared, tree: t, resets: 0, loadout: ['stopwatch'], updatedAt: serverTimestamp(), ...change });
/** As it's stored (for admin writes). */
const stored = (cleared: number, t = tree(), change: Record<string, unknown> = {}) => ({ cleared, tree: t, resets: 0, loadout: ['stopwatch'], ...change });

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

describe('heroes', () => {
  const write = (uid: string, data: Record<string, unknown>) => setDoc(hero(dbFor(uid), uid), data);

  it('are made by their owner, from no more than one level', async () => {
    await assertSucceeds(write('ann', heroDoc(1, tree({ hp: 1 }))));
    await assertFails(setDoc(hero(dbFor('bob'), 'eve'), heroDoc(0)));
    await assertFails(write('bob', heroDoc(2)));
    await assertFails(write('bob', { cleared: 0, tree: tree(), updatedAt: serverTimestamp() })); // no resets or loadout
  });

  it('are private', async () => {
    await admin(['heroes', 'ann'], stored(0));
    await assertSucceeds(getDoc(hero(dbFor('ann'), 'ann')));
    await assertFails(getDoc(hero(dbFor('bob'), 'ann')));
  });

  it('clear one level a write and never go back', async () => {
    await admin(['heroes', 'ann'], stored(4));
    await assertFails(write('ann', heroDoc(6)));
    await assertFails(write('ann', heroDoc(3)));
    await assertSucceeds(write('ann', heroDoc(5)));
  });

  it("can't spend more points than their levels give, at the tree's prices", async () => {
    await admin(['heroes', 'ann'], stored(4));
    // Level 5 is a boss: 5 + 1 = 6 points. Stopwatch 3 is 1 + 2, HP 2 is 1 + 2.
    await assertSucceeds(write('ann', heroDoc(5, tree({ stopwatch: 3, hp: 2 }))));
    await assertFails(write('ann', heroDoc(5, tree({ stopwatch: 3, hp: 2, def: 1 }))));
    await admin(['heroes', 'ann'], stored(4));
    await assertSucceeds(write('ann', heroDoc(5, tree({ stopwatch: 2, poker: 1 }), { loadout: ['poker', 'stopwatch'] }))); // 1 + 5 to unlock
    await admin(['heroes', 'ann'], stored(4));
    await assertFails(write('ann', heroDoc(5, tree({ stopwatch: 0, hp: 1 }))));
    await assertFails(write('ann', heroDoc(5, tree({ hp: 11 }))));
    await assertFails(write('ann', heroDoc(5, { ...tree(), wings: 1 })));
  });

  it('bring a loadout of 1 to 4 different skills they have', async () => {
    await admin(['heroes', 'ann'], stored(5, tree({ stopwatch: 2, poker: 1 }), { loadout: ['stopwatch', 'poker'] }));
    const t = tree({ stopwatch: 2, poker: 1 });
    await assertSucceeds(write('ann', heroDoc(5, t, { loadout: ['poker'] })));
    await assertFails(write('ann', heroDoc(5, t, { loadout: [] })));
    await assertFails(write('ann', heroDoc(5, t, { loadout: ['poker', 'poker'] })));
    await assertFails(write('ann', heroDoc(5, t, { loadout: ['roulette'] })));
    await assertFails(write('ann', heroDoc(5, t, { loadout: ['hp'] })));
  });

  it('only take levels back through a paid reset, each costing a point more', async () => {
    await admin(['heroes', 'ann'], stored(5, tree({ stopwatch: 3, hp: 2 })));
    await assertFails(write('ann', heroDoc(5, tree({ stopwatch: 3, hp: 1 })))); // free refund
    await assertFails(write('ann', heroDoc(5, tree({ stopwatch: 3, hp: 1 }), { resets: 2 })));
    // Reset 1 costs 1 of the 6 points: 5 left, and Stopwatch 3 + HP 2 is 6.
    await assertFails(write('ann', heroDoc(5, tree({ stopwatch: 3, hp: 2 }), { resets: 1 })));
    await assertSucceeds(write('ann', heroDoc(5, tree({ stopwatch: 3, hp: 1 }), { resets: 1 })));
    await assertFails(write('ann', heroDoc(5, tree(), { resets: 0 }))); // resets never go down
    // Two resets have cost 1 + 2: 3 points left.
    await assertSucceeds(write('ann', heroDoc(5, tree({ stopwatch: 2, hp: 1 }), { resets: 2 })));
    await assertFails(write('ann', heroDoc(5, tree({ stopwatch: 2, hp: 1 }), { resets: 3 }))); // 6 burned
  });

  it('from before the prices are refunded once, for free', async () => {
    await admin(['heroes', 'ann'], { cleared: 5, tree: { stopwatch: 4, roulette: 2, poker: 1, hp: 0, def: 0, crit: 0, critDmg: 0 } });
    await assertSucceeds(write('ann', heroDoc(5)));
  });
});

describe('hero rooms', () => {
  beforeEach(async () => {
    await admin(['heroes', 'ann'], stored(3, tree({ hp: 2 })));
    await admin(['heroes', 'bob'], stored(1, tree({ def: 1 })));
  });

  const open = { host: 'ann', playerIds: ['ann'], names: { ann: 'Ann' }, fighters: { ann: tree({ hp: 2 }) }, loadouts: { ann: ['stopwatch'] }, status: 'lobby' };

  it('open with the host bringing their own hero', async () => {
    await assertSucceeds(setDoc(room(dbFor('ann')), { ...open, createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(dbFor('ann'), 'heroDuels', 'ABCD'), { ...open, fighters: { ann: tree({ hp: 1 }) }, createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(dbFor('ann'), 'heroDuels', 'ABCE'), { ...open, loadouts: { ann: ['poker'] }, createdAt: serverTimestamp() }));
    const { loadouts: _, ...noLoadouts } = open;
    await assertFails(setDoc(doc(dbFor('ann'), 'heroDuels', 'ABCF'), { ...noLoadouts, createdAt: serverTimestamp() }));
  });

  it('take a second player with their own hero', async () => {
    await admin(['heroDuels', CODE], open);
    const join = { playerIds: ['ann', 'bob'], names: { ann: 'Ann', bob: 'Bob' }, loadouts: { ann: ['stopwatch'], bob: ['stopwatch'] } };
    await assertFails(updateDoc(room(dbFor('bob')), { ...join, fighters: { ann: tree({ hp: 2 }), bob: tree({ def: 10 }) } }));
    await assertFails(updateDoc(room(dbFor('bob')), { ...join, fighters: { ann: tree(), bob: tree({ def: 1 }) } }));
    await assertFails(updateDoc(room(dbFor('bob')), { ...join, loadouts: { ann: ['stopwatch'], bob: ['poker'] }, fighters: { ann: tree({ hp: 2 }), bob: tree({ def: 1 }) } }));
    await assertSucceeds(updateDoc(room(dbFor('bob')), { ...join, fighters: { ann: tree({ hp: 2 }), bob: tree({ def: 1 }) } }));
  });

  it('start by the host with two players, and moves go in order', async () => {
    await admin(['heroDuels', CODE], { ...open, playerIds: ['ann', 'bob'], names: { ann: 'Ann', bob: 'Bob' } });
    await assertFails(updateDoc(room(dbFor('bob')), { status: 'playing', seed: 'abcdef12', startedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(room(dbFor('ann')), { status: 'playing', seed: 'abcdef12', startedAt: serverTimestamp() }));
    const move = (uid: string, n: number) => setDoc(doc(dbFor(uid), 'heroDuels', CODE, 'moves', String(n)), { n, by: uid, move: { skill: 'poker' } });
    await assertFails(move('ann', 1));
    await assertSucceeds(move('ann', 0));
    await assertSucceeds(move('bob', 1));
    await assertFails(move('eve', 2));
    await assertFails(getDoc(doc(dbFor('eve'), 'heroDuels', CODE, 'moves', '0')));
    await assertSucceeds(updateDoc(room(dbFor('bob')), { status: 'done', endedAt: serverTimestamp() }));
  });
});
