import { create } from 'zustand';

/** What the client keeps of players/{uid}. */
export interface Player {
  displayName: string;
}

interface SessionState {
  uid: string | null;
  player: Player | null;
  /** The account's email; null for a guest (an anonymous user). */
  email: string | null;
  setSession: (uid: string, player: Player, email: string | null) => void;
  setPlayer: (player: Player) => void;
  setEmail: (email: string | null) => void;
  /** Between signing out and the next guest session. */
  clear: () => void;
}

/**
 * Who's signed in, once they are. The games never wait for this: puzzles play offline,
 * and their results are queued in nonogramStore until a session exists.
 */
export const useGameStore = create<SessionState>()((set) => ({
  uid: null,
  player: null,
  email: null,
  setSession: (uid, player, email) => set({ uid, player, email }),
  setPlayer: (player) => set({ player }),
  setEmail: (email) => set({ email }),
  clear: () => set({ uid: null, player: null, email: null }),
}));
