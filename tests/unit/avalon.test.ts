import { describe, expect, it } from 'vitest';
import { deal, knowledge } from '../../src/games/avalon/deal';
import { failsToSink, isEvil, roleList, SIDES, TEAM_SIZES, type Role } from '../../src/games/avalon/rules';
import { derive, type Proposal, type Table, type Vote } from '../../src/games/avalon/state';

const players = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
/** A seeded stand-in for crypto randomness, so tests are repeatable. */
function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

describe('roles', () => {
  it('match the published sides for 5 to 10 players', () => {
    for (let n = 5; n <= 10; n++) {
      const roles = roleList(n, ['percival', 'morgana']) as Role[];
      expect(roles).toHaveLength(n);
      expect(roles.filter(isEvil)).toHaveLength(SIDES[n].evil);
      expect(roles).toContain('merlin');
      expect(roles).toContain('assassin');
      expect(TEAM_SIZES[n]).toHaveLength(5);
    }
  });

  it('refuse more evil roles than evil seats', () => {
    expect(typeof roleList(5, ['morgana', 'mordred'])).toBe('string');
    expect(roleList(10, ['morgana', 'mordred', 'oberon'])).toContain('oberon');
    expect(typeof roleList(4, [])).toBe('string');
  });

  it('need two fails on the fourth quest with seven or more', () => {
    expect(failsToSink(6, 3)).toBe(1);
    expect(failsToSink(7, 3)).toBe(2);
    expect(failsToSink(7, 2)).toBe(1);
  });
});

describe('dealing', () => {
  it('hands out every role once, at random', () => {
    const ids = players(8);
    const secrets = deal(ids, ['percival', 'morgana', 'mordred'], seeded(7));
    expect(Object.keys(secrets).sort()).toEqual([...ids].sort());
    expect(Object.values(secrets).map((s) => s.role).sort()).toEqual((roleList(8, ['percival', 'morgana', 'mordred']) as Role[]).sort());
    const again = deal(ids, ['percival', 'morgana', 'mordred'], seeded(8));
    expect(ids.some((id) => again[id].role !== secrets[id].role)).toBe(true);
  });

  const roleOf: Record<string, Role> = {
    merlin: 'merlin',
    percival: 'percival',
    servant: 'servant',
    assassin: 'assassin',
    morgana: 'morgana',
    mordred: 'mordred',
    oberon: 'oberon',
    minion: 'minion',
  };
  const sees = (uid: string) => knowledge(uid, roleOf).map((s) => `${s.uid}:${s.as}`).sort();

  it('shows Merlin every evil player except Mordred', () => {
    expect(sees('merlin')).toEqual(['assassin:evil', 'minion:evil', 'morgana:evil', 'oberon:evil']);
  });

  it('shows Percival Merlin and Morgana, without saying which', () => {
    expect(sees('percival')).toEqual(['merlin:merlin-or-morgana', 'morgana:merlin-or-morgana']);
    expect(knowledge('p', { p: 'percival', m: 'merlin', a: 'assassin' })).toEqual([{ uid: 'm', as: 'merlin' }]);
  });

  it('shows evil each other, but not Oberon, and Oberon no one', () => {
    expect(sees('assassin')).toEqual(['minion:evil', 'mordred:evil', 'morgana:evil']);
    expect(sees('mordred')).toEqual(['assassin:evil', 'minion:evil', 'morgana:evil']);
    expect(sees('oberon')).toEqual([]);
    expect(sees('servant')).toEqual([]);
  });
});

describe('the game', () => {
  const ids = players(5);
  const table = (over: Partial<Table> = {}): Table => ({ playerIds: ids, firstLeader: 0, proposals: [], votes: [], tallies: [], assassinated: null, lady: false, ladyPicks: [], ...over });
  const propose = (quest: number, attempt: number, leader: string, team: string[]): Proposal => ({ quest, attempt, leader, team });
  const allVote = (quest: number, attempt: number, approvers: number): Vote[] =>
    ids.map((uid, i) => ({ quest, attempt, uid, approve: i < approvers }));

  it('starts with the first leader proposing a team of the right size', () => {
    expect(derive(table()).phase).toEqual({ kind: 'proposing', leader: 'p0', teamSize: 2 });
    expect(derive(table({ firstLeader: 3 })).phase).toMatchObject({ leader: 'p3' });
  });

  it('waits for every vote, then passes the lead on a rejection', () => {
    const p = propose(0, 0, 'p0', ['p0', 'p1']);
    const partial = derive(table({ proposals: [p], votes: allVote(0, 0, 5).slice(0, 3) }));
    expect(partial.phase).toMatchObject({ kind: 'voting', voted: ['p0', 'p1', 'p2'] });
    const rejected = derive(table({ proposals: [p], votes: allVote(0, 0, 2) }));
    expect(rejected.phase).toEqual({ kind: 'proposing', leader: 'p1', teamSize: 2 });
    expect(rejected.rejections).toBe(1);
  });

  it('gives evil the game after five rejected teams on one quest', () => {
    const proposals = [0, 1, 2, 3, 4].map((a) => propose(0, a, `p${a}`, ['p0', 'p1']));
    const votes = [0, 1, 2, 3, 4].flatMap((a) => allVote(0, a, 1));
    expect(derive(table({ proposals, votes })).phase).toEqual({ kind: 'over', winner: 'evil', reason: 'rejections' });
  });

  it('runs an approved quest and counts only the tally', () => {
    const p = propose(0, 0, 'p0', ['p0', 'p1']);
    const questing = derive(table({ proposals: [p], votes: allVote(0, 0, 3), tallies: [{ quest: 0, successes: 1, fails: 0 }] }));
    expect(questing.phase).toMatchObject({ kind: 'questing', played: 1 });
    const done = derive(table({ proposals: [p], votes: allVote(0, 0, 3), tallies: [{ quest: 0, successes: 1, fails: 1 }] }));
    expect(done.results).toEqual([{ quest: 0, team: ['p0', 'p1'], successes: 1, fails: 1, succeeded: false }]);
    expect(done.phase).toEqual({ kind: 'proposing', leader: 'p1', teamSize: 3 });
    expect(done.rejections).toBe(0);
  });

  /** Plays `outcomes` quests, each approved on the first try. */
  function play(outcomes: boolean[], extra: Partial<Table> = {}) {
    const sizes = TEAM_SIZES[5];
    const proposals = outcomes.map((_, q) => propose(q, 0, `p${q}`, ids.slice(0, sizes[q])));
    const votes = outcomes.flatMap((_, q) => allVote(q, 0, 5));
    const tallies = outcomes.map((ok, q) => ({ quest: q, successes: sizes[q] - (ok ? 0 : 1), fails: ok ? 0 : 1 }));
    return table({ proposals, votes, tallies, ...extra });
  }

  it('gives evil the game on three failed quests', () => {
    expect(derive(play([false, true, false, false])).phase).toEqual({ kind: 'over', winner: 'evil', reason: 'quests' });
  });

  it('asks the assassin after three good quests, then decides on Merlin', () => {
    expect(derive(play([true, false, true, true])).phase).toEqual({ kind: 'assassinating' });
    const picked = play([true, true, true], { assassinated: 'p2' });
    // Roles still hidden: no winner yet.
    expect(derive(picked).phase).toEqual({ kind: 'assassinating' });
    expect(derive(picked, (uid) => uid === 'p2').phase).toEqual({ kind: 'over', winner: 'evil', reason: 'assassin-found-merlin' });
    expect(derive(picked, (uid) => uid === 'p4').phase).toEqual({ kind: 'over', winner: 'good', reason: 'assassin-missed' });
  });

  it('shows who leads next', () => {
    expect(derive(table()).nextLeader).toBe('p1');
    const p = propose(0, 0, 'p0', ['p0', 'p1']);
    expect(derive(table({ proposals: [p], votes: allVote(0, 0, 5).slice(0, 2) })).nextLeader).toBe('p1');
    const questing = derive(table({ proposals: [p], votes: allVote(0, 0, 5) }));
    expect(questing.leader).toBe('p0');
    expect(questing.nextLeader).toBe('p1');
    expect(derive(table({ firstLeader: 4 })).nextLeader).toBe('p0');
  });

  describe('the Lady of the Lake', () => {
    it('starts with the player to the first leader’s right', () => {
      expect(derive(table({ lady: true, firstLeader: 0 })).ladyHolder).toBe('p4');
      expect(derive(table({ lady: true, firstLeader: 2 })).ladyHolder).toBe('p1');
      expect(derive(table()).ladyHolder).toBeNull();
    });

    it('is used after the second quest, before the next team, and passes to whoever was examined', () => {
      const two = play([true, false], { lady: true });
      expect(derive(two).phase).toEqual({ kind: 'lady', holder: 'p4', afterQuest: 1, candidates: ['p0', 'p1', 'p2', 'p3'] });
      const used = derive({ ...two, ladyPicks: [{ quest: 1, holder: 'p4', target: 'p2' }] });
      expect(used.phase).toMatchObject({ kind: 'proposing' });
      expect(used.ladyHolder).toBe('p2');
      // Never back to anyone who has held her.
      const three = play([true, false, true], { lady: true, ladyPicks: [{ quest: 1, holder: 'p4', target: 'p2' }] });
      expect(derive(three).phase).toEqual({ kind: 'lady', holder: 'p2', afterQuest: 2, candidates: ['p0', 'p1', 'p3'] });
    });

    it('is not used after the first quest, or once a side has won', () => {
      expect(derive(play([true], { lady: true })).phase).toMatchObject({ kind: 'proposing' });
      const picks = [
        { quest: 1, holder: 'p4', target: 'p2' },
        { quest: 2, holder: 'p2', target: 'p0' },
      ];
      expect(derive(play([true, false, true, true], { lady: true, ladyPicks: picks })).phase).toEqual({ kind: 'assassinating' });
    });

    it('ignores a pick by someone who doesn’t hold her', () => {
      const two = play([true, false], { lady: true, ladyPicks: [{ quest: 1, holder: 'p1', target: 'p2' }] });
      expect(derive(two).phase).toMatchObject({ kind: 'lady', holder: 'p4' });
    });
  });

  it('needs two fails to sink the fourth quest with seven players', () => {
    const seven = players(7);
    const sizes = TEAM_SIZES[7];
    const proposals = [0, 1, 2, 3].map((q) => propose(q, 0, seven[q], seven.slice(0, sizes[q])));
    const votes = [0, 1, 2, 3].flatMap((q) => seven.map((uid) => ({ quest: q, attempt: 0, uid, approve: true })));
    const tallies = [
      { quest: 0, successes: 2, fails: 0 },
      { quest: 1, successes: 2, fails: 1 },
      { quest: 2, successes: 2, fails: 1 },
      { quest: 3, successes: 3, fails: 1 },
    ];
    const state = derive({ playerIds: seven, firstLeader: 0, proposals, votes, tallies, assassinated: null, lady: false, ladyPicks: [] });
    expect(state.results.map((r) => r.succeeded)).toEqual([true, false, false, true]);
  });
});
