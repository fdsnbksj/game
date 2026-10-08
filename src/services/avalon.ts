import { FirebaseError } from 'firebase/app';
import { collection, doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db, dbRest } from '../firebase';
import { deal, type Secret } from '../games/avalon/deal';
import type { OptionalRole } from '../games/avalon/rules';
import type { LadyPick, Proposal, QuestTally, Vote } from '../games/avalon/state';
import { useGameStore } from '../store';
import { keepFresh, poke, rest, restDoc, type Snap } from './resilient';
import { newCode } from './roomCode';

// Avalon rooms in Firestore. firestore.rules checks every write here, and
// tests/rules/avalon.test.ts mirrors them. Each player writes only their own actions; the
// game state is worked out from the documents by derive() on every phone. Writes go over
// plain HTTPS and rooms are followed with a backup check, so a phone whose stream has
// stalled still keeps up (src/services/resilient.ts says why).

export interface Room {
  code: string;
  host: string;
  playerIds: string[];
  names: Record<string, string>;
  status: 'lobby' | 'playing' | 'done';
  optional: OptionalRole[];
  /** Whether the Lady of the Lake is in the game. */
  lady: boolean;
  firstLeader: number;
  assassinated: string | null;
}

const roomRef = (code: string) => restDoc('rooms', code);
/** After a write: look at the server now. */
const wrote = (code: string) => poke(`rooms/${code}`);


function me() {
  const { uid, player } = useGameStore.getState();
  if (!uid || !player) throw new Error('Not connected yet. Try again in a moment.');
  return { uid, name: player.displayName };
}

/** Opens a room with you as host; returns its code. */
export async function createRoom(): Promise<string> {
  const { uid, name } = me();
  for (let tries = 0; tries < 5; tries++) {
    const code = newCode();
    try {
      await rest.setDoc(roomRef(code), { host: uid, playerIds: [uid], names: { [uid]: name }, status: 'lobby', optional: ['percival', 'morgana'], lady: false, createdAt: rest.serverTimestamp() });
      return code;
    } catch (error) {
      // Taken already: the rules refuse creating over an existing room. Try another code.
      if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
    }
  }
  throw new Error('Could not open a room. Try again.');
}

/** Joins a room in its lobby. Returns why not, if you can't. */
export async function joinRoom(code: string): Promise<string | null> {
  const { uid, name } = me();
  const snap = await rest.getDoc(roomRef(code));
  if (!snap.exists()) return 'No room with that code.';
  const room = snap.data();
  if ((room.playerIds as string[]).includes(uid)) return null;
  if (room.status !== 'lobby') return 'That game has already started.';
  if ((room.playerIds as string[]).length >= 10) return 'That room is full.';
  await rest.updateDoc(roomRef(code), { playerIds: [...room.playerIds, uid], names: { ...room.names, [uid]: name } });
  return null;
}

export async function leaveRoom(room: Room) {
  const { uid } = me();
  await rest.updateDoc(roomRef(room.code), { playerIds: room.playerIds.filter((p) => p !== uid) });
  wrote(room.code);
}

export async function setOptional(code: string, optional: OptionalRole[]) {
  await rest.updateDoc(roomRef(code), { optional });
  wrote(code);
}

export async function setLady(code: string, lady: boolean) {
  await rest.updateDoc(roomRef(code), { lady });
  wrote(code);
}

/** The host seats everyone in the order they sit, clockwise: the lead passes that way. */
export async function seat(code: string, playerIds: string[]) {
  await rest.updateDoc(roomRef(code), { playerIds });
  wrote(code);
}

/** The Lady's holder examines `target` after quest `after` (1, 2 or 3, 0-based). */
export async function pickLady(code: string, after: number, target: string) {
  const { uid } = me();
  await rest.setDoc(restDoc('rooms', code, 'lady', String(after)), { quest: after, holder: uid, target });
  wrote(code);
}

/**
 * The examined player's phone tells the holder their loyalty. The rules check it against
 * their role, so it can't lie; only the holder can read it. Refused if already filed.
 */
export async function fileLadyResult(code: string, after: number, evil: boolean) {
  await rest.setDoc(restDoc('rooms', code, 'ladyResults', String(after)), { evil });
  wrote(code);
}

/** A number from 0 to 1 from the browser's crypto source, for dealing. */
function cryptoRandom() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

/** Starts the game: deals every role and picks the first leader, in one batch. */
export async function startGame(room: Room) {
  const secrets = deal(room.playerIds, room.optional, cryptoRandom);
  const batch = rest.writeBatch(dbRest);
  batch.update(roomRef(room.code), {
    status: 'playing',
    firstLeader: Math.floor(cryptoRandom() * room.playerIds.length),
    startedAt: rest.serverTimestamp(),
  });
  for (const [uid, secret] of Object.entries(secrets)) batch.set(restDoc('rooms', room.code, 'secrets', uid), secret);
  await batch.commit();
  wrote(room.code);
}

export async function propose(code: string, quest: number, attempt: number, team: string[]) {
  const { uid } = me();
  await rest.setDoc(restDoc('rooms', code, 'proposals', `${quest}-${attempt}`), { quest, attempt, leader: uid, team });
  wrote(code);
}

export async function vote(code: string, quest: number, attempt: number, approve: boolean) {
  const { uid } = me();
  await rest.setDoc(restDoc('rooms', code, 'votes', `${quest}-${attempt}-${uid}`), { quest, attempt, uid, approve });
  wrote(code);
}

/**
 * Plays a quest card: a marker that you've played (with nothing about what) and the
 * tally going up by one, together. A transaction, since the first card creates the tally.
 */
export async function playCard(code: string, quest: number, attempt: number, fail: boolean) {
  const { uid } = me();
  const tally = restDoc('rooms', code, 'quests', String(quest));
  await rest.runTransaction(dbRest, async (tx) => {
    const current = await tx.get(tally);
    if (current.exists()) tx.update(tally, fail ? { fails: rest.increment(1) } : { successes: rest.increment(1) });
    else tx.set(tally, { quest, attempt, successes: fail ? 0 : 1, fails: fail ? 1 : 0 });
    tx.set(restDoc('rooms', code, 'quests', String(quest), 'cards', uid), {});
  });
  wrote(code);
}

/** The assassin names Merlin, which ends the game. */
export async function assassinate(code: string, target: string) {
  await rest.updateDoc(roomRef(code), { status: 'done', endedAt: rest.serverTimestamp(), assassinated: target });
  wrote(code);
}

/** Evil has won on quests or rejections; every phone works that out, and any may say so. */
export async function finish(code: string) {
  await rest.updateDoc(roomRef(code), { status: 'done', endedAt: rest.serverTimestamp() });
  wrote(code);
}

export interface RoomData {
  room: Room | null;
  missing: boolean;
  proposals: Proposal[];
  votes: Vote[];
  tallies: QuestTally[];
  /** Who has played a card on each quest. */
  played: Record<number, string[]>;
  mine: Secret | null;
  /** Everyone's, once the game is over. */
  secrets: Record<string, Secret>;
  ladyPicks: LadyPick[];
  /** What the Lady showed you, by quest, for the picks you made: true when evil. */
  ladySeen: Record<number, boolean>;
}

export const emptyRoom = (): RoomData => ({ room: null, missing: false, proposals: [], votes: [], tallies: [], played: {}, mine: null, secrets: {}, ladyPicks: [], ladySeen: {} });

const roomOf = (code: string, d: Record<string, unknown>): Room => ({
  code,
  host: d.host as string,
  playerIds: d.playerIds as string[],
  names: d.names as Record<string, string>,
  status: d.status as Room['status'],
  optional: (d.optional as OptionalRole[] | undefined) ?? [],
  lady: (d.lady as boolean | undefined) ?? false,
  firstLeader: (d.firstLeader as number | undefined) ?? 0,
  assassinated: (d.assassinated as string | undefined) ?? null,
});

/**
 * Follows a room. Calls `onChange` with everything so far on every change. Live listeners
 * do the work; every 10 s (and after each write of ours) a check over HTTPS compares how
 * many proposals, votes, quests and Lady picks the server has with what we've heard, reads
 * again whatever differs, and remakes the listeners if they'd missed it.
 */
export function watchRoom(code: string, uid: string, onChange: (data: RoomData) => void): Unsubscribe {
  let data = emptyRoom();
  let stopped = false;
  /** Changes heard from the room listener, so a slower read never overrides a newer one. */
  let heard = 0;
  const update = (patch: Partial<RoomData>) => {
    data = { ...data, ...patch };
    if (!stopped) onChange(data);
  };
  const member = () => !!data.room && data.room.playerIds.includes(uid) && data.room.status !== 'lobby';

  const listen = (fail: () => void) => {
    const subs: Unsubscribe[] = [];
    const cardSubs = new Map<number, Unsubscribe>();
    const ladySubs = new Map<number, Unsubscribe>();
    let watchingMembers = false;
    let watchingSecrets = false;
    let closed = false;

    /** What the Lady shows you after quest `after`: only readable by her holder; retried if refused. */
    const watchLady = (after: number) => {
      ladySubs.set(
        after,
        onSnapshot(
          doc(db, 'rooms', code, 'ladyResults', String(after)),
          (r) => r.exists() && update({ ladySeen: { ...data.ladySeen, [after]: r.get('evil') as boolean } }),
          () => setTimeout(() => !closed && watchLady(after), 2000),
        ),
      );
    };

    /** Everyone's roles, for the reveal; retried if the rules refuse (the game not over yet). */
    const openSecrets = () => {
      watchingSecrets = true;
      subs.push(
        onSnapshot(
          collection(db, 'rooms', code, 'secrets'),
          (s) => update({ secrets: Object.fromEntries(s.docs.map((x) => [x.id, x.data() as Secret])) }),
          () => setTimeout(() => !closed && openSecrets(), 2000),
        ),
      );
    };

    subs.push(
      // With metadata changes, so we hear when a write is confirmed by the server.
      onSnapshot(
        doc(db, 'rooms', code),
        { includeMetadataChanges: true },
        (snap) => {
          heard++;
          if (!snap.exists()) return update({ missing: true, room: null });
          const room = roomOf(code, snap.data());
          update({ room, missing: false });
          // Only members may read the rest, so start once we're in.
          if (!watchingMembers && member()) {
            watchingMembers = true;
            const col = (name: string) => collection(db, 'rooms', code, name);
            subs.push(
              onSnapshot(col('proposals'), (s) => update({ proposals: s.docs.map((x) => x.data() as Proposal) }), fail),
              onSnapshot(col('votes'), (s) => update({ votes: s.docs.map((x) => x.data() as Vote) }), fail),
              onSnapshot(
                col('quests'),
                (s) => {
                  update({ tallies: s.docs.map((x) => x.data() as QuestTally) });
                  for (const x of s.docs) {
                    const q = Number(x.id);
                    if (cardSubs.has(q)) continue;
                    cardSubs.set(
                      q,
                      onSnapshot(collection(db, 'rooms', code, 'quests', x.id, 'cards'), (c) => update({ played: { ...data.played, [q]: c.docs.map((y) => y.id) } }), fail),
                    );
                  }
                },
                fail,
              ),
              onSnapshot(doc(db, 'rooms', code, 'secrets', uid), (s) => update({ mine: s.exists() ? (s.data() as Secret) : null }), fail),
              onSnapshot(
                col('lady'),
                // With metadata, so a pick is followed only once the server has it:
                // until then the rules can't see it, and would refuse to show us the answer.
                { includeMetadataChanges: true },
                (s) => {
                  update({ ladyPicks: s.docs.map((x) => x.data() as LadyPick) });
                  for (const x of s.docs) {
                    const pick = x.data() as LadyPick;
                    if (pick.holder === uid && !x.metadata.hasPendingWrites && !ladySubs.has(pick.quest)) watchLady(pick.quest);
                  }
                },
                fail,
              ),
            );
          }
          // Everyone's role opens only once the server has the game as over.
          if (!watchingSecrets && room.status === 'done' && !snap.metadata.hasPendingWrites) openSecrets();
        },
        fail,
      ),
    );
    return () => {
      closed = true;
      for (const u of [...subs, ...cardSubs.values(), ...ladySubs.values()]) u();
    };
  };

  const poll = async (relisten: () => void) => {
    const before = heard;
    const snap: Snap = await rest.getDoc(restDoc('rooms', code));
    if (heard === before) {
      if (!snap.exists()) return update({ missing: true, room: null });
      update({ room: roomOf(code, snap.data()!), missing: false });
    }
    if (!member()) return;
    const col = (...path: string[]) => rest.collection(dbRest, 'rooms', code, ...path);
    const count = async (...path: string[]) => (await rest.getCount(col(...path))).data().count;
    let missed = false;
    // Each collection only grows, so a count that differs means something was missed.
    if ((await count('proposals')) !== data.proposals.length) {
      update({ proposals: (await rest.getDocs(col('proposals'))).docs.map((x) => x.data() as Proposal) });
      missed = true;
    }
    if ((await count('votes')) !== data.votes.length) {
      update({ votes: (await rest.getDocs(col('votes'))).docs.map((x) => x.data() as Vote) });
      missed = true;
    }
    if ((await count('quests')) !== data.tallies.length) {
      update({ tallies: (await rest.getDocs(col('quests'))).docs.map((x) => x.data() as QuestTally) });
      missed = true;
    }
    for (const t of data.tallies) {
      // A quest's tally changes in place: a card played shows as one more marker.
      const fresh = (await rest.getDoc(restDoc('rooms', code, 'quests', String(t.quest)))).data() as QuestTally | undefined;
      if (fresh && fresh.successes + fresh.fails !== t.successes + t.fails) {
        update({ tallies: data.tallies.map((x) => (x.quest === t.quest ? fresh : x)) });
        missed = true;
      }
      if ((data.played[t.quest]?.length ?? 0) !== (fresh ?? t).successes + (fresh ?? t).fails) {
        const cards = await rest.getDocs(col('quests', String(t.quest), 'cards'));
        update({ played: { ...data.played, [t.quest]: cards.docs.map((y) => y.id) } });
        missed = true;
      }
    }
    if (data.room?.lady && (await count('lady')) !== data.ladyPicks.length) {
      update({ ladyPicks: (await rest.getDocs(col('lady'))).docs.map((x) => x.data() as LadyPick) });
      missed = true;
    }
    if (!data.mine) {
      const mine = await rest.getDoc(restDoc('rooms', code, 'secrets', uid));
      if (mine.exists()) update({ mine: mine.data() as Secret });
    }
    for (const pick of data.ladyPicks) {
      if (pick.holder !== uid || pick.quest in data.ladySeen) continue;
      try {
        const seen = await rest.getDoc(restDoc('rooms', code, 'ladyResults', String(pick.quest)));
        if (seen.exists()) update({ ladySeen: { ...data.ladySeen, [pick.quest]: seen.get('evil') as boolean } });
      } catch {
        // Not filed yet, or not readable yet.
      }
    }
    if (data.room?.status === 'done' && !Object.keys(data.secrets).length) {
      try {
        const all = await rest.getDocs(col('secrets'));
        update({ secrets: Object.fromEntries(all.docs.map((x) => [x.id, x.data() as Secret])) });
      } catch {
        // The rules open them a moment after the game is over.
      }
    }
    if (missed) relisten();
  };

  const stop = keepFresh(`rooms/${code}`, listen, poll, { everyMs: 10_000, active: () => data.room?.status !== 'done' || !Object.keys(data.secrets).length });
  return () => {
    stopped = true;
    stop();
  };
}
