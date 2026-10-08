import { describe, expect, it } from 'vitest';
import { useBrawlStore } from '../../src/brawlStore';

describe('Stick Brawl saves', () => {
  it('starts fights with the chosen rules', () => {
    useBrawlStore.getState().choose({ rules: { mode: 'timed', value: 4 } });
    useBrawlStore.getState().start('timed');
    expect(useBrawlStore.getState().match?.rules).toEqual({ mode: 'timed', value: 4 });
    useBrawlStore.getState().choose({ rules: { mode: 'score', value: 3 } });
  });

  it('never lets an old fight save over the new one Restart started', () => {
    const store = useBrawlStore.getState();
    store.start('first');
    const old = useBrawlStore.getState().match!;
    store.start('second');
    // The old fight's screen closing saves it one last time: it must not come back.
    useBrawlStore.getState().keep(old);
    expect(useBrawlStore.getState().match?.seed).toBe('second');
    // The current fight still saves as it goes.
    const now = { ...useBrawlStore.getState().match!, frame: 99 };
    useBrawlStore.getState().keep(now);
    expect(useBrawlStore.getState().match?.frame).toBe(99);
  });
});

describe('Stick Brawl saves from older versions', () => {
  it('drops a saved fight from another version, or one missing its rules, instead of crashing on it', async () => {
    const { BRAWL_VERSION, newMatch } = await import('../../src/games/brawl/state');
    const store = new Map<string, string>();
    const real = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    } as unknown as Storage;
    try {
      for (const match of [
        { ...newMatch('old', [{ bot: 0 }, { bot: 2 }]), v: BRAWL_VERSION - 1 },
        { ...newMatch('norules', [{ bot: 0 }, { bot: 2 }]), rules: undefined },
      ]) {
        store.set('game:brawl', JSON.stringify({ bots: 1, level: 2, match }));
        const { useBrawlStore: fresh } = await import(`../../src/brawlStore?${match.seed}`);
        expect(fresh.getState().match).toBeNull();
      }
    } finally {
      globalThis.localStorage = real;
    }
  });
});
