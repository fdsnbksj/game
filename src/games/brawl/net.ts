/**
 * What two phones say to each other during an online fight, over a WebRTC data channel
 * that may drop or reorder anything. Every message stands on its own: inputs are resent
 * until the other side says it has them.
 */
export type Message =
  /**
   * Inputs from frame `from` on, the sender's current frame and lead, and the last of ours
   * it has. `round` counts fights on this connection, so a late message from the last one
   * is ignored.
   */
  | { t: 'in'; round: number; from: number; inputs: number[]; frame: number; lead: number; ack: number }
  /** A fingerprint of the match at a frame both have settled. */
  | { t: 'hash'; round: number; frame: number; hash: string }
  /** The host starts another fight with a new seed. */
  | { t: 'rematch'; round: number; seed: string }
  | { t: 'bye' };

export function encode(m: Message): string {
  switch (m.t) {
    case 'in':
      return JSON.stringify(['i', m.round, m.from, m.inputs, m.frame, m.lead, m.ack]);
    case 'hash':
      return JSON.stringify(['h', m.round, m.frame, m.hash]);
    case 'rematch':
      return JSON.stringify(['r', m.round, m.seed]);
    case 'bye':
      return '["b"]';
  }
}

const isInt = (n: unknown): n is number => Number.isInteger(n);

/** A message, or null for anything malformed (an old version, or a tampered phone). */
export function decode(text: string): Message | null {
  let a: unknown;
  try {
    a = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(a)) return null;
  switch (a[0]) {
    case 'i': {
      const [, round, from, inputs, frame, lead, ack] = a;
      if (!isInt(round) || !isInt(from) || from < 0 || !Array.isArray(inputs) || inputs.length > 64) return null;
      if (!inputs.every((x) => isInt(x) && x >= 0 && x < 256)) return null;
      if (!isInt(frame) || !isInt(lead) || !isInt(ack)) return null;
      return { t: 'in', round, from, inputs, frame, lead, ack };
    }
    case 'h':
      return isInt(a[1]) && isInt(a[2]) && typeof a[3] === 'string' && a[3].length <= 16 ? { t: 'hash', round: a[1], frame: a[2], hash: a[3] } : null;
    case 'r':
      return isInt(a[1]) && typeof a[2] === 'string' && a[2].length >= 6 && a[2].length <= 40 ? { t: 'rematch', round: a[1], seed: a[2] } : null;
    case 'b':
      return { t: 'bye' };
    default:
      return null;
  }
}
