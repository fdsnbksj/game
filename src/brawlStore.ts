import { create } from 'zustand';
import { BRAWL_VERSION, DEFAULT_RULES, newMatch, SCORE_TARGETS, TIMED_MINUTES, type BotLevel, type Match, type Rules } from './games/brawl/state';

// Sky Brawl's choices and the fight in progress, saved to localStorage so a fight put down
// at a stop picks up where it was. A key of its own: the other games' saves are untouched.

const KEY = 'game:brawl';

/** Older saves also hold a `fighter` from when there were three; it's ignored. */
interface Saved {
  bots: 1 | 2 | 3;
  level: 1 | 2 | 3;
  /** How the next fight is won: rounds to a score, or the best score after some minutes. */
  rules: Rules;
  match: Match | null;
  wins: number;
  fights: number;
}

const fresh = (): Saved => ({ bots: 1, level: 2, rules: DEFAULT_RULES, match: null, wins: 0, fights: 0 });

/** Rules from an old or tampered save fall back to the default. */
const validRules = (r: Rules | undefined): Rules =>
  r && ((r.mode === 'score' && SCORE_TARGETS.includes(r.value)) || (r.mode === 'timed' && TIMED_MINUTES.includes(r.value))) ? r : DEFAULT_RULES;

function load(): Saved {
  try {
    const { bots, level, rules, match, wins, fights } = { ...fresh(), ...(JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null) };
    const saved: Saved = { bots, level, rules: validRules(rules), match, wins, fights };
    // A fight saved by an older engine would play differently now: let it go.
    // A finished fight is never worth reopening.
    if (saved.match && (saved.match.v !== BRAWL_VERSION || saved.match.winner !== null)) saved.match = null;
    return saved;
  } catch {
    return fresh();
  }
}

function save(state: Saved) {
  const { bots, level, rules, match, wins, fights } = state;
  try {
    localStorage.setItem(KEY, JSON.stringify({ bots, level, rules, match, wins, fights }));
  } catch {
    // Private mode or full storage: the fight lasts this visit.
  }
}

interface BrawlStore extends Saved {
  choose: (change: Partial<Pick<Saved, 'bots' | 'level' | 'rules'>>) => void;
  /** A new fight: you in seat 0, bots in the rest. */
  start: (seed: string) => void;
  /** Saves where the fight is; called now and then, and whenever the screen is left. */
  keep: (match: Match) => void;
  /** Counts a finished fight once and clears it. */
  finish: (won: boolean) => void;
  quit: () => void;
}

export const useBrawlStore = create<BrawlStore>()((set, get) => {
  const update = (change: Partial<Saved>) => {
    set(change);
    save(get());
  };
  return {
    ...load(),
    choose: (change) => update(change),
    start: (seed) => {
      const { bots, level, rules } = get();
      const seats = [{ bot: 0 as BotLevel }, ...Array.from({ length: bots }, () => ({ bot: level as BotLevel }))];
      update({ match: newMatch(seed, seats, rules) });
    },
    keep: (match) => {
      // A finished fight is counted by finish(); keeping it would reopen it with no way on.
      // And a fight only ever saves over itself: when Restart has put a new one in, the old
      // one closing must not save itself back (the two would swap forever, and the screen go blank).
      if (match.winner === null && get().match?.seed === match.seed) update({ match });
    },
    finish: (won) => update({ match: null, fights: get().fights + 1, wins: get().wins + (won ? 1 : 0) }),
    quit: () => update({ match: null }),
  };
});
