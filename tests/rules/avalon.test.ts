import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, increment, serverTimestamp, setDoc, updateDoc, writeBatch, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

// Mirrors the writes in src/services/avalon.ts.

let env: RulesTestEnvironment;
const asModular = (db: unknown) => db as Firestore;
const dbFor = (uid: string) => asModular(env.authenticatedContext(uid).firestore());
const CODE = 'ABCD';
const FIVE = ['host', 'p1', 'p2', 'p3', 'p4'];
const names = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, id.toUpperCase()]));

async function asAdmin(write: (db: Firestore) => Promise<unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await write(asModular(ctx.firestore()));
  });
}

const roomRef = (db: Firestore) => doc(db, 'rooms', CODE);

/** A room in the lobby with these players. */
const seedLobby = (ids: string[]) =>
  asAdmin((db) => setDoc(roomRef(db), { host: ids[0], playerIds: ids, names: names(ids), status: 'lobby', optional: [], lady: false, createdAt: serverTimestamp() }));

/** A game in progress: host, p1, p2 good (host is Merlin), p3 assassin, p4 minion. */
const ROLES: Record<string, string> = { host: 'merlin', p1: 'servant', p2: 'servant', p3: 'assassin', p4: 'minion' };
async function seedGame(lady = false) {
  await asAdmin(async (db) => {
    await setDoc(roomRef(db), { host: 'host', playerIds: FIVE, names: names(FIVE), status: 'playing', optional: [], lady, createdAt: serverTimestamp(), firstLeader: 0, startedAt: serverTimestamp() });
    for (const uid of FIVE) await setDoc(doc(db, 'rooms', CODE, 'secrets', uid), { role: ROLES[uid], sees: [] });
    // Quest 0: p1 and p3 approved to go.
    await setDoc(doc(db, 'rooms', CODE, 'proposals', '0-0'), { quest: 0, attempt: 0, leader: 'host', team: ['p1', 'p3'] });
  });
}

/** Plays one card as `uid`, the way the app does: a marker and a tally, together. */
function playCard(uid: string, fail: boolean, first: boolean) {
  const db = dbFor(uid);
  const batch = writeBatch(db);
  const quest = doc(db, 'rooms', CODE, 'quests', '0');
  if (first) batch.set(quest, { quest: 0, attempt: 0, successes: fail ? 0 : 1, fails: fail ? 1 : 0 });
  else batch.update(quest, fail ? { fails: increment(1) } : { successes: increment(1) });
  batch.set(doc(db, 'rooms', CODE, 'quests', '0', 'cards', uid), {});
  return batch.commit();
}

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-game', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

describe('rooms', () => {
  it('can be opened by a player, as its host', async () => {
    const db = dbFor('host');
    const room = { host: 'host', playerIds: ['host'], names: { host: 'Host' }, status: 'lobby', optional: ['percival'], lady: false, createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(roomRef(db), room));
    await assertFails(setDoc(doc(db, 'rooms', 'abcd'), room));
    await assertFails(setDoc(doc(db, 'rooms', 'WXYZ'), { ...room, host: 'someone' }));
    await assertFails(setDoc(doc(db, 'rooms', 'WXYZ'), { ...room, status: 'playing' }));
  });

  it('let players join and leave themselves while in the lobby', async () => {
    await seedLobby(['host', 'p1']);
    await assertSucceeds(updateDoc(roomRef(dbFor('p2')), { playerIds: ['host', 'p1', 'p2'], names: names(['host', 'p1', 'p2']) }));
    // Not someone else, and not twice.
    await assertFails(updateDoc(roomRef(dbFor('p3')), { playerIds: ['host', 'p1', 'p2', 'p9'], names: names(['host', 'p1', 'p2', 'p9']) }));
    await assertFails(updateDoc(roomRef(dbFor('p2')), { playerIds: ['host', 'p1', 'p2', 'p2'], names: names(['host', 'p1', 'p2']) }));
    await assertSucceeds(updateDoc(roomRef(dbFor('p1')), { playerIds: ['host', 'p2'] }));
    await assertFails(updateDoc(roomRef(dbFor('host')), { playerIds: ['p2'] }));
  });

  it('let the host seat players in table order and add the Lady, and no one else', async () => {
    await seedLobby(FIVE);
    const seated = ['host', 'p3', 'p1', 'p4', 'p2'];
    await assertFails(updateDoc(roomRef(dbFor('p1')), { playerIds: seated }));
    await assertSucceeds(updateDoc(roomRef(dbFor('host')), { playerIds: seated, lady: true }));
    // Reordering can't swap anyone in or out.
    await assertFails(updateDoc(roomRef(dbFor('host')), { playerIds: ['host', 'p3', 'p1', 'p4', 'p9'] }));
    await assertFails(updateDoc(roomRef(dbFor('host')), { playerIds: ['host', 'p3', 'p1', 'p4'] }));
  });

  it('stop at ten players', async () => {
    const ten = ['host', ...Array.from({ length: 9 }, (_, i) => `p${i + 1}`)];
    await seedLobby(ten);
    await assertFails(updateDoc(roomRef(dbFor('late')), { playerIds: [...ten, 'late'], names: names([...ten, 'late']) }));
  });

  it('start only by the host, with five or more, dealing each role in the same batch', async () => {
    await seedLobby(FIVE);
    const start = (uid: string) => {
      const db = dbFor(uid);
      const batch = writeBatch(db);
      batch.update(roomRef(db), { status: 'playing', firstLeader: 2, startedAt: serverTimestamp() });
      for (const p of FIVE) batch.set(doc(db, 'rooms', CODE, 'secrets', p), { role: ROLES[p], sees: [] });
      return batch.commit();
    };
    await assertFails(start('p1'));
    await assertSucceeds(start('host'));
    // No more dealing once it has started.
    await assertFails(setDoc(doc(dbFor('host'), 'rooms', CODE, 'secrets', 'p1'), { role: 'merlin', sees: [] }));
  });

  it("won't start with four", async () => {
    await seedLobby(FIVE.slice(0, 4));
    await assertFails(updateDoc(roomRef(dbFor('host')), { status: 'playing', firstLeader: 0, startedAt: serverTimestamp() }));
  });
});

describe('secrets', () => {
  beforeEach(() => seedGame());

  it('are readable only by their own player while playing', async () => {
    await assertSucceeds(getDoc(doc(dbFor('p1'), 'rooms', CODE, 'secrets', 'p1')));
    await assertFails(getDoc(doc(dbFor('p1'), 'rooms', CODE, 'secrets', 'p3')));
    await assertFails(getDoc(doc(dbFor('host'), 'rooms', CODE, 'secrets', 'p3')));
  });

  it('open to everyone once the game is over', async () => {
    await assertSucceeds(updateDoc(roomRef(dbFor('p2')), { status: 'done', endedAt: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(dbFor('p1'), 'rooms', CODE, 'secrets', 'p3')));
  });
});

describe('playing', () => {
  beforeEach(() => seedGame());

  it('lets the proposer name only themselves as leader', async () => {
    const proposal = { quest: 0, attempt: 1, leader: 'p1', team: ['p1', 'p2'] };
    await assertSucceeds(setDoc(doc(dbFor('p1'), 'rooms', CODE, 'proposals', '0-1'), proposal));
    await assertFails(setDoc(doc(dbFor('p2'), 'rooms', CODE, 'proposals', '0-2'), { ...proposal, attempt: 2 }));
    await assertFails(setDoc(doc(dbFor('outsider'), 'rooms', CODE, 'proposals', '0-2'), { ...proposal, attempt: 2, leader: 'outsider' }));
  });

  it('takes one vote per player, only their own', async () => {
    const ref = (uid: string) => doc(dbFor(uid), 'rooms', CODE, 'votes', `0-0-${uid}`);
    await assertSucceeds(setDoc(ref('p2'), { quest: 0, attempt: 0, uid: 'p2', approve: true }));
    await assertFails(setDoc(ref('p2'), { quest: 0, attempt: 0, uid: 'p2', approve: false }));
    await assertFails(setDoc(doc(dbFor('p1'), 'rooms', CODE, 'votes', '0-0-p4'), { quest: 0, attempt: 0, uid: 'p4', approve: true }));
    // Not on a team no one proposed.
    await assertFails(setDoc(doc(dbFor('p1'), 'rooms', CODE, 'votes', '3-0-p1'), { quest: 3, attempt: 0, uid: 'p1', approve: true }));
  });

  it("won't let a good player play a fail, but will an evil one", async () => {
    await assertFails(playCard('p1', true, true));
    await assertSucceeds(playCard('p1', false, true));
    await assertSucceeds(playCard('p3', true, false));
  });

  it('keeps players off quests they are not on, and to one card each', async () => {
    await assertFails(playCard('p2', false, true));
    await assertSucceeds(playCard('p3', false, true));
    await assertFails(playCard('p3', false, false));
  });

  it('refuses a marker without a card, or a card without a marker', async () => {
    await assertSucceeds(playCard('p1', false, true));
    await assertFails(setDoc(doc(dbFor('p3'), 'rooms', CODE, 'quests', '0', 'cards', 'p3'), {}));
    await assertFails(updateDoc(doc(dbFor('p3'), 'rooms', CODE, 'quests', '0'), { successes: increment(1) }));
  });

  it('records no choice in a card marker', async () => {
    const db = dbFor('p1');
    const batch = writeBatch(db);
    batch.set(doc(db, 'rooms', CODE, 'quests', '0'), { quest: 0, attempt: 0, successes: 1, fails: 0 });
    batch.set(doc(db, 'rooms', CODE, 'quests', '0', 'cards', 'p1'), { fail: false });
    await assertFails(batch.commit());
  });

  it('lets only the assassin name Merlin, which ends the game', async () => {
    await assertFails(updateDoc(roomRef(dbFor('p4')), { status: 'done', endedAt: serverTimestamp(), assassinated: 'host' }));
    await assertSucceeds(updateDoc(roomRef(dbFor('p3')), { status: 'done', endedAt: serverTimestamp(), assassinated: 'host' }));
  });
});

describe('the Lady of the Lake', () => {
  // First leader is seat 0 (host), so the Lady starts with seat 4 (p4, the minion).
  const pick = (uid: string, after: number, target: string) =>
    setDoc(doc(dbFor(uid), 'rooms', CODE, 'lady', String(after)), { quest: after, holder: uid, target });
  const result = (uid: string, after: number, evil: boolean) => setDoc(doc(dbFor(uid), 'rooms', CODE, 'ladyResults', String(after)), { evil });

  it('is only in games that include her', async () => {
    await seedGame(false);
    await assertFails(pick('p4', 1, 'p2'));
  });

  it('lets only her holder examine, never a past holder', async () => {
    await seedGame(true);
    await assertFails(pick('host', 1, 'p2'));
    await assertFails(pick('p4', 1, 'p4'));
    await assertSucceeds(pick('p4', 1, 'p2'));
    // She is now p2's, and can't go back to p4.
    await assertFails(pick('p4', 2, 'p1'));
    await assertFails(pick('p2', 2, 'p4'));
    await assertSucceeds(pick('p2', 2, 'p3'));
    // Third use: not to p4 or p2 either.
    await assertFails(pick('p3', 3, 'p2'));
    await assertSucceeds(pick('p3', 3, 'p1'));
  });

  it("gets the truth from the examined player's phone, for the holder's eyes only", async () => {
    await seedGame(true);
    await assertSucceeds(pick('p4', 1, 'p3'));
    // p3 is the assassin: their phone must say evil.
    await assertFails(result('p3', 1, false));
    await assertFails(result('p1', 1, true));
    await assertSucceeds(result('p3', 1, true));
    await assertSucceeds(getDoc(doc(dbFor('p4'), 'rooms', CODE, 'ladyResults', '1')));
    await assertFails(getDoc(doc(dbFor('p1'), 'rooms', CODE, 'ladyResults', '1')));
    await assertFails(getDoc(doc(dbFor('p3'), 'rooms', CODE, 'ladyResults', '1')));
  });

  it('shows a good player as good', async () => {
    await seedGame(true);
    await assertSucceeds(pick('p4', 1, 'p1'));
    await assertFails(result('p1', 1, true));
    await assertSucceeds(result('p1', 1, false));
  });
});
