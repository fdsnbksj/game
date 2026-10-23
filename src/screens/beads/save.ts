import { BEADS_VERSION, replay, type BeadsGame, type Move } from '../../games/beads/beads';

// Bead Sort's save: the level being played and its moves (replayed to get the tubes back),
// and the highest level sorted. Its own key, so it never touches the other games' saves.
const KEY = 'game:beads';

interface Save {
  version: number;
  level: number;
  moves: Move[];
  best: number;
}

function read(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const save = JSON.parse(raw) as Save;
      if (save.version === BEADS_VERSION) return save;
      // Levels from an older version are other puzzles: keep the level reached, start it afresh.
      return { version: BEADS_VERSION, level: save.level ?? 1, moves: [], best: save.best ?? 0 };
    }
  } catch {
    // Unreadable or no storage: start afresh.
  }
  return { version: BEADS_VERSION, level: 1, moves: [], best: 0 };
}

export function loadBeads(): { game: BeadsGame; best: number } {
  const save = read();
  return { game: replay(save.level, save.moves), best: save.best };
}

/** The level and best only, without dealing the level (for the front door). */
export function peekBeads(): { level: number; started: boolean; best: number } {
  const save = read();
  return { level: save.level, started: save.moves.length > 0, best: save.best };
}

export function saveBeads(game: BeadsGame, best: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: BEADS_VERSION, level: game.level, moves: game.moves, best } satisfies Save));
  } catch {
    // Full or private storage: it still plays, it just won't resume.
  }
}
