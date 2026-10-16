import { SKY_VERSION, type SkyState } from '../../games/sky/sim';

// Sky Ace's save: the run in progress (the whole world, so it resumes mid-wave) and the best
// score. Its own key, so it never touches the other games' saves.
const KEY = 'game:sky';

interface Save {
  version: number;
  run: SkyState | null;
  best: number;
}

export function loadSky(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const save = JSON.parse(raw) as Save;
      // A run from an older version would play differently: keep only the best score.
      if (save.version === SKY_VERSION) return save;
      return { version: SKY_VERSION, run: null, best: save.best ?? 0 };
    }
  } catch {
    // Unreadable or no storage: start afresh.
  }
  return { version: SKY_VERSION, run: null, best: 0 };
}

export function saveSky(run: SkyState | null, best: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: SKY_VERSION, run, best } satisfies Save));
  } catch {
    // Full or private storage: the run still plays, it just won't resume.
  }
}
