import { createContext, useContext } from 'react';
import { useStore, type StoreApi } from 'zustand';
import type { Star } from './sim/balance';
import type { BattleResult, Placed } from './sim/combat';
import type { RunState, Slot } from './sim/planning';
import { useRunStore } from './runStore';

// What the board needs from whichever mode is using it. Runs and puzzles each keep their
// own zustand store; both have this shape, so the board scene and the shared board parts
// (the long-press card, the unit sheet, the fight bar) work with either. The scene gets
// its store through the Phaser registry, the React parts through BoardStoreContext.

export interface Battle {
  result: BattleResult;
  opponent: string;
  /** A real player's saved team, a bot, or a puzzle's rival. */
  opponentKind: 'ghost' | 'bot' | 'puzzle';
  round: number;
  /** The run as it was when the fight started, for the replay's HUD. */
  before: RunState;
  /** The last unit has fallen and the replay is only pausing on the final frame. */
  over?: boolean;
}

/** Health each side has left during a replay, for the versus header. */
export interface TeamHp {
  a: number;
  b: number;
  maxA: number;
  maxB: number;
  /** Units still standing on each side. */
  aliveA: number;
  aliveB: number;
}

/** A unit being dragged on the board, so the shop can turn into a sell zone. */
export interface UnitDrag {
  slot: Slot;
  /** Over the shop: letting go sells it. */
  overSell: boolean;
  /** Where the finger is, once it has left the canvas and the scene can't draw the unit. */
  outside: { x: number; y: number } | null;
}

export type ReplaySpeed = 1 | 2;

export interface Peek {
  unitId: string;
  star: Star;
  /** Where the creature is, in client pixels; the bubble sits above it. */
  x: number;
  y: number;
}

export interface BoardState {
  run: RunState | null;
  battle: Battle | null;
  speed: ReplaySpeed;
  selected: Slot | null;
  /** The creature an item is being dragged over. */
  itemTarget: Slot | null;
  unitDrag: UnitDrag | null;
  teamHp: TeamHp | null;
  /** A creature held down for a look: its essentials show in a bubble at this screen point. */
  peek: Peek | null;
  /** A short message for the player, e.g. why a move didn't happen. */
  notice: { text: string; id: number } | null;
  /** A rival shown on its half while planning, as a puzzle does. Runs keep it hidden until the fight. */
  rivalPreview?: readonly Placed[] | null;
  /** Applies a planning change; shows `failure` if it changed nothing. */
  act: (change: (run: RunState) => RunState, failure?: string) => boolean;
  select: (slot: Slot | null) => void;
  setSpeed: (speed: ReplaySpeed) => void;
  endReplay: () => void;
  /** The replay reached the end of the fight; the result can show. */
  finishReplay: () => void;
  notify: (text: string) => void;
}

export type BoardStore = StoreApi<BoardState>;

export const BoardStoreContext = createContext<BoardStore>(useRunStore);

/** Reads the board store of the screen this is on. */
export function useBoard<T>(selector: (state: BoardState) => T): T {
  return useStore(useContext(BoardStoreContext), selector);
}

export function useBoardStore(): BoardStore {
  return useContext(BoardStoreContext);
}
