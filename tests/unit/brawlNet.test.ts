import { describe, expect, it } from 'vitest';
import { DOWN, JUMP, LEFT, RIGHT, SKILL1, SKILL2, type Input } from '../../src/games/brawl/input';
import { decode, encode, type Message } from '../../src/games/brawl/net';
import { INPUT_DELAY, MAX_ROLLBACK, Session } from '../../src/games/brawl/rollback';
import { SUB } from '../../src/games/brawl/stage';
import { hashState, newMatch, step, type Match } from '../../src/games/brawl/state';
import { stream } from '../../src/nonogram/rng';

/** Two fighters close together, so the scripted thumbs trade blows. */
function start(): Match {
  const m = newMatch('online', [{ bot: 0 }, { bot: 0 }]);
  return { ...m, fighters: m.fighters.map((f, i) => ({ ...f, x: (i === 0 ? -30 : 30) * SUB })) };
}

/** What each seat's thumb does at the moment frame `f` is played locally: different on each side. */
const thumb = (seat: number, f: number): Input => {
  const a = [SKILL1 | RIGHT, 0, SKILL1, RIGHT, SKILL2 | RIGHT, LEFT, SKILL1 | LEFT, JUMP, SKILL1 | DOWN, RIGHT][Math.floor(f / 6) % 10];
  const b = [SKILL1 | LEFT, LEFT, SKILL1, SKILL2 | LEFT, 0, SKILL1 | RIGHT, JUMP, SKILL1, RIGHT][Math.floor(f / 5) % 9];
  // Actions only on the first frame of each stretch, like a tap.
  const raw = seat === 0 ? a : b;
  const first = seat === 0 ? f % 6 === 0 : f % 5 === 0;
  return first ? raw : raw & (LEFT | RIGHT | DOWN);
};

/** The fight with every input known in advance: what both phones must end up agreeing on. */
function lockstep(frames: number): Match {
  let m = start();
  for (let f = 0; f < frames && m.winner === null; f++) {
    const at = (seat: number) => (f < INPUT_DELAY ? 0 : thumb(seat, f - INPUT_DELAY));
    m = step(m, [at(0), at(1)]);
  }
  return m;
}

interface Link {
  latency: number;
  jitter: number;
  loss: number;
}

/** Two sessions over a lossy, jittery link, ticked together; B may start late. */
function run(link: Link, frames: number, opts: { lateStart?: number; seed?: string } = {}) {
  const roll = stream(opts.seed ?? 'link');
  const sessions = [new Session(start(), 0), new Session(start(), 1)];
  const queue: { at: number; to: number; text: string }[] = [];
  let maxLead = 0;
  const send = (from: number, msg: Message, now: number, lossy: boolean) => {
    if (lossy && roll(1000) < link.loss * 1000) return;
    queue.push({ at: now + link.latency + roll(link.jitter + 1), to: 1 - from, text: encode(msg) });
  };
  let now = 0;
  const tick = (lossy: boolean) => {
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].at > now) continue;
      const { to, text } = queue[i];
      queue.splice(i, 1);
      sessions[to].receive(decode(text)!);
    }
    sessions.forEach((s, seat) => {
      if (seat === 1 && now < (opts.lateStart ?? 0)) return;
      s.settle();
      if (s.match.frame < frames && s.canAdvance() && !s.shouldWait()) s.advance(thumb(seat, s.match.frame));
      send(seat, s.inputMessage(), now, lossy);
      for (const m of s.takeOutbox()) send(seat, m, now, lossy);
    });
    maxLead = Math.max(maxLead, Math.abs(sessions[0].match.frame - sessions[1].match.frame));
    now++;
  };
  for (let guard = 0; guard < frames * 4 && sessions.some((s) => s.match.frame < frames && s.match.winner === null); guard++) tick(true);
  // Let the last messages arrive, then settle.
  for (let i = 0; i < 40; i++) tick(false);
  return { sessions, maxLead };
}

describe('Sky Brawl online messages', () => {
  it('round-trip, and refuse anything malformed', () => {
    const msgs: Message[] = [
      { t: 'in', round: 0, from: 12, inputs: [0, 3, 255], frame: 14, lead: -1, ack: 9 },
      { t: 'hash', round: 2, frame: 60, hash: 'a1b2c3' },
      { t: 'rematch', round: 1, seed: 'abc123def' },
      { t: 'bye' },
    ];
    for (const m of msgs) expect(decode(encode(m))).toEqual(m);
    for (const bad of ['nope', '{}', '["i",0,0,[300],1,0,0]', '["i",0,-1,[],1,0,0]', '["h",0,1,{}]', '["r",0,"x"]', '["?"]']) expect(decode(bad)).toBeNull();
  });
});

describe('Sky Brawl rollback', () => {
  const frames = 600;
  const truth = hashState(lockstep(frames));

  it('scripts a real fight, with hits both ways', () => {
    const m = lockstep(frames);
    expect(m.fighters[0].dealt).toBeGreaterThan(0);
    expect(m.fighters[1].dealt).toBeGreaterThan(0);
  });

  for (const [name, link] of [
    ['a perfect link', { latency: 0, jitter: 0, loss: 0 }],
    ['a short delay', { latency: 2, jitter: 1, loss: 0 }],
    ['a long, jittery delay that reorders packets', { latency: 5, jitter: 4, loss: 0 }],
    ['a link that drops packets', { latency: 3, jitter: 2, loss: 0.15 }],
  ] as const) {
    it(`agrees with the true fight over ${name}`, () => {
      const { sessions } = run(link, frames);
      for (const s of sessions) {
        expect(s.desync).toBe(false);
        expect(hashState(s.match)).toBe(truth);
      }
    });
  }

  it('waits rather than run more than a few frames ahead of the other phone', () => {
    const lonely = new Session(start(), 0);
    let steps = 0;
    while (lonely.canAdvance() && steps < 100) {
      lonely.advance(RIGHT);
      steps++;
    }
    expect(lonely.match.frame).toBe(INPUT_DELAY + MAX_ROLLBACK);
  });

  it('brings a phone that started late back level', () => {
    const { sessions, maxLead } = run({ latency: 2, jitter: 1, loss: 0 }, frames, { lateStart: 6 });
    expect(maxLead).toBeLessThanOrEqual(MAX_ROLLBACK + INPUT_DELAY);
    for (const s of sessions) expect(hashState(s.match)).toBe(truth);
  });

  it('ignores late messages from the fight before', () => {
    const s = new Session(start(), 0, 1);
    s.receive({ t: 'in', round: 0, from: 0, inputs: Array(20).fill(SKILL1), frame: 20, lead: 0, ack: 0 });
    expect(s.heard).toBe(INPUT_DELAY);
  });

  it('notices when the other phone has a different fight', () => {
    const s = new Session(start(), 0);
    s.receive({ t: 'hash', round: 0, frame: 60, hash: 'bogus' });
    for (let f = 0; f < 70; f++) {
      s.receive({ t: 'in', round: 0, from: f, inputs: [0], frame: f, lead: 0, ack: f });
      s.advance(0);
    }
    expect(s.desync).toBe(true);
    expect(s.canAdvance()).toBe(false);
  });
});
