import { THREADS_VERSION, replay, type Stroke, type ThreadsGame } from '../../games/threads/threads';

// Threads' save: the level being played and its strokes (replayed to draw the threads back), and
// the highest level solved. Its own key, so it never touches the other games' saves.
const KEY = 'game:threads';

interface Save {
  version: number;
  level: number;
  moves: Stroke[];
  best: number;
}

function read(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const save = JSON.parse(raw) as Save;
      if (save.version === THREADS_VERSION) return save;
      // Levels from an older version are other puzzles: keep the level reached, start it afresh.
      return { version: THREADS_VERSION, level: save.level ?? 1, moves: [], best: save.best ?? 0 };
    }
  } catch {
    // Unreadable or no storage: start afresh.
  }
  return { version: THREADS_VERSION, level: 1, moves: [], best: 0 };
}

export function loadThreads(): { game: ThreadsGame; best: number } {
  const save = read();
  return { game: replay(save.level, save.moves), best: save.best };
}

/** The level and best only, without making the level (for the front door). */
export function peekThreads(): { level: number; started: boolean; best: number } {
  const save = read();
  return { level: save.level, started: save.moves.length > 0, best: save.best };
}

export function saveThreads(game: ThreadsGame, best: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: THREADS_VERSION, level: game.level, moves: game.moves, best } satisfies Save));
  } catch {
    // Full or private storage: it still plays, it just won't resume.
  }
}
