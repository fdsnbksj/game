import { HELD, type Input } from './input';
import type { Message } from './net';
import { hashState, step, type Match } from './state';

/**
 * Rollback for a fight between two phones. Each phone runs the whole match with `step()`.
 * Its own thumb's input is used a couple of frames late (INPUT_DELAY), which hides most of
 * the network's delay. The other player's input, when it hasn't arrived yet, is guessed:
 * they're still holding the same direction. When the real input turns up and the guess was
 * wrong, the match goes back to that frame and plays forward again with the truth, all
 * within one screen refresh. A phone too far ahead of what it has heard waits.
 */
export const INPUT_DELAY = 2;
export const MAX_ROLLBACK = 10;
const KEEP = 16;
export const HASH_EVERY = 60;
/** How many unacknowledged inputs one message carries, at most. */
const RESEND = 30;

export class Session {
  match: Match;
  readonly local: number;
  readonly remote: number;
  /** Known inputs per seat, by frame. */
  private inputs: [Map<number, Input>, Map<number, Input>] = [new Map(), new Map()];
  /** The other player's input each simulated frame was played with, guessed or known. */
  private used = new Map<number, Input>();
  /** The match as it stood at the start of each recent frame. */
  private saved = new Map<number, Match>();
  /** Every frame before this one has the other player's real input. */
  heard: number;
  /** The last of our inputs the other phone has. */
  private acked = -1;
  /** The earliest frame played with a wrong guess, waiting to be played again. */
  private redoFrom: number | null = null;
  /** How far ahead the other phone says it is, and how far ahead we are. */
  private theirLead = 0;
  private theirFrame = 0;
  private hashedUpTo = 0;
  private hashes = { mine: new Map<number, string>(), theirs: new Map<number, string>() };
  private outbox: Message[] = [];
  desync = false;

  /** Which fight on this connection; messages from another are ignored. */
  readonly round: number;

  constructor(match: Match, local: number, round = 0) {
    this.match = match;
    this.local = local;
    this.round = round;
    this.remote = 1 - local;
    for (let f = 0; f < INPUT_DELAY; f++) {
      this.inputs[0].set(f, 0);
      this.inputs[1].set(f, 0);
    }
    this.heard = INPUT_DELAY;
  }

  /** The newest frame with our own input. */
  get latestLocal() {
    return this.match.frame + INPUT_DELAY - 1;
  }

  /** Our lead over the other phone, as of what we last heard. */
  get lead() {
    return this.match.frame - this.theirFrame;
  }

  /** False while too far ahead of what we've heard: wait for the other phone. */
  canAdvance() {
    return !this.desync && this.match.winner === null && this.match.frame - this.heard < MAX_ROLLBACK;
  }

  /** The fight is over for certain: someone won, and every input that led there is real. */
  get over() {
    return this.match.winner !== null && this.redoFrom === null && this.heard >= this.match.frame;
  }

  /**
   * True on the odd frame a phone that keeps running ahead should sit out, so the two
   * drift back level without either one stalling hard.
   */
  shouldWait() {
    const gap = (this.lead - this.theirLead) / 2;
    return gap >= 1 && this.match.frame % 30 === 0;
  }

  private remoteInput(frame: number): Input {
    const known = this.inputs[this.remote].get(frame);
    if (known !== undefined) return known;
    // Still holding what they held last (the stick, a charging heavy); a press is a moment, so it isn't repeated.
    return (this.inputs[this.remote].get(this.heard - 1) ?? 0) & HELD;
  }

  private play(m: Match): Match {
    const f = m.frame;
    const mine = this.inputs[this.local].get(f) ?? 0;
    const theirs = this.remoteInput(f);
    this.used.set(f, theirs);
    this.saved.set(f, m);
    const both: Input[] = [];
    both[this.local] = mine;
    both[this.remote] = theirs;
    return step(m, both);
  }

  /** Plays again from the first wrong guess, if any. Called before advancing, and on its own while waiting. */
  settle() {
    if (this.redoFrom === null) return;
    const from = this.redoFrom;
    this.redoFrom = null;
    let m = this.saved.get(from);
    if (!m) return;
    const to = this.match.frame;
    // A guessed knockout can turn out not to have happened (or happen sooner): the replay decides.
    while (m.frame < to && m.winner === null) m = this.play(m);
    this.match = m;
    this.checkHashes();
  }

  /** One frame on, with this frame's thumb (used INPUT_DELAY frames from now). */
  advance(input: Input) {
    this.settle();
    if (!this.canAdvance()) return;
    this.inputs[this.local].set(this.match.frame + INPUT_DELAY, input);
    this.match = this.play(this.match);
    for (const f of this.saved.keys()) if (f < this.match.frame - KEEP) this.saved.delete(f);
    for (const f of this.used.keys()) if (f < this.heard - KEEP) this.used.delete(f);
    for (const map of this.inputs) for (const f of map.keys()) if (f < Math.min(this.heard, this.acked) - KEEP) map.delete(f);
    this.checkHashes();
  }

  receive(msg: Message) {
    if ((msg.t === 'hash' || msg.t === 'in') && msg.round !== this.round) return;
    if (msg.t === 'hash') {
      this.hashes.theirs.set(msg.frame, msg.hash);
      this.compare(msg.frame);
      return;
    }
    if (msg.t !== 'in') return;
    this.acked = Math.max(this.acked, msg.ack);
    if (msg.frame >= this.theirFrame) {
      this.theirFrame = msg.frame;
      this.theirLead = msg.lead;
    }
    const theirs = this.inputs[this.remote];
    msg.inputs.forEach((input, i) => {
      const f = msg.from + i;
      if (f < this.heard || theirs.has(f)) return;
      theirs.set(f, input);
      const guessed = this.used.get(f);
      if (f < this.match.frame && guessed !== undefined && guessed !== input) {
        this.redoFrom = this.redoFrom === null ? f : Math.min(this.redoFrom, f);
      }
    });
    while (theirs.has(this.heard)) this.heard++;
  }

  /** Our inputs the other phone hasn't confirmed yet, and where we are. */
  inputMessage(): Message {
    const latest = this.latestLocal;
    const from = Math.max(0, this.acked + 1, latest - RESEND + 1);
    const inputs: number[] = [];
    for (let f = from; f <= latest; f++) inputs.push(this.inputs[this.local].get(f) ?? 0);
    return { t: 'in', round: this.round, from, inputs, frame: this.match.frame, lead: this.lead, ack: this.heard - 1 };
  }

  /** Messages to send besides inputs (fingerprints), emptied as they're taken. */
  takeOutbox(): Message[] {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }

  /** Fingerprints every HASH_EVERY frames, once every input before them is known. */
  private checkHashes() {
    if (this.redoFrom !== null) return;
    while (this.hashedUpTo + HASH_EVERY <= Math.min(this.match.frame, this.heard)) {
      const f = this.hashedUpTo + HASH_EVERY;
      this.hashedUpTo = f;
      const m = f === this.match.frame ? this.match : this.saved.get(f);
      if (!m) continue;
      const hash = hashState(m);
      this.hashes.mine.set(f, hash);
      this.outbox.push({ t: 'hash', round: this.round, frame: f, hash });
      this.compare(f);
    }
  }

  private compare(frame: number) {
    const mine = this.hashes.mine.get(frame);
    const theirs = this.hashes.theirs.get(frame);
    if (mine === undefined || theirs === undefined) return;
    if (mine !== theirs) this.desync = true;
    this.hashes.mine.delete(frame);
    this.hashes.theirs.delete(frame);
  }
}
