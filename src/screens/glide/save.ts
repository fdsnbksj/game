import { GLIDE_VERSION, replay, type GlideGame, type Move } from '../../games/glide/glide';

// Glide's save: the level being played and its moves (replayed to get the blocks back), and
// the highest level solved. Its own key, so it never touches the other games' saves.
const KEY = 'game:glide';

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
      if (save.version === GLIDE_VERSION) return save;
      // Levels from an older version are other puzzles: keep the level reached, start it afresh.
      return { version: GLIDE_VERSION, level: save.level ?? 1, moves: [], best: save.best ?? 0 };
    }
  } catch {
    // Unreadable or no storage: start afresh.
  }
  return { version: GLIDE_VERSION, level: 1, moves: [], best: 0 };
}

export function loadGlide(): { game: GlideGame; best: number } {
  const save = read();
  return { game: replay(save.level, save.moves), best: save.best };
}

/** The level and best only, without making the level (for the front door). */
export function peekGlide(): { level: number; started: boolean; best: number } {
  const save = read();
  return { level: save.level, started: save.moves.length > 0, best: save.best };
}

export function saveGlide(game: GlideGame, best: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: GLIDE_VERSION, level: game.level, moves: game.moves, best } satisfies Save));
  } catch {
    // Full or private storage: it still plays, it just won't resume.
  }
}
