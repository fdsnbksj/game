import { create } from 'zustand';
import { costumeItem, costumeOf, type CostumeId } from './games/hero/costumes';
import { ALL_ITEMS, PITY, PULL_COST, pullOnce, pullTen, REFUND, TEN_COST, type Pulled } from './games/hero/gacha';
import { canWear, DEFAULT_LOOK, validLook, wearable, type Appearance, type LookField } from './games/hero/look';
import type { Rng } from './nonogram/rng';
import { isRetryable } from './services/solves';
import { fetchWardrobe, writeWardrobe, type WardrobeDoc } from './services/wardrobe';
import { useGameStore } from './store';

// Your hero's look, the costumes and parts you've summoned, and your gems: saved to
// localStorage (`game:wardrobe`, a key of its own; never rename it) the moment anything
// changes, then synced to wardrobes/{uid}. The hero doc carries what you wear, so
// heroStore writes it after this (it watches `look` and `costume`).

const KEY = 'game:wardrobe';

interface Saved extends WardrobeDoc {
  owner: string | null;
  dirty: boolean;
  /** This phone has met the server's wardrobe, so its own is the latest. */
  met: boolean;
}

const fresh = (): Saved => ({ owner: null, look: DEFAULT_LOOK, costume: null, owned: [], gems: 0, pity: 0, lastFree: '', dirty: false, met: false });

function load(): Saved {
  try {
    const saved = { ...fresh(), ...(JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null) };
    const owned = Array.isArray(saved.owned) ? saved.owned.filter((x) => typeof x === 'string' && ALL_ITEMS.includes(x)) : [];
    const look = wearable(validLook(saved.look) ?? DEFAULT_LOOK, owned);
    const costume = costumeOf(saved.costume)?.id ?? null;
    return {
      owner: saved.owner ?? null,
      look,
      costume: costume && owned.includes(costumeItem(costume)) ? costume : null,
      owned,
      gems: Number.isInteger(saved.gems) ? Math.max(0, saved.gems) : 0,
      pity: Number.isInteger(saved.pity) ? Math.max(0, Math.min(PITY - 1, saved.pity)) : 0,
      lastFree: typeof saved.lastFree === 'string' ? saved.lastFree : '',
      dirty: !!saved.dirty,
      met: !!saved.met,
    };
  } catch {
    return fresh();
  }
}

function save(s: Saved) {
  const { owner, look, costume, owned, gems, pity, lastFree, dirty, met } = s;
  try {
    localStorage.setItem(KEY, JSON.stringify({ owner, look, costume, owned, gems, pity, lastFree, dirty, met }));
  } catch {
    // Private mode or full storage: the wardrobe lasts this visit.
  }
}

/** Today on this phone's calendar, for the free pull. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Random whole numbers for Summon, from the phone's secure source. */
export const summonRng: Rng = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;

export interface Summoned extends Pulled {
  /** Already owned: turned into gems instead. */
  refund: number;
}

interface WardrobeStore extends Saved {
  earn: (gems: number) => void;
  freeReady: () => boolean;
  /** One pull (free once a day, else 100 gems). Null if it can't be paid for. */
  pull: (free: boolean) => Summoned[] | null;
  pullTen: () => Summoned[] | null;
  setLook: (field: LookField, value: number) => void;
  /** Puts a costume on, or takes it off with null. */
  wear: (costume: CostumeId | null) => void;
  appearance: () => Appearance;
  claim: (uid: string) => void;
  sync: () => Promise<void>;
}

let syncing: Promise<void> | null = null;

export const useWardrobeStore = create<WardrobeStore>()((set, get) => {
  const update = (change: Partial<Saved>) => {
    set(change);
    save(get());
  };
  const changed = (change: Partial<Saved>) => {
    update({ ...change, dirty: true });
    void get().sync();
  };

  /** Takes what was pulled: new items join the wardrobe, repeats become gems. */
  const keep = (pulled: Pulled[], pity: number, cost: number, extra: Partial<Saved> = {}): Summoned[] => {
    const owned = [...get().owned];
    let gems = get().gems - cost;
    const out = pulled.map((p) => {
      if (owned.includes(p.item)) {
        gems += REFUND[p.rarity];
        return { ...p, refund: REFUND[p.rarity] };
      }
      owned.push(p.item);
      return { ...p, refund: 0 };
    });
    changed({ owned, gems, pity, ...extra });
    return out;
  };

  const runSync = async () => {
    const { uid } = useGameStore.getState();
    if (!uid) return;
    try {
      const server = await fetchWardrobe(uid);
      const local = get();
      if (server && !local.met) {
        // The first meeting on this phone: keep both sides' summons and gems.
        const owned = [...new Set([...server.owned, ...local.owned])];
        const merged = {
          owned,
          gems: server.gems + local.gems,
          pity: server.pity,
          lastFree: server.lastFree > local.lastFree ? server.lastFree : local.lastFree,
          look: local.dirty ? local.look : wearable(server.look, owned),
          costume: local.dirty ? local.costume : server.costume,
          met: true,
        };
        update({ ...merged, dirty: local.dirty || local.gems > 0 || local.owned.length > 0 });
        if (!get().dirty) return;
      } else if (!local.dirty) {
        if (!local.met) update({ met: true });
        return;
      }
      const { look, costume, owned, gems, pity, lastFree } = get();
      await writeWardrobe(uid, { look, costume, owned, gems, pity, lastFree });
      const now = get();
      if (now.look === look && now.costume === costume && now.owned === owned && now.gems === gems) update({ dirty: false, met: true });
    } catch (error) {
      if (isRetryable(error)) return;
      console.warn('Firestore refused the wardrobe:', error);
      update({ dirty: false, met: true });
    }
  };

  return {
    ...load(),

    earn: (gems) => gems > 0 && changed({ gems: get().gems + gems }),

    freeReady: () => get().lastFree !== today(),

    pull: (free) => {
      if (free ? !get().freeReady() : get().gems < PULL_COST) return null;
      const { pulled, pity } = pullOnce(summonRng, get().pity);
      return keep([pulled], pity, free ? 0 : PULL_COST, free ? { lastFree: today() } : {});
    },

    pullTen: () => {
      if (get().gems < TEN_COST) return null;
      const { pulled, pity } = pullTen(summonRng, get().pity);
      return keep(pulled, pity, TEN_COST);
    },

    setLook: (field, value) => {
      if (!canWear(field, value, get().owned)) return;
      const look = validLook({ ...get().look, [field]: value });
      if (look) changed({ look });
    },

    wear: (costume) => {
      if (costume && !get().owned.includes(costumeItem(costume))) return;
      changed({ costume });
    },

    appearance: () => ({ look: get().look, costume: get().costume }),

    claim: (uid) => {
      const { owner } = get();
      if (owner !== null && owner !== uid) update({ ...fresh(), owner: uid });
      else update({ owner: uid });
    },

    sync: async () => {
      while (syncing) await syncing;
      syncing = runSync().finally(() => (syncing = null));
      await syncing;
    },
  };
});

// Sync as soon as there's a session, and whenever the connection returns.
useGameStore.subscribe((session, before) => {
  if (session.uid && session.player && (session.uid !== before.uid || !before.player)) {
    useWardrobeStore.getState().claim(session.uid);
    void useWardrobeStore.getState().sync();
  }
});
if (typeof window !== 'undefined') window.addEventListener('online', () => void useWardrobeStore.getState().sync());

