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
