import { create } from 'zustand';
import { DEFAULT_LOADOUT } from './shared/items';
import type { LeaderboardEntry, Loadout, UserProfile } from './shared/types';

interface Session {
  uid: string;
  profile: UserProfile;
  inventory: string[];
  loadout: Loadout;
}

interface GameState {
  uid: string | null;
  profile: UserProfile | null;
  /** Owned item ids. */
  inventory: string[];
  /** Last loadout saved to Firestore. */
  loadout: Loadout;
  leaderboard: LeaderboardEntry[];
  /** Day the cached leaderboard belongs to. */
  leaderboardDay: string;
  leaderboardFetchedAt: number;
  /** Runs finished since the last save; they're added to gamesPlayed with the next one. */
  pendingRuns: number;
  /** Client clock, used to keep saves apart enough for the rules to accept them. */
  lastSaveAt: number;
  setSession: (session: Session) => void;
  setProfile: (profile: UserProfile) => void;
  addToInventory: (itemIds: string[]) => void;
  setLoadout: (loadout: Loadout) => void;
  setLeaderboard: (day: string, entries: LeaderboardEntry[]) => void;
  invalidateLeaderboard: () => void;
  addPendingRun: () => void;
  markSaved: (gamesSaved: number) => void;
}

export const useGameStore = create<GameState>()((set) => ({
  uid: null,
  profile: null,
  inventory: [],
  loadout: DEFAULT_LOADOUT,
  leaderboard: [],
  leaderboardDay: '',
  leaderboardFetchedAt: 0,
  pendingRuns: 0,
  lastSaveAt: 0,
  setSession: (session) => set(session),
  setProfile: (profile) => set({ profile }),
  addToInventory: (itemIds) => set((state) => ({ inventory: [...new Set([...state.inventory, ...itemIds])] })),
  setLoadout: (loadout) => set({ loadout }),
  setLeaderboard: (day, entries) => set({ leaderboard: entries, leaderboardDay: day, leaderboardFetchedAt: Date.now() }),
  invalidateLeaderboard: () => set({ leaderboardFetchedAt: 0 }),
  addPendingRun: () => set((state) => ({ pendingRuns: state.pendingRuns + 1 })),
  markSaved: () => set({ pendingRuns: 0, lastSaveAt: Date.now() }),
}));

/** Store state for services that only run once the player is signed in. */
export function requireSession() {
  const state = useGameStore.getState();
  const { uid, profile } = state;
  if (!uid || !profile) throw new Error('No active session');
  return { ...state, uid, profile };
}
