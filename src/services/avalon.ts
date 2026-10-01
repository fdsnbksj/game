import { FirebaseError } from 'firebase/app';
import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { deal, type Secret } from '../games/avalon/deal';
import type { OptionalRole } from '../games/avalon/rules';
import type { LadyPick, Proposal, QuestTally, Vote } from '../games/avalon/state';
import { useGameStore } from '../store';
import { newCode } from './roomCode';

// Avalon rooms in Firestore. firestore.rules checks every write here, and
// tests/rules/avalon.test.ts mirrors them. Each player writes only their own actions; the
// game state is worked out from the documents by derive() on every phone.

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

const roomRef = (code: string) => doc(db, 'rooms', code);


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
      await setDoc(roomRef(code), { host: uid, playerIds: [uid], names: { [uid]: name }, status: 'lobby', optional: ['percival', 'morgana'], lady: false, createdAt: serverTimestamp() });
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
  const snap = await getDoc(roomRef(code));
  if (!snap.exists()) return 'No room with that code.';
  const room = snap.data();
  if ((room.playerIds as string[]).includes(uid)) return null;
  if (room.status !== 'lobby') return 'That game has already started.';
  if ((room.playerIds as string[]).length >= 10) return 'That room is full.';
  await updateDoc(roomRef(code), { playerIds: [...room.playerIds, uid], names: { ...room.names, [uid]: name } });
  return null;
}

export async function leaveRoom(room: Room) {
  const { uid } = me();
  await updateDoc(roomRef(room.code), { playerIds: room.playerIds.filter((p) => p !== uid) });
}

export async function setOptional(code: string, optional: OptionalRole[]) {
  await updateDoc(roomRef(code), { optional });
}

export async function setLady(code: string, lady: boolean) {
  await updateDoc(roomRef(code), { lady });
}

/** The host seats everyone in the order they sit, clockwise: the lead passes that way. */
export async function seat(code: string, playerIds: string[]) {
  await updateDoc(roomRef(code), { playerIds });
}

/** The Lady's holder examines `target` after quest `after` (1, 2 or 3, 0-based). */
export async function pickLady(code: string, after: number, target: string) {
  const { uid } = me();
  await setDoc(doc(db, 'rooms', code, 'lady', String(after)), { quest: after, holder: uid, target });
}

/**
 * The examined player's phone tells the holder their loyalty. The rules check it against
 * their role, so it can't lie; only the holder can read it. Refused if already filed.
 */
export async function fileLadyResult(code: string, after: number, evil: boolean) {
  await setDoc(doc(db, 'rooms', code, 'ladyResults', String(after)), { evil });
}

/** A number from 0 to 1 from the browser's crypto source, for dealing. */
function cryptoRandom() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

/** Starts the game: deals every role and picks the first leader, in one batch. */
export async function startGame(room: Room) {
  const secrets = deal(room.playerIds, room.optional, cryptoRandom);
  const batch = writeBatch(db);
  batch.update(roomRef(room.code), {
    status: 'playing',
    firstLeader: Math.floor(cryptoRandom() * room.playerIds.length),
    startedAt: serverTimestamp(),
  });
  for (const [uid, secret] of Object.entries(secrets)) batch.set(doc(db, 'rooms', room.code, 'secrets', uid), secret);
  await batch.commit();
}

export async function propose(code: string, quest: number, attempt: number, team: string[]) {
  const { uid } = me();
  await setDoc(doc(db, 'rooms', code, 'proposals', `${quest}-${attempt}`), { quest, attempt, leader: uid, team });
}

export async function vote(code: string, quest: number, attempt: number, approve: boolean) {
  const { uid } = me();
  await setDoc(doc(db, 'rooms', code, 'votes', `${quest}-${attempt}-${uid}`), { quest, attempt, uid, approve });
}

/**
 * Plays a quest card: a marker that you've played (with nothing about what) and the
 * tally going up by one, together. A transaction, since the first card creates the tally.
 */
export async function playCard(code: string, quest: number, attempt: number, fail: boolean) {
  const { uid } = me();
  const tally = doc(db, 'rooms', code, 'quests', String(quest));
  await runTransaction(db, async (tx) => {
    const current = await tx.get(tally);
    if (current.exists()) tx.update(tally, fail ? { fails: increment(1) } : { successes: increment(1) });
    else tx.set(tally, { quest, attempt, successes: fail ? 0 : 1, fails: fail ? 1 : 0 });
    tx.set(doc(db, 'rooms', code, 'quests', String(quest), 'cards', uid), {});
  });
}

/** The assassin names Merlin, which ends the game. */
export async function assassinate(code: string, target: string) {
  await updateDoc(roomRef(code), { status: 'done', endedAt: serverTimestamp(), assassinated: target });
}

/** Evil has won on quests or rejections; every phone works that out, and any may say so. */
export async function finish(code: string) {
  await updateDoc(roomRef(code), { status: 'done', endedAt: serverTimestamp() });
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

/** Follows a room live. Calls `onChange` with everything so far on every change. */
export function watchRoom(code: string, uid: string, onChange: (data: RoomData) => void): Unsubscribe {
  let data = emptyRoom();
  const update = (patch: Partial<RoomData>) => {
    data = { ...data, ...patch };
    onChange(data);
  };
  const subs: Unsubscribe[] = [];
  const members: Unsubscribe[] = [];
  const cardSubs = new Map<number, Unsubscribe>();
  const ladySubs = new Map<number, Unsubscribe>();
  let watchingMembers = false;
  let watchingSecrets = false;
  let stopped = false;
  const ignore = () => {};

  /** What the Lady shows you after quest `after`: only readable by her holder; retried if refused. */
  const watchLady = (after: number) => {
    ladySubs.set(
      after,
      onSnapshot(
        doc(db, 'rooms', code, 'ladyResults', String(after)),
        (r) => r.exists() && update({ ladySeen: { ...data.ladySeen, [after]: r.get('evil') as boolean } }),
        () => setTimeout(() => !stopped && watchLady(after), 2000),
      ),
    );
  };

  /** Everyone's roles, for the reveal; retried if the rules refuse (the game not over yet). */
  const openSecrets = () => {
    watchingSecrets = true;
    members.push(
      onSnapshot(
        collection(db, 'rooms', code, 'secrets'),
        (s) => update({ secrets: Object.fromEntries(s.docs.map((x) => [x.id, x.data() as Secret])) }),
        () => setTimeout(() => !stopped && openSecrets(), 2000),
      ),
    );
  };

  subs.push(
    // With metadata changes, so we hear when our own write is confirmed by the server.
    onSnapshot(roomRef(code), { includeMetadataChanges: true }, (snap) => {
      if (!snap.exists()) return update({ missing: true, room: null });
      const d = snap.data();
      const room: Room = {
        code,
        host: d.host,
        playerIds: d.playerIds,
        names: d.names,
        status: d.status,
        optional: d.optional ?? [],
        lady: d.lady ?? false,
        firstLeader: d.firstLeader ?? 0,
        assassinated: d.assassinated ?? null,
      };
      update({ room, missing: false });
      // Only members may read the rest, so start once we're in.
      if (!watchingMembers && room.playerIds.includes(uid) && room.status !== 'lobby') {
        watchingMembers = true;
        const col = (name: string) => collection(db, 'rooms', code, name);
        members.push(
          onSnapshot(col('proposals'), (s) => update({ proposals: s.docs.map((x) => x.data() as Proposal) }), ignore),
          onSnapshot(col('votes'), (s) => update({ votes: s.docs.map((x) => x.data() as Vote) }), ignore),
          onSnapshot(
            col('quests'),
            (s) => {
              update({ tallies: s.docs.map((x) => x.data() as QuestTally) });
              for (const x of s.docs) {
                const q = Number(x.id);
                if (cardSubs.has(q)) continue;
                cardSubs.set(
                  q,
                  onSnapshot(collection(db, 'rooms', code, 'quests', x.id, 'cards'), (c) => update({ played: { ...data.played, [q]: c.docs.map((y) => y.id) } }), ignore),
                );
              }
            },
            ignore,
          ),
          onSnapshot(doc(db, 'rooms', code, 'secrets', uid), (s) => update({ mine: s.exists() ? (s.data() as Secret) : null }), ignore),
          onSnapshot(
            col('lady'),
            // With metadata, so a pick of ours is followed only once the server has it:
            // until then the rules can't see it, and would refuse to show us the answer.
            { includeMetadataChanges: true },
            (s) => {
              update({ ladyPicks: s.docs.map((x) => x.data() as LadyPick) });
              for (const x of s.docs) {
                const pick = x.data() as LadyPick;
                if (pick.holder === uid && !x.metadata.hasPendingWrites && !ladySubs.has(pick.quest)) watchLady(pick.quest);
              }
            },
            ignore,
          ),
        );
      }
      // Everyone's role opens only once the server has the game as over. Our own write
      // (the assassin's pick) shows as done here before it lands, when the rules would
      // still refuse, so wait for the server to confirm it.
      if (!watchingSecrets && room.status === 'done' && !snap.metadata.hasPendingWrites) openSecrets();
    }),
  );
  return () => {
    stopped = true;
    for (const u of [...subs, ...members, ...cardSubs.values(), ...ladySubs.values()]) u();
  };
}
