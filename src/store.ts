import { create } from 'zustand';

/** What the client keeps of players/{uid}. */
export interface Player {
  displayName: string;
  /** Runs started so far; the next run is `${uid}_${runsStarted}`. */
  runsStarted: number;
  /** ms, for spacing run starts the way the rules require. */
  lastRunStartAt: number;
}

interface SessionState {
  uid: string | null;
  player: Player | null;
  setSession: (uid: string, player: Player) => void;
  setPlayer: (player: Player) => void;
}

/** Who's signed in. The run in progress lives in runStore. */
export const useGameStore = create<SessionState>()((set) => ({
  uid: null,
  player: null,
  setSession: (uid, player) => set({ uid, player }),
  setPlayer: (player) => set({ player }),
}));
