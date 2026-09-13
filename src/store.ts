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
  leaderboardFetchedAt: number;
  setSession: (session: Session) => void;
  setProfile: (profile: UserProfile) => void;
  addToInventory: (itemIds: string[]) => void;
  setLoadout: (loadout: Loadout) => void;
  setLeaderboard: (entries: LeaderboardEntry[]) => void;
  invalidateLeaderboard: () => void;
}

export const useGameStore = create<GameState>()((set) => ({
  uid: null,
  profile: null,
  inventory: [],
  loadout: DEFAULT_LOADOUT,
  leaderboard: [],
  leaderboardFetchedAt: 0,
  setSession: (session) => set(session),
  setProfile: (profile) => set({ profile }),
  addToInventory: (itemIds) => set((state) => ({ inventory: [...new Set([...state.inventory, ...itemIds])] })),
  setLoadout: (loadout) => set({ loadout }),
  setLeaderboard: (leaderboard) => set({ leaderboard, leaderboardFetchedAt: Date.now() }),
  invalidateLeaderboard: () => set({ leaderboardFetchedAt: 0 }),
}));

/** Store state for services that only run once the player is signed in. */
export function requireSession() {
  const state = useGameStore.getState();
  const { uid, profile } = state;
  if (!uid || !profile) throw new Error('No active session');
  return { ...state, uid, profile };
}
