import { failsToSink, MAX_REJECTIONS, TEAM_SIZES, TO_WIN } from './rules';

// The whole game, worked out from what's been written: proposals, votes, quest tallies and
// the assassin's pick. Every phone derives the same state from the same documents, so no
// one has to move the game on; each player just writes their own action.

export interface Proposal {
  quest: number;
  /** 0 for the first team proposed on this quest, then 1, 2… after rejections. */
  attempt: number;
  leader: string;
  team: string[];
}

export interface Vote {
  quest: number;
  attempt: number;
  uid: string;
  approve: boolean;
}

/** A quest's cards, only as counts: who played which is never recorded. */
export interface QuestTally {
  quest: number;
  successes: number;
  fails: number;
}

/** A Lady of the Lake check: after quest `quest` (0-based: 1, 2 or 3), `holder` examined `target`. */
export interface LadyPick {
  quest: number;
  holder: string;
  target: string;
}

export interface Table {
  /** Seat order, clockwise around the real table: leadership passes to the left. */
  playerIds: string[];
  /** Seat of the first leader, 0-based. */
  firstLeader: number;
  proposals: Proposal[];
  votes: Vote[];
  tallies: QuestTally[];
  /** Whom the assassin named, once they have. */
  assassinated: string | null;
  /** Whether the Lady of the Lake is in the game. */
  lady: boolean;
  ladyPicks: LadyPick[];
}

export interface QuestResult {
  quest: number;
  team: string[];
  successes: number;
  fails: number;
  succeeded: boolean;
}

export type Phase =
  | { kind: 'proposing'; leader: string; teamSize: number }
  | { kind: 'voting'; proposal: Proposal; voted: string[] }
  | { kind: 'questing'; proposal: Proposal; played: number }
  | { kind: 'lady'; holder: string; afterQuest: number; candidates: string[] }
  | { kind: 'assassinating' }
  | { kind: 'over'; winner: 'good' | 'evil'; reason: 'quests' | 'rejections' | 'assassin-missed' | 'assassin-found-merlin' };

export interface GameState {
  phase: Phase;
  /** Who leads now (proposing, voting or questing), and who leads after them. */
  leader: string | null;
  nextLeader: string;
  /** Who holds the Lady of the Lake, if she's in the game. */
  ladyHolder: string | null;
  /** Lady of the Lake checks so far: public (who looked at whom), not what they saw. */
  ladyPicks: LadyPick[];
  /** The quest being played or up next, 0-based. */
  quest: number;
  /** Teams rejected so far on this quest. */
  rejections: number;
  results: QuestResult[];
  /** Every finished vote, in order, for the history. */
  votes: { proposal: Proposal; approvals: string[]; rejections: string[]; approved: boolean }[];
}

/**
 * The state of the game. `isMerlin` answers for the assassinated player once roles are
 * revealed; until then it's unknown (null) and a finished assassination shows no winner.
 */
export function derive(table: Table, isMerlin: (uid: string) => boolean | null = () => null): GameState {
  const { playerIds } = table;
  const n = playerIds.length;
  const sizes = TEAM_SIZES[n];
  const results: QuestResult[] = [];
  const history: GameState['votes'] = [];
  let leaderSeat = table.firstLeader;
  let quest = 0;
  let attempt = 0;
  // The Lady starts with the player to the first leader's right, and can't return to anyone who held her.
  let holder = table.lady ? playerIds[(table.firstLeader + n - 1) % n] : null;
  const pastHolders = holder ? [holder] : [];
  const picks: LadyPick[] = [];

  const state = (phase: Phase): GameState => ({
    phase,
    leader: phase.kind === 'proposing' ? phase.leader : phase.kind === 'voting' || phase.kind === 'questing' ? phase.proposal.leader : null,
    // While a team is proposed or voted on, the lead moves on once the vote is in; after an
    // approved vote it already has, so the seat counter points at the next leader.
    nextLeader: playerIds[(leaderSeat + (phase.kind === 'proposing' || phase.kind === 'voting' ? 1 : 0)) % n],
    ladyHolder: holder,
    ladyPicks: picks,
    quest,
    rejections: attempt,
    results,
    votes: history,
  });

  for (;;) {
    const good = results.filter((r) => r.succeeded).length;
    const evil = results.length - good;
    if (evil >= TO_WIN) return state({ kind: 'over', winner: 'evil', reason: 'quests' });
    if (good >= TO_WIN) {
      if (!table.assassinated) return state({ kind: 'assassinating' });
      const found = isMerlin(table.assassinated);
      if (found === null) return state({ kind: 'assassinating' });
      return state({ kind: 'over', winner: found ? 'evil' : 'good', reason: found ? 'assassin-found-merlin' : 'assassin-missed' });
    }

    // The Lady of the Lake is used after the second, third and fourth quests.
    if (holder) {
      for (let after = 1; after <= Math.min(results.length - 1, 3); after++) {
        if (picks.some((p) => p.quest === after)) continue;
        const pick = table.ladyPicks.find((p) => p.quest === after && p.holder === holder);
        if (!pick) {
          return state({ kind: 'lady', holder, afterQuest: after, candidates: playerIds.filter((p) => !pastHolders.includes(p)) });
        }
        picks.push(pick);
        holder = pick.target;
        pastHolders.push(pick.target);
      }
    }

    const leader = playerIds[leaderSeat % n];
    const proposal = table.proposals.find((p) => p.quest === quest && p.attempt === attempt);
    if (!proposal) return state({ kind: 'proposing', leader, teamSize: sizes[quest] });

    const votes = table.votes.filter((v) => v.quest === quest && v.attempt === attempt && playerIds.includes(v.uid));
    const voted = [...new Set(votes.map((v) => v.uid))];
    if (voted.length < n) return state({ kind: 'voting', proposal, voted });

    const approvals = voted.filter((uid) => votes.find((v) => v.uid === uid)!.approve);
    const approved = approvals.length * 2 > n;
    history.push({ proposal, approvals, rejections: voted.filter((uid) => !approvals.includes(uid)), approved });
    leaderSeat++;

    if (!approved) {
      attempt++;
      if (attempt >= MAX_REJECTIONS) return state({ kind: 'over', winner: 'evil', reason: 'rejections' });
      continue;
    }

    const tally = table.tallies.find((t) => t.quest === quest) ?? { quest, successes: 0, fails: 0 };
    const played = tally.successes + tally.fails;
    if (played < proposal.team.length) return state({ kind: 'questing', proposal, played });

    results.push({ quest, team: proposal.team, successes: tally.successes, fails: tally.fails, succeeded: tally.fails < failsToSink(n, quest) });
    quest++;
    attempt = 0;
  }
}
