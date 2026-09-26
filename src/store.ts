import { create } from 'zustand';

/** What the client keeps of players/{uid}. */
export interface Player {
  displayName: string;
}

interface SessionState {
  uid: string | null;
  player: Player | null;
  setSession: (uid: string, player: Player) => void;
  setPlayer: (player: Player) => void;
}

/**
 * Who's signed in, once they are. The game never waits for this: puzzles play offline,
 * and their results are queued in nonogramStore until a session exists.
 */
export const useGameStore = create<SessionState>()((set) => ({
  uid: null,
  player: null,
  setSession: (uid, player) => set({ uid, player }),
  setPlayer: (player) => set({ player }),
}));
