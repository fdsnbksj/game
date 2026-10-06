import { FirebaseError } from 'firebase/app';
import { collection, doc, getDoc, getDocs, onSnapshot, serverTimestamp, setDoc, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import { useGameStore } from '../store';
import { newCode } from './roomCode';

// Sky Brawl online: two phones fight each other directly over WebRTC. Firestore holds only
// the room (brawls/{code}: who's in, the seed) and one handshake each way
// (brawls/{code}/signals/offer and /answer, the whole connection offer in one write). The
// fight itself never touches Firestore. firestore.rules checks each write;
// tests/rules/brawl.test.ts mirrors them.

export interface Brawl {
  code: string;
  host: string;
  playerIds: string[];
  names: Record<string, string>;
  status: 'lobby' | 'playing' | 'done';
  seed: string | null;
}

const brawlRef = (code: string) => doc(db, 'brawls', code);
const signalRef = (code: string, id: string) => doc(db, 'brawls', code, 'signals', id);

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
      await setDoc(brawlRef(code), { host: uid, playerIds: [uid], names: { [uid]: name }, status: 'lobby', createdAt: serverTimestamp() });
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
  const snap = await getDoc(brawlRef(code));
  if (!snap.exists()) return 'No room with that code.';
  const room = snap.data();
  if ((room.playerIds as string[]).includes(uid)) return null;
  if (room.status !== 'lobby' || room.playerIds.length >= 2) return 'That fight is full.';
  await updateDoc(brawlRef(code), {
    playerIds: [...room.playerIds, uid],
    names: { ...room.names, [uid]: name },
  });
  return null;
}

export async function startBrawl(code: string) {
  const seed = Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');
  await updateDoc(brawlRef(code), { status: 'playing', seed, startedAt: serverTimestamp() });
}

export async function finishBrawl(code: string) {
  await updateDoc(brawlRef(code), { status: 'done', endedAt: serverTimestamp() });
}

export const newRematchSeed = () => Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');

export interface BrawlData {
  room: Brawl | null;
  missing: boolean;
}

export function watchBrawl(code: string, onChange: (data: BrawlData) => void): Unsubscribe {
  return onSnapshot(
    brawlRef(code),
    (snap) => {
      if (!snap.exists()) return onChange({ room: null, missing: true });
      const d = snap.data();
      onChange({
        room: { code, host: d.host, playerIds: d.playerIds, names: d.names, status: d.status, seed: d.seed ?? null },
        missing: false,
      });
    },
    () => onChange({ room: null, missing: true }),
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

/** Resolves with the first snapshot of a document that exists. */
function whenWritten(code: string, id: string, signal: AbortSignal) {
  return new Promise<string>((resolve, reject) => {
    if (signal.aborted) return reject(new Error('aborted'));
    const stop = onSnapshot(
      signalRef(code, id),
      (snap) => {
        if (!snap.exists()) return;
        stop();
        resolve(snap.data().sdp as string);
      },
      (error) => {
        stop();
        reject(error);
      },
    );
    signal.addEventListener('abort', () => {
      stop();
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
      await setDoc(signalRef(code, signalId('offer', attempt)), { sdp: pc.localDescription!.sdp, at: serverTimestamp() });
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
      await setDoc(signalRef(code, signalId('answer', attempt)), { sdp: pc.localDescription!.sdp, at: serverTimestamp() });
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
  return onSnapshot(
    collection(db, 'brawls', code, 'signals'),
    (snap) => {
      let newest = -1;
      for (const d of snap.docs) {
        const m = /^offer(?:-(\d))?$/.exec(d.id);
        if (m) newest = Math.max(newest, m[1] ? Number(m[1]) : 0);
      }
      if (newest >= 0) onAttempt(newest);
    },
    () => {},
  );
}

export const MAX_ATTEMPTS = 10;

/** The host's next handshake attempt: one past the newest offer already written. */
export async function nextAttempt(code: string): Promise<number> {
  const snap = await getDocs(collection(db, 'brawls', code, 'signals'));
  let next = 0;
  for (const d of snap.docs) {
    const m = /^offer(?:-(\d))?$/.exec(d.id);
    if (m) next = Math.max(next, (m[1] ? Number(m[1]) : 0) + 1);
  }
  return next;
}
