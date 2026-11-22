import { rest, restDoc } from './resilient';

// The live room games (Pig Lasso, Short Order) play on the server's clock: each phone
// measures how far its own clock is from the server's.

/** Gives up on a request that hasn't answered in `ms` (a phone's connection can hang without failing). */
function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms))]);
}

const millis = (t: unknown) => (t && typeof (t as { toMillis?: unknown }).toMillis === 'function' ? (t as { toMillis(): number }).toMillis() : null);

/**
 * How far the server's clock is ahead of this phone's, in ms, or null if it couldn't tell:
 * stamps the room's heartbeat with the server's time and reads it back, a few times,
 * trusting the quickest round trip. A sample that fails or hangs is skipped.
 */
export async function measureRoomClock(collection: string, code: string): Promise<number | null> {
  const ref = restDoc(collection, code);
  let best: { rtt: number; offset: number } | null = null;
  for (let i = 0; i < 3; i++) {
    try {
      const sent = Date.now();
      await within(rest.updateDoc(ref, { seenAt: rest.serverTimestamp() }), 4000);
      const back = Date.now();
      const snap = await within(rest.getDoc(ref), 4000);
      const seenAt = millis(snap.data()?.seenAt);
      // The stamp was made somewhere in the write's round trip; the read adds nothing to that.
      if (seenAt !== null && (!best || back - sent < best.rtt)) best = { rtt: back - sent, offset: seenAt - (sent + back) / 2 };
    } catch {
      // Offline for a moment, or the request hung: try the next sample.
    }
  }
  return best?.offset ?? null;
}
