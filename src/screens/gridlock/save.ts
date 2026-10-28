import { GRIDLOCK_VERSION, makeLevel, packMove, replay, unpackMove, type GridlockGame, type Lot } from '../../games/gridlock/gridlock';

// Gridlock's save: the level being played and its slides (replayed to put the cars back), the
// highest level solved, and the level's car park itself, kept so reopening needn't make it again
// (making one takes a moment on a phone). Its own key, so it never touches the other games' saves.
const KEY = 'game:gridlock';

interface Save {
  version: number;
  level: number;
  moves: number[];
  best: number;
  lot?: Lot;
}

function read(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const save = JSON.parse(raw) as Save;
      if (save.version === GRIDLOCK_VERSION) return save;
      // Levels from an older version are other car parks: keep the level reached, start it afresh.
      return { version: GRIDLOCK_VERSION, level: save.level ?? 1, moves: [], best: save.best ?? 0 };
    }
  } catch {
    // Unreadable or no storage: start afresh.
  }
  return { version: GRIDLOCK_VERSION, level: 1, moves: [], best: 0 };
}

/** The saved car park if it looks whole, else the level made afresh. */
function lotOf(save: Save): Lot {
  const lot = save.lot;
  if (lot && Array.isArray(lot.cars) && Array.isArray(lot.starts) && lot.cars.length === lot.starts.length && lot.cars.length > 0) return lot;
  return makeLevel(save.level);
}

export function loadGridlock(): { game: GridlockGame; best: number } {
  const save = read();
  const moves = Array.isArray(save.moves) ? save.moves.map(unpackMove) : [];
  return { game: replay(save.level, moves, lotOf(save)), best: save.best };
}

/** The level and best only, without making the level (for the front door). */
export function peekGridlock(): { level: number; started: boolean; best: number } {
  const save = read();
  return { level: save.level, started: save.moves.length > 0, best: save.best };
}

export function saveGridlock(game: GridlockGame, best: number) {
  try {
    const save: Save = { version: GRIDLOCK_VERSION, level: game.level, moves: game.moves.map(packMove), best, lot: game.lot };
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Full or private storage: it still plays, it just won't resume.
  }
}
