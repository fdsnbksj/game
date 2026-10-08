import { FirebaseError } from 'firebase/app';
import { collection, doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db, dbRest } from '../firebase';
import { DEFAULT_RULES, type Rules } from '../games/brawl/state';
import { useGameStore } from '../store';
import { keepFresh, poke, rest, restDoc, type Snap } from './resilient';
import { newCode } from './roomCode';

// Sky Brawl online: two phones fight each other directly over WebRTC. Firestore holds only
// the room (brawls/{code}: who's in, the seed) and one handshake each way
// (brawls/{code}/signals/offer and /answer, the whole connection offer in one write). The
// fight itself never touches Firestore. firestore.rules checks each write;
// tests/rules/brawl.test.ts mirrors them. Writes go over plain HTTPS, and the room and the
// handshake are also read that way every few seconds, so a phone whose Firestore stream
// has stalled still connects (src/services/resilient.ts says why).

export interface Brawl {
  code: string;
  host: string;
  playerIds: string[];
  names: Record<string, string>;
  status: 'lobby' | 'playing' | 'done';
  seed: string | null;
  /** How the fight is won, chosen by the host (older rooms have none: the default). */
  rules: Rules;
}

const brawlRef = (code: string) => restDoc('brawls', code);
const signalRef = (code: string, id: string) => restDoc('brawls', code, 'signals', id);
const signals = (code: string) => rest.collection(dbRest, 'brawls', code, 'signals');

function me() {
  const { uid, player } = useGameStore.getState();
  if (!uid || !player) throw new Error('Not connected yet. Try again in a moment.');
  return { uid, name: player.displayName };
}

export async function createBrawl(): Promise<string> {
  const { uid, name } = me();
  for (let tries = 0; tries < 5; tries++) {
    const code = newCode();
    try {
      await rest.setDoc(brawlRef(code), { host: uid, playerIds: [uid], names: { [uid]: name }, status: 'lobby', createdAt: rest.serverTimestamp() });
      return code;
    } catch (error) {
      if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
    }
  }
  throw new Error('Could not open a room. Try again.');
}

/** Joins as the second player. Returns why not, if you can't. */
export async function joinBrawl(code: string): Promise<string | null> {
  const { uid, name } = me();
  const snap = await rest.getDoc(brawlRef(code));
  if (!snap.exists()) return 'No room with that code.';
  const room = snap.data();
  if ((room.playerIds as string[]).includes(uid)) return null;
  if (room.status !== 'lobby' || room.playerIds.length >= 2) return 'That fight is full.';
  await rest.updateDoc(brawlRef(code), {
    playerIds: [...room.playerIds, uid],
    names: { ...room.names, [uid]: name },
  });
  poke(`brawls/${code}`);
  return null;
}

/** Starts the fight with a fresh seed and the host's rules; both phones build the match from these. */
export async function startBrawl(code: string, rules: Rules) {
  const seed = Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');
  await rest.updateDoc(brawlRef(code), { status: 'playing', seed, rules: { mode: rules.mode, value: rules.value }, startedAt: rest.serverTimestamp() });
  poke(`brawls/${code}`);
}

export async function finishBrawl(code: string) {
  await rest.updateDoc(brawlRef(code), { status: 'done', endedAt: rest.serverTimestamp() });
}

export const newRematchSeed = () => Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');

export interface BrawlData {
  room: Brawl | null;
  missing: boolean;
}

export function watchBrawl(code: string, onChange: (data: BrawlData) => void): Unsubscribe {
  let heard = 0;
  const take = (snap: Snap) => {
    if (!snap.exists()) return onChange({ room: null, missing: true });
    const d = snap.data()!;
    onChange({
      room: {
        code,
        host: d.host as string,
        playerIds: d.playerIds as string[],
        names: d.names as Record<string, string>,
        status: d.status as Brawl['status'],
        seed: (d.seed as string | undefined) ?? null,
        rules: (d.rules as Rules | undefined) ?? DEFAULT_RULES,
      },
      missing: false,
    });
  };
  let status = 'lobby';
  return keepFresh(
    `brawls/${code}`,
    (fail) =>
      onSnapshot(
        doc(db, 'brawls', code),
        (snap) => {
          heard++;
          status = (snap.get('status') as string | undefined) ?? status;
          take(snap);
        },
        fail,
      ),
    async () => {
      const before = heard;
      const snap = await rest.getDoc(brawlRef(code));
      if (heard === before) take(snap);
    },
    // Once the fight is on, the phones talk directly; the room only matters again after.
    { active: () => status === 'lobby' },
  );
}

// ---------- The connection ----------

/** Free public STUN only: no relay, so some pairs of networks can't connect (chosen by the user). */
const ICE: RTCConfiguration = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };
/** How long the phones get to find each other once both halves of the handshake are written. */
export const CONNECT_MS = 10_000;

const signalId = (kind: 'offer' | 'answer', attempt: number) => (attempt === 0 ? kind : `${kind}-${attempt}`);

/** Waits for the browser to gather every way it can be reached, so one write carries them all. */
function gathered(pc: RTCPeerConnection) {
  return new Promise<void>((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const done = () => {
      if (pc.iceGatheringState !== 'complete') return;
      pc.removeEventListener('icegatheringstatechange', done);
      resolve();
    };
    pc.addEventListener('icegatheringstatechange', done);
    // Some networks never finish; what's gathered by then is usually enough.
    setTimeout(resolve, 3000);
  });
}

function opened(channel: RTCDataChannel) {
  return new Promise<void>((resolve, reject) => {
    if (channel.readyState === 'open') return resolve();
    channel.addEventListener('open', () => resolve(), { once: true });
    channel.addEventListener('close', () => reject(new Error('closed')), { once: true });
    setTimeout(() => reject(new Error('timeout')), CONNECT_MS);
  });
}

/** Resolves with a handshake document once it exists: heard live, or read over HTTPS every 2 s. */
function whenWritten(code: string, id: string, signal: AbortSignal) {
  return new Promise<string>((resolve, reject) => {
    if (signal.aborted) return reject(new Error('aborted'));
    let done = false;
    const finish = (sdp: string) => {
      if (done) return;
      done = true;
      stop();
      clearInterval(timer);
      resolve(sdp);
    };
    const stop = onSnapshot(
      doc(db, 'brawls', code, 'signals', id),
      (snap) => snap.exists() && finish(snap.data().sdp as string),
      // The reads below carry on without the listener.
      () => {},
    );
    const timer = setInterval(() => {
      void rest.getDoc(signalRef(code, id)).then(
        (snap) => snap.exists() && finish(snap.get('sdp') as string),
        () => {},
      );
    }, 2000);
    signal.addEventListener('abort', () => {
      if (done) return;
      done = true;
      stop();
      clearInterval(timer);
      reject(new Error('aborted'));
    });
  });
}

export interface Link {
  channel: RTCDataChannel;
  close: () => void;
}

/**
 * Connects to the other phone. The host writes an offer and waits for the answer; the
 * guest waits for the offer and answers it. Each attempt has its own pair of documents, so
 * "Try again" starts clean. Rejects with 'timeout' if the phones can't reach each other.
 */
export async function connect(code: string, host: boolean, attempt: number, signal: AbortSignal): Promise<Link> {
  // Cancelled (the screen closed, or a newer attempt began): stop before writing anything more.
  const check = () => {
    if (signal.aborted) throw new Error('aborted');
  };
  check();
  const pc = new RTCPeerConnection(ICE);
  const close = () => pc.close();
  signal.addEventListener('abort', close);
  try {
    let channel: RTCDataChannel;
    if (host) {
      // Unordered and never resent: a late input is useless, and the next message repeats it.
      channel = pc.createDataChannel('fight', { ordered: false, maxRetransmits: 0 });
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc);
      check();
      await rest.setDoc(signalRef(code, signalId('offer', attempt)), { sdp: pc.localDescription!.sdp, at: rest.serverTimestamp() });
      const answer = await whenWritten(code, signalId('answer', attempt), signal);
      check();
      await pc.setRemoteDescription({ type: 'answer', sdp: answer });
    } else {
      const arrived = new Promise<RTCDataChannel>((resolve) => pc.addEventListener('datachannel', (e) => resolve(e.channel), { once: true }));
      const offer = await whenWritten(code, signalId('offer', attempt), signal);
      await pc.setRemoteDescription({ type: 'offer', sdp: offer });
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      check();
      await rest.setDoc(signalRef(code, signalId('answer', attempt)), { sdp: pc.localDescription!.sdp, at: rest.serverTimestamp() });
      channel = await Promise.race([
        arrived,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), CONNECT_MS)),
      ]);
    }
    await opened(channel);
    return { channel, close };
  } catch (error) {
    close();
    throw error;
  }
}

/** The newest handshake attempt the host has started: the guest answers that one. */
export function watchAttempts(code: string, onAttempt: (attempt: number) => void): Unsubscribe {
  const take = (ids: string[]) => {
    let newest = -1;
    for (const id of ids) {
      const m = /^offer(?:-(\d))?$/.exec(id);
      if (m) newest = Math.max(newest, m[1] ? Number(m[1]) : 0);
    }
    if (newest >= 0) onAttempt(newest);
  };
  let known = 0;
  return keepFresh(
    `brawls/${code}/signals`,
    (fail) =>
      onSnapshot(
        collection(db, 'brawls', code, 'signals'),
        (snap) => {
          known = snap.size;
          take(snap.docs.map((d) => d.id));
        },
        fail,
      ),
    async (relisten) => {
      // One read to count them; the documents only when there are new ones.
      if ((await rest.getCount(signals(code))).data().count === known) return;
      const snap = await rest.getDocs(signals(code));
      known = snap.size;
      take(snap.docs.map((d) => d.id));
      relisten();
    },
  );
}

export const MAX_ATTEMPTS = 10;

/** The host's next handshake attempt: one past the newest offer already written. */
export async function nextAttempt(code: string): Promise<number> {
  const snap = await rest.getDocs(signals(code));
  let next = 0;
  for (const d of snap.docs) {
    const m = /^offer(?:-(\d))?$/.exec(d.id);
    if (m) next = Math.max(next, (m[1] ? Number(m[1]) : 0) + 1);
  }
  return next;
}
