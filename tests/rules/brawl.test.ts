import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { dayId } from '../../src/shared/constants';
import { BALANCE_VERSION, START_HP } from '../../src/sim/balance';
import { stageDamage } from '../../src/sim/economy';
import type { BoardSnapshot } from '../../src/sim/validate';

let env: RulesTestEnvironment;

const asModular = (db: unknown) => db as Firestore;
const dbFor = (uid: string) => asModular(env.authenticatedContext(uid).firestore());
const hourAgo = () => Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
const TODAY = dayId();

async function asAdmin(write: (db: Firestore) => Promise<unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await write(asModular(ctx.firestore()));
  });
}

async function seedPlayer(uid: string, runsStarted = 0, lastRunStartAt = hourAgo()) {
  await asAdmin((db) => setDoc(doc(db, 'players', uid), { displayName: 'Alice', createdAt: hourAgo(), runsStarted, lastRunStartAt }));
}

interface RunState {
  round: number;
  hp: number;
  wins: number;
  done?: boolean;
  lastAt?: Timestamp;
}

const rounds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const board = (units: [string, number][], lv = units.length, cells?: number[], items?: [number, string][]): BoardSnapshot => ({
  lv,
  u: units.map(([id]) => id),
  c: cells ?? units.map((_, i) => i),
  s: units.map(([, star]) => star),
  o: 'ai',
  ...(items ? { it: items.map(([, id]) => id), ia: items.map(([slot]) => slot) } : {}),
});

/** A run partway through: `round` rounds already written. */
async function seedRun(uid: string, n: number, state: RunState) {
  const boards = Object.fromEntries(rounds(state.round).map((r) => [`r${r}`, board([['sparkmouse', 1]])]));
  await asAdmin((db) =>
    setDoc(doc(db, 'runs', `${uid}_${n}`), {
      uid,
      name: 'Alice',
      v: BALANCE_VERSION,
      rand: 42,
      round: state.round,
      rounds: rounds(state.round),
      boards,
      hp: state.hp,
      wins: state.wins,
      done: state.done ?? false,
      startedAt: hourAgo(),
      lastAt: state.lastAt ?? hourAgo(),
    }),
  );
}

/** Mirrors startOnlineRun() in src/services/runs.ts. */
function startRun(db: Firestore, uid: string, n: number, overrides: Record<string, unknown> = {}) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'players', uid), { runsStarted: n + 1, lastRunStartAt: serverTimestamp() });
  batch.set(doc(db, 'runs', `${uid}_${n}`), {
    uid,
    name: 'Alice',
    v: BALANCE_VERSION,
    rand: 12345,
    round: 0,
    rounds: [],
    boards: {},
    hp: START_HP,
    wins: 0,
    done: false,
    startedAt: serverTimestamp(),
    lastAt: serverTimestamp(),
    ...overrides,
  });
  return batch.commit();
}

interface RoundWrite {
  board?: BoardSnapshot;
  hp: number;
  wins: number;
  done?: boolean;
  /** Which round's key to write; defaults to the next one. */
  key?: number;
  ranking?: { day?: string; score?: number; wins?: number; round?: number; legacy?: boolean };
}

/** Mirrors syncRound() in src/services/runs.ts: the round's board and result, plus a ranking on the last one. */
function playRound(db: Firestore, uid: string, n: number, before: RunState, write: RoundWrite) {
  const next = before.round + 1;
  const runId = `${uid}_${n}`;
  const batch = writeBatch(db);
  batch.update(doc(db, 'runs', runId), {
    round: next,
    rounds: rounds(next),
    [`boards.r${write.key ?? next}`]: write.board ?? board([['sparkmouse', 1]]),
    hp: write.hp,
    wins: write.wins,
    done: write.done ?? false,
    lastAt: serverTimestamp(),
  });
  if (write.ranking) {
    // Legacy: what clients filed before rankings recorded the round (HP, always 0 by then).
    const { day = TODAY, wins = write.wins, round = next, legacy = false } = write.ranking;
    const score = write.ranking.score ?? wins * 1000 + (legacy ? write.hp : round);
    batch.set(doc(db, 'rankings', day, 'entries', uid), {
      score,
      wins,
      ...(legacy ? { hp: write.hp } : { round }),
      runId,
      displayName: 'Alice',
      submittedAt: serverTimestamp(),
    });
  }
  return batch.commit();
}

/** The daily challenge: one run per player per day, and no counter to bump. */
function startDaily(db: Firestore, uid: string, runId = `${uid}_d${TODAY}`, overrides: Record<string, unknown> = {}) {
  return setDoc(doc(db, 'runs', runId), {
    uid,
    name: 'Alice',
    mode: 'daily',
    day: TODAY,
    v: BALANCE_VERSION,
    rand: 7,
    round: 0,
    rounds: [],
    boards: {},
    hp: START_HP,
    wins: 0,
    done: false,
    startedAt: serverTimestamp(),
    lastAt: serverTimestamp(),
    ...overrides,
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-game',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(() => env.cleanup());

beforeEach(() => env.clearFirestore());

describe('players', () => {
  it('lets a new player create their profile', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor('alice'), 'players', 'alice'), {
        displayName: 'Alice',
        createdAt: serverTimestamp(),
        runsStarted: 0,
        lastRunStartAt: serverTimestamp(),
      }),
    );
  });

  it('rejects a profile that starts with runs', async () => {
    await assertFails(
      setDoc(doc(dbFor('alice'), 'players', 'alice'), {
        displayName: 'Alice',
        createdAt: serverTimestamp(),
        runsStarted: 3,
        lastRunStartAt: serverTimestamp(),
      }),
    );
  });

  it('lets a player rename themselves, and no one else', async () => {
    await seedPlayer('alice');
    await assertSucceeds(updateDoc(doc(dbFor('alice'), 'players', 'alice'), { displayName: 'Ally' }));
    await assertFails(updateDoc(doc(dbFor('mallory'), 'players', 'alice'), { displayName: 'Hacked' }));
  });

  it('keeps profiles private', async () => {
    await seedPlayer('alice');
    await assertFails(getDoc(doc(dbFor('bob'), 'players', 'alice')));
  });
});

describe('starting a run', () => {
  it('creates the run and counts it in one batch', async () => {
    await seedPlayer('alice', 2);
    await assertSucceeds(startRun(dbFor('alice'), 'alice', 2));
  });

  it('rejects a run without counting it', async () => {
    await seedPlayer('alice');
    const db = dbFor('alice');
    await assertFails(
      setDoc(doc(db, 'runs', 'alice_0'), {
        uid: 'alice', name: 'Alice', v: BALANCE_VERSION, rand: 1, round: 0, rounds: [], boards: {},
        hp: START_HP, wins: 0, done: false, startedAt: serverTimestamp(), lastAt: serverTimestamp(),
      }),
    );
  });

  it("rejects a run id that doesn't match the count", async () => {
    await seedPlayer('alice', 0);
    // A proper start of run 0, plus a second run slipped into the same batch under another id.
    const db = dbFor('alice');
    const batch = writeBatch(db);
    const fresh = {
      uid: 'alice', name: 'Alice', v: BALANCE_VERSION, rand: 1, round: 0, rounds: [], boards: {},
      hp: START_HP, wins: 0, done: false, startedAt: serverTimestamp(), lastAt: serverTimestamp(),
    };
    batch.update(doc(db, 'players', 'alice'), { runsStarted: 1, lastRunStartAt: serverTimestamp() });
    batch.set(doc(db, 'runs', 'alice_0'), fresh);
    batch.set(doc(db, 'runs', 'alice_5'), fresh);
    await assertFails(batch.commit());
  });

  it('rejects starting runs too quickly', async () => {
    await seedPlayer('alice', 1, Timestamp.now());
    await assertFails(startRun(dbFor('alice'), 'alice', 1));
  });

  it('rejects a run on another balance version', async () => {
    await seedPlayer('alice');
    await assertFails(startRun(dbFor('alice'), 'alice', 0, { v: BALANCE_VERSION + 1 }));
  });

  it('rejects a run that starts with extra health or wins', async () => {
    await seedPlayer('alice');
    await assertFails(startRun(dbFor('alice'), 'alice', 0, { hp: 150 }));
    await assertFails(startRun(dbFor('alice'), 'alice', 0, { wins: 3 }));
  });
});

describe('playing rounds', () => {
  const fresh: RunState = { round: 0, hp: 100, wins: 0 };

  beforeEach(async () => {
    await seedPlayer('alice', 1);
  });

  it('accepts a won round', async () => {
    await seedRun('alice', 0, fresh);
    await assertSucceeds(playRound(dbFor('alice'), 'alice', 0, fresh, { hp: 100, wins: 1 }));
  });

  it('accepts a lost round costing base damage plus surviving stars', async () => {
    const before = { round: 4, hp: 80, wins: 2 };
    await seedRun('alice', 0, before);
    await assertSucceeds(playRound(dbFor('alice'), 'alice', 0, before, { hp: 80 - stageDamage(5) - 6, wins: 2 }));
  });

  it('accepts being knocked out by less than the full damage', async () => {
    const before = { round: 9, hp: 3, wins: 4 };
    await seedRun('alice', 0, before);
    await assertSucceeds(playRound(dbFor('alice'), 'alice', 0, before, { hp: 0, wins: 4, done: true }));
  });

  it('accepts the most expensive legal board by round 15', async () => {
    const before = { round: 14, hp: 40, wins: 9 };
    await seedRun('alice', 0, before);
    // Six 1-cost 3-stars (54) + a 4-cost 3-star (36) + a 1-cost 2-star (3) = 93, plus 40 gold of XP for
    // level 8 by round 15: 133, exactly the most gold anyone can have had.
    const full = board([
      ['sparkmouse', 3], ['voltmoth', 3], ['glitchtoad', 3], ['chromeshell', 3],
      ['sparkmouse', 3], ['voltmoth', 3], ['thunderstag', 3], ['chromeshell', 2],
    ], 8);
    await assertSucceeds(playRound(dbFor('alice'), 'alice', 0, before, { board: full, hp: 40, wins: 10 }));
  });

  it('rejects a board one gold over what could have been earned', async () => {
    const before = { round: 14, hp: 40, wins: 9 };
    await seedRun('alice', 0, before);
    const over = board([
      ['sparkmouse', 3], ['voltmoth', 3], ['glitchtoad', 3], ['chromeshell', 3],
      ['sparkmouse', 3], ['voltmoth', 3], ['thunderstag', 3], ['thunderstag', 1],
    ], 8);
    await assertFails(playRound(dbFor('alice'), 'alice', 0, before, { board: over, hp: 40, wins: 10 }));
  });

  it('has no last round: round 15 with HP left carries on', async () => {
    const before = { round: 14, hp: 40, wins: 9 };
    await seedRun('alice', 0, before);
    await assertFails(playRound(dbFor('alice'), 'alice', 0, before, { hp: 40, wins: 10, done: true }));
    await assertSucceeds(playRound(dbFor('alice'), 'alice', 0, before, { hp: 40, wins: 10 }));
  });

  it('accepts rounds long past 15, within 11 more gold a round', async () => {
    const before = { round: 29, hp: 40, wins: 20 };
    await seedRun('alice', 0, before);
    // Round 30: 56 + 11 * 22 = 298. Seven 4-cost 3-stars (252) + a 3-cost 3-star (27) = 279, plus
    // 12 gold of XP for level 8 (58 XP came free by now): 291.
    const units: [string, number][] = [
      ['thunderstag', 3], ['sludgebear', 3], ['thunderstag', 3], ['sludgebear', 3],
      ['thunderstag', 3], ['sludgebear', 3], ['thunderstag', 3], ['staticfox', 3],
    ];
    await assertSucceeds(playRound(dbFor('alice'), 'alice', 0, before, { board: board(units, 8), hp: 40, wins: 21 }));
  });

  it('rejects a board over the gold budget long past round 15', async () => {
    const before = { round: 29, hp: 40, wins: 20 };
    await seedRun('alice', 0, before);
    // Seven 4-cost 3-stars (252) + a 5-cost 3-star (45) + 12 gold of XP = 309, more than 298.
    const units: [string, number][] = [
      ['thunderstag', 3], ['sludgebear', 3], ['thunderstag', 3], ['sludgebear', 3],
      ['thunderstag', 3], ['sludgebear', 3], ['thunderstag', 3], ['nullserpent', 3],
    ];
    await assertFails(playRound(dbFor('alice'), 'alice', 0, before, { board: board(units, 8), hp: 40, wins: 21 }));
  });

  it('lets items keep dropping every third round', async () => {
    const before = { round: 20, hp: 40, wins: 12 };
    await seedRun('alice', 0, before);
    // By round 21's planning, drops after rounds 2, 5, …, 20: seven items.
    const units: [string, number][] = Array.from({ length: 8 }, () => ['sparkmouse', 1]);
    const items = (n: number) => Array.from({ length: n }, (_, i): [number, string] => [i, 'razor_fang']);
    await assertFails(playRound(dbFor('alice'), 'alice', 0, before, { board: board(units, 8, undefined, items(8)), hp: 40, wins: 13 }));
    await assertSucceeds(playRound(dbFor('alice'), 'alice', 0, before, { board: board(units, 8, undefined, items(7)), hp: 40, wins: 13 }));
  });

  it('rejects a strong board early in a run', async () => {
    await seedRun('alice', 0, fresh);
    await assertFails(playRound(dbFor('alice'), 'alice', 0, fresh, { board: board([['nullserpent', 1]]), hp: 100, wins: 1 }));
  });

  it('rejects more units than the level allows', async () => {
    const before = { round: 6, hp: 100, wins: 6 };
    await seedRun('alice', 0, before);
    const crowded = board([['sparkmouse', 1], ['voltmoth', 1], ['glitchtoad', 1]], 2);
    await assertFails(playRound(dbFor('alice'), 'alice', 0, before, { board: crowded, hp: 100, wins: 7 }));
  });

  it('rejects two units on one cell, a cell off the board, an unknown unit or a 4-star', async () => {
    const before = { round: 6, hp: 100, wins: 6 };
    await seedRun('alice', 0, before);
    const db = dbFor('alice');
    const bad = [
      board([['sparkmouse', 1], ['voltmoth', 1]], 2, [3, 3]),
      board([['sparkmouse', 1]], 1, [28]),
      board([['pikachu', 1]]),
      board([['sparkmouse', 4]]),
    ];
    for (const b of bad) await assertFails(playRound(db, 'alice', 0, before, { board: b, hp: 100, wins: 7 }));
  });

  it('accepts items a run could have picked up by then', async () => {
    const before = { round: 6, hp: 90, wins: 4 };
    await seedRun('alice', 0, before);
    // Two items have dropped by round 7.
    const carried = board([['sparkmouse', 1], ['voltmoth', 1]], 4, [2, 3], [[0, 'razor_fang'], [1, 'volt_coil']]);
    await assertSucceeds(playRound(dbFor('alice'), 'alice', 0, before, { board: carried, hp: 90, wins: 5 }));
  });

  it('rejects more items than have dropped', async () => {
    const before = { round: 3, hp: 90, wins: 2 };
    await seedRun('alice', 0, before);
    // Only one item has dropped by round 4.
    const carried = board([['sparkmouse', 1], ['voltmoth', 1]], 4, [2, 3], [[0, 'razor_fang'], [1, 'volt_coil']]);
    await assertFails(playRound(dbFor('alice'), 'alice', 0, before, { board: carried, hp: 90, wins: 3 }));
  });

  it('rejects two items on one creature, or an item that does not exist', async () => {
    const before = { round: 6, hp: 90, wins: 4 };
    await seedRun('alice', 0, before);
    const db = dbFor('alice');
    const twoOnOne = board([['sparkmouse', 1], ['voltmoth', 1]], 4, [2, 3], [[0, 'razor_fang'], [0, 'volt_coil']]);
    const madeUp = board([['sparkmouse', 1]], 4, [2], [[0, 'excalibur']]);
    await assertFails(playRound(db, 'alice', 0, before, { board: twoOnOne, hp: 90, wins: 5 }));
    await assertFails(playRound(db, 'alice', 0, before, { board: madeUp, hp: 90, wins: 5 }));
  });

  it('accepts a board from a client that knows nothing about items', async () => {
    const before = { round: 6, hp: 90, wins: 4 };
    await seedRun('alice', 0, before);
    await assertSucceeds(playRound(dbFor('alice'), 'alice', 0, before, { hp: 90, wins: 5 }));
  });

  it('rejects skipping a round or rewriting an earlier one', async () => {
    const before = { round: 3, hp: 100, wins: 3 };
    await seedRun('alice', 0, before);
    await assertFails(playRound(dbFor('alice'), 'alice', 0, before, { hp: 100, wins: 4, key: 5 }));
    await assertFails(playRound(dbFor('alice'), 'alice', 0, before, { hp: 100, wins: 4, key: 2 }));
  });

  it("rejects changing an earlier round's board alongside the new one", async () => {
    const before = { round: 3, hp: 100, wins: 3 };
    await seedRun('alice', 0, before);
    await assertFails(
      updateDoc(doc(dbFor('alice'), 'runs', 'alice_0'), {
        round: 4,
        rounds: rounds(4),
        'boards.r4': board([['sparkmouse', 1]]),
        'boards.r2': board([['voltmoth', 1]]),
        hp: 100,
        wins: 4,
        done: false,
        lastAt: serverTimestamp(),
      }),
    );
  });

  it('rejects health going up', async () => {
    const before = { round: 3, hp: 60, wins: 1 };
    await seedRun('alice', 0, before);
    await assertFails(playRound(dbFor('alice'), 'alice', 0, before, { hp: 70, wins: 1 }));
  });

  it('rejects a loss that costs less than the base damage, or more than the most possible', async () => {
    const before = { round: 3, hp: 60, wins: 1 };
    await seedRun('alice', 0, before);
    const db = dbFor('alice');
    await assertFails(playRound(db, 'alice', 0, before, { hp: 60 - stageDamage(4) + 1, wins: 1 }));
    await assertFails(playRound(db, 'alice', 0, before, { hp: 60 - stageDamage(4) - 25, wins: 1 }));
  });

  it('rejects a win that also costs health, or two wins at once', async () => {
    const before = { round: 3, hp: 60, wins: 1 };
    await seedRun('alice', 0, before);
    await assertFails(playRound(dbFor('alice'), 'alice', 0, before, { hp: 55, wins: 2 }));
    await assertFails(playRound(dbFor('alice'), 'alice', 0, before, { hp: 60, wins: 3 }));
  });

  it('rejects rounds played too close together', async () => {
    const before = { round: 3, hp: 60, wins: 1, lastAt: Timestamp.now() };
    await seedRun('alice', 0, before);
    await assertFails(playRound(dbFor('alice'), 'alice', 0, before, { hp: 60, wins: 2 }));
  });

  it('rejects a finished flag that disagrees with the result', async () => {
    const before = { round: 9, hp: 3, wins: 4 };
    await seedRun('alice', 0, before);
    await assertFails(playRound(dbFor('alice'), 'alice', 0, before, { hp: 0, wins: 4, done: false }));
    await assertFails(playRound(dbFor('alice'), 'alice', 0, before, { hp: 3, wins: 5, done: true }));
  });

  it('rejects playing on after a run is over', async () => {
    const before = { round: 9, hp: 0, wins: 4, done: true };
    await seedRun('alice', 0, before);
    await assertFails(playRound(dbFor('alice'), 'alice', 0, before, { hp: 0, wins: 5, done: true }));
  });

  it("rejects writing another player's run", async () => {
    await seedRun('alice', 0, fresh);
    await assertFails(playRound(dbFor('mallory'), 'alice', 0, fresh, { hp: 100, wins: 1 }));
  });

  it("lets signed-in players read other players' runs, to fight them", async () => {
    await seedRun('alice', 0, fresh);
    await assertSucceeds(getDoc(doc(dbFor('bob'), 'runs', 'alice_0')));
  });
});

describe('the daily challenge', () => {
  beforeEach(() => seedPlayer('alice', 1));

  it("starts today's challenge without counting it as an ordinary run", async () => {
    await assertSucceeds(startDaily(dbFor('alice'), 'alice'));
  });

  it('rejects a challenge filed under the wrong id or day', async () => {
    const db = dbFor('alice');
    await assertFails(startDaily(db, 'alice', 'alice_d1999-01-01', { day: '1999-01-01' }));
    await assertFails(startDaily(db, 'alice', `alice_d${TODAY}`, { day: dayId(new Date(Date.now() - 7 * 86_400_000)) }));
    await assertFails(startDaily(db, 'alice', 'alice_0'));
  });

  it("rejects starting someone else's challenge", async () => {
    await assertFails(startDaily(dbFor('mallory'), 'alice'));
  });

  it('rejects a second challenge on the same day', async () => {
    await assertSucceeds(startDaily(dbFor('alice'), 'alice'));
    await assertFails(startDaily(dbFor('alice'), 'alice'));
  });

  it('files a finished challenge on the daily board, not the ordinary one', async () => {
    const before = { round: 14, hp: 5, wins: 8 };
    await asAdmin((db) =>
      setDoc(doc(db, 'runs', `alice_d${TODAY}`), {
        uid: 'alice', name: 'Alice', mode: 'daily', day: TODAY, v: BALANCE_VERSION, rand: 7,
        round: before.round, rounds: rounds(before.round),
        boards: Object.fromEntries(rounds(before.round).map((r) => [`r${r}`, board([['sparkmouse', 1]])])),
        hp: before.hp, wins: before.wins, done: false, startedAt: hourAgo(), lastAt: hourAgo(),
      }),
    );
    const db = dbFor('alice');
    const finish = (collectionName: string) => {
      const batch = writeBatch(db);
      batch.update(doc(db, 'runs', `alice_d${TODAY}`), {
        round: 15,
        rounds: rounds(15),
        'boards.r15': board([['sparkmouse', 1]]),
        hp: 0,
        wins: 8,
        done: true,
        lastAt: serverTimestamp(),
      });
      batch.set(doc(db, collectionName, TODAY, 'entries', 'alice'), {
        score: 8015, wins: 8, round: 15, runId: `alice_d${TODAY}`, displayName: 'Alice', submittedAt: serverTimestamp(),
      });
      return batch.commit();
    };
    await assertFails(finish('rankings'));
    await assertSucceeds(finish('dailyRankings'));
  });

  it("rejects filing a challenge under a day that isn't its own", async () => {
    const yesterday = dayId(new Date(Date.now() - 86_400_000));
    await asAdmin((db) =>
      setDoc(doc(db, 'runs', `alice_d${yesterday}`), {
        uid: 'alice', name: 'Alice', mode: 'daily', day: yesterday, v: BALANCE_VERSION, rand: 7,
        round: 14, rounds: rounds(14),
        boards: Object.fromEntries(rounds(14).map((r) => [`r${r}`, board([['sparkmouse', 1]])])),
        hp: 5, wins: 8, done: false, startedAt: hourAgo(), lastAt: hourAgo(),
      }),
    );
    const db = dbFor('alice');
    const fileUnder = (day: string) => {
      const batch = writeBatch(db);
      batch.update(doc(db, 'runs', `alice_d${yesterday}`), {
        round: 15, rounds: rounds(15), 'boards.r15': board([['sparkmouse', 1]]), hp: 0, wins: 8, done: true, lastAt: serverTimestamp(),
      });
      batch.set(doc(db, 'dailyRankings', day, 'entries', 'alice'), {
        score: 8015, wins: 8, round: 15, runId: `alice_d${yesterday}`, displayName: 'Alice', submittedAt: serverTimestamp(),
      });
      return batch.commit();
    };
    // Yesterday's challenge belongs on yesterday's board, not today's.
    await assertFails(fileUnder(TODAY));
    await assertSucceeds(fileUnder(yesterday));
  });

  it('rejects filing an ordinary run on the daily board', async () => {
    const before = { round: 14, hp: 5, wins: 8 };
    await seedRun('alice', 0, before);
    const db = dbFor('alice');
    const batch = writeBatch(db);
    batch.update(doc(db, 'runs', 'alice_0'), {
      round: 15, rounds: rounds(15), 'boards.r15': board([['sparkmouse', 1]]), hp: 0, wins: 8, done: true, lastAt: serverTimestamp(),
    });
    batch.set(doc(db, 'dailyRankings', TODAY, 'entries', 'alice'), {
      score: 8015, wins: 8, round: 15, runId: 'alice_0', displayName: 'Alice', submittedAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });
});

describe('rankings', () => {
  const last: RunState = { round: 14, hp: 5, wins: 8 };

  beforeEach(async () => {
    await seedPlayer('alice', 1);
    await seedRun('alice', 0, last);
  });

  it("accepts a finished run's result with its last round", async () => {
    await assertSucceeds(playRound(dbFor('alice'), 'alice', 0, last, { hp: 0, wins: 8, done: true, ranking: {} }));
  });

  it('rejects a result for a run still going', async () => {
    const midway = { round: 5, hp: 50, wins: 3 };
    await seedRun('alice', 1, midway);
    await assertFails(playRound(dbFor('alice'), 'alice', 1, midway, { hp: 50, wins: 4, ranking: {} }));
  });

  it('rejects a result not written with the run', async () => {
    await seedRun('alice', 1, { round: 15, hp: 0, wins: 8, done: true });
    await assertFails(
      setDoc(doc(dbFor('alice'), 'rankings', TODAY, 'entries', 'alice'), {
        score: 8015, wins: 8, round: 15, runId: 'alice_1', displayName: 'Alice', submittedAt: serverTimestamp(),
      }),
    );
  });

  it("rejects a score that doesn't match the run", async () => {
    // Wins and health are right; only the score is inflated.
    await assertFails(playRound(dbFor('alice'), 'alice', 0, last, { hp: 0, wins: 8, done: true, ranking: { score: 99999 } }));
  });

  it("rejects wins or a round that don't match the run", async () => {
    await assertFails(
      playRound(dbFor('alice'), 'alice', 0, last, { hp: 0, wins: 8, done: true, ranking: { wins: 15, score: 15015 } }),
    );
    await assertFails(
      playRound(dbFor('alice'), 'alice', 0, last, { hp: 0, wins: 8, done: true, ranking: { round: 30, score: 8030 } }),
    );
  });

  it('still accepts the HP-based result that older clients file', async () => {
    await assertSucceeds(playRound(dbFor('alice'), 'alice', 0, last, { hp: 0, wins: 8, done: true, ranking: { legacy: true } }));
  });

  it('rejects a result that mixes the two shapes', async () => {
    const db = dbFor('alice');
    const batch = writeBatch(db);
    batch.update(doc(db, 'runs', 'alice_0'), {
      round: 15, rounds: rounds(15), 'boards.r15': board([['sparkmouse', 1]]), hp: 0, wins: 8, done: true, lastAt: serverTimestamp(),
    });
    batch.set(doc(db, 'rankings', TODAY, 'entries', 'alice'), {
      score: 8015, wins: 8, round: 15, hp: 0, runId: 'alice_0', displayName: 'Alice', submittedAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });

  it("rejects a result below the player's best today", async () => {
    await asAdmin((db) =>
      setDoc(doc(db, 'rankings', TODAY, 'entries', 'alice'), {
        score: 12020, wins: 12, round: 20, runId: 'alice_x', displayName: 'Alice', submittedAt: hourAgo(),
      }),
    );
    await assertFails(playRound(dbFor('alice'), 'alice', 0, last, { hp: 0, wins: 8, done: true, ranking: {} }));
  });

  it('rejects a result filed under a day far from today', async () => {
    const lastWeek = dayId(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    await assertFails(
      playRound(dbFor('alice'), 'alice', 0, last, { hp: 0, wins: 8, done: true, ranking: { day: lastWeek } }),
    );
  });

  it("rejects filing someone else's run", async () => {
    await seedPlayer('mallory');
    const db = dbFor('mallory');
    await assertFails(
      setDoc(doc(db, 'rankings', TODAY, 'entries', 'mallory'), {
        score: 8015, wins: 8, round: 15, runId: 'alice_0', displayName: 'Alice', submittedAt: serverTimestamp(),
      }),
    );
  });

  it('lets signed-in players read the rankings', async () => {
    await assertSucceeds(getDoc(doc(dbFor('bob'), 'rankings', TODAY, 'entries', 'alice')));
  });
});
