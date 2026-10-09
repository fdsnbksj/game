import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

// Mirrors src/services/wardrobe.ts, and what the hero doc, hero rooms and the arena carry
// of it (src/services/hero.ts, src/services/arena.ts).

let env: RulesTestEnvironment;
const asModular = (db: unknown) => db as Firestore;
const dbFor = (uid: string) => asModular(env.authenticatedContext(uid).firestore());

const LOOK = { skin: 1, face: 0, hair: 1, hairColour: 10, hat: 0, shirt: 0, shirtColour: 7, pants: 0, pantsColour: 10, extra: 0 };
const tree = (change: Record<string, number> = {}) => ({ stopwatch: 1, speed: 0, poker: 0, roulette: 0, hp: 0, def: 0, crit: 0, critDmg: 0, ...change });
const W = { look: LOOK, costume: null, owned: [] as string[], gems: 0, pity: 0, lastFree: '' };

async function admin(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(asModular(ctx.firestore()), path), data);
  });
}

const wardrobe = (uid: string, change: Record<string, unknown> = {}, as = uid) =>
  setDoc(doc(dbFor(as), 'wardrobes', uid), { ...W, ...change, updatedAt: serverTimestamp() });

const writeHero = (change: Record<string, unknown> = {}) =>
  setDoc(doc(dbFor('ann'), 'heroes', 'ann'), { cleared: 1, tree: tree(), resets: 0, loadout: ['stopwatch'], look: LOOK, costume: null, ...change, updatedAt: serverTimestamp() });

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-game', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

describe('wardrobes', () => {
  it('are written and read by their owner only', async () => {
    await assertSucceeds(wardrobe('ann', { gems: 250, owned: ['hat:crown', 'costume:tungtung'], costume: 'tungtung', pity: 12, lastFree: '2026-10-09' }));
    await assertSucceeds(getDoc(doc(dbFor('ann'), 'wardrobes', 'ann')));
    await assertFails(getDoc(doc(dbFor('bob'), 'wardrobes', 'ann')));
    await assertFails(wardrobe('ann', {}, 'bob'));
  });

  it('hold only real items, a sane count of gems and a costume that was summoned', async () => {
    await assertFails(wardrobe('ann', { owned: ['costume:pepe'] }));
    await assertFails(wardrobe('ann', { gems: -5 }));
    await assertFails(wardrobe('ann', { gems: 1.5 }));
    await assertFails(wardrobe('ann', { pity: 50 }));
    await assertFails(wardrobe('ann', { costume: 'tungtung' }));
    await assertFails(wardrobe('ann', { look: { ...LOOK, hat: 12 } }));
    await assertFails(wardrobe('ann', { look: { ...LOOK, wings: 1 } }));
    await assertFails(wardrobe('ann', { extra: 1 }));
  });
});

describe('what a hero wears', () => {
  it('may be left off by an older phone', async () => {
    await assertSucceeds(setDoc(doc(dbFor('ann'), 'heroes', 'ann'), { cleared: 1, tree: tree(), resets: 0, loadout: ['stopwatch'], updatedAt: serverTimestamp() }));
  });

  it('is a valid look and a costume from the wardrobe', async () => {
    await assertSucceeds(writeHero());
    await assertFails(writeHero({ look: { ...LOOK, face: 99 } }));
    await assertFails(writeHero({ costume: 'tungtung' }));
    await admin('wardrobes/ann', { ...W, owned: ['costume:tungtung'] });
    await assertSucceeds(writeHero({ costume: 'tungtung' }));
    await assertFails(writeHero({ costume: 'tralalero' }));
  });

  it('is what a player brings into a room', async () => {
    await admin('wardrobes/ann', { ...W, owned: ['costume:tungtung'] });
    await admin('heroes/ann', { cleared: 1, tree: tree(), resets: 0, loadout: ['stopwatch'], look: LOOK, costume: 'tungtung' });
    await admin('heroes/bob', { cleared: 1, tree: tree(), resets: 0, loadout: ['stopwatch'], look: { ...LOOK, face: 2 }, costume: null });
    const open = { host: 'ann', playerIds: ['ann'], names: { ann: 'Ann' }, fighters: { ann: tree() }, loadouts: { ann: ['stopwatch'] }, status: 'lobby' };
    await assertFails(setDoc(doc(dbFor('ann'), 'heroDuels', 'ABCD'), { ...open, looks: { ann: { look: LOOK, costume: 'tralalero' } }, createdAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(dbFor('ann'), 'heroDuels', 'HERO'), { ...open, looks: { ann: { look: LOOK, costume: 'tungtung' } }, createdAt: serverTimestamp() }));
    const join = { playerIds: ['ann', 'bob'], names: { ann: 'Ann', bob: 'Bob' }, fighters: { ann: tree(), bob: tree() }, loadouts: { ann: ['stopwatch'], bob: ['stopwatch'] } };
    const room = doc(dbFor('bob'), 'heroDuels', 'HERO');
    await assertFails(updateDoc(room, { ...join, looks: { ann: { look: LOOK, costume: 'tungtung' }, bob: { look: LOOK, costume: null } } }));
    await assertSucceeds(updateDoc(room, { ...join, looks: { ann: { look: LOOK, costume: 'tungtung' }, bob: { look: { ...LOOK, face: 2 }, costume: null } } }));
  });

  it('is what the arena shows', async () => {
    await admin('players/ann', { displayName: 'Ann' });
    await admin('heroes/ann', { cleared: 5, tree: tree(), resets: 0, loadout: ['stopwatch'], look: { ...LOOK, hair: 3 }, costume: null });
    const arena = doc(dbFor('ann'), 'arena', 'ann');
    const join = { name: 'Ann', tree: tree(), loadout: ['stopwatch'], rating: 1000, wins: 0, losses: 0, lastFightAt: serverTimestamp() };
    await assertFails(setDoc(arena, { ...join, look: LOOK, costume: null }));
    await assertSucceeds(setDoc(arena, { ...join, look: { ...LOOK, hair: 3 }, costume: null }));
    await admin('heroes/ann', { cleared: 5, tree: tree(), resets: 0, loadout: ['stopwatch'], look: { ...LOOK, hair: 4 }, costume: null });
    await assertFails(updateDoc(arena, { look: { ...LOOK, hair: 5 } }));
    await assertSucceeds(updateDoc(arena, { look: { ...LOOK, hair: 4 } }));
  });
});
