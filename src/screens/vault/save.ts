import { VAULT_VERSION, replay, type VaultGame } from '../../games/vault/vault';

// Vault's save: the level being played and its moves (replayed to put the pegs and tries back), and
// the highest level solved. Its own key, so it never touches the other games' saves.
const KEY = 'game:vault';

interface Save {
  version: number;
  level: number;
  moves: number[];
  best: number;
}

function read(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const save = JSON.parse(raw) as Save;
      if (save.version === VAULT_VERSION) return save;
      // Levels from an older version are other puzzles: keep the level reached, start it afresh.
      return { version: VAULT_VERSION, level: save.level ?? 1, moves: [], best: save.best ?? 0 };
    }
  } catch {
    // Unreadable or no storage: start afresh.
  }
  return { version: VAULT_VERSION, level: 1, moves: [], best: 0 };
}

export function loadVault(): { game: VaultGame; best: number } {
  const save = read();
  return { game: replay(save.level, save.moves), best: save.best };
}

/** The level and best only, without making the level (for the front door). */
export function peekVault(): { level: number; started: boolean; best: number } {
  const save = read();
  return { level: save.level, started: save.moves.length > 0, best: save.best };
}

export function saveVault(game: VaultGame, best: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VAULT_VERSION, level: game.level, moves: game.moves, best } satisfies Save));
  } catch {
    // Full or private storage: it still plays, it just won't resume.
  }
}
