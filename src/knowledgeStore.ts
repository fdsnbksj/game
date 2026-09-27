import { create } from 'zustand';
import { pickKnowledge, TOPICS, type Topic } from './learn/knowledge';

// Which knowledge cards to show and which the player kept. Stays on the device.
// The key is still `game:library`, from when it also held book highlights; older saves'
// highlight fields are ignored.

const KEY = 'game:library';

interface Saved {
  /** Which topics to show; all of them to start. */
  topics: Topic[];
  /** Every topic the player has had the chance to turn off, so a new one starts switched on. */
  offered: Topic[];
  /** Cards shown in the current round. */
  seen: string[];
  /** Cards kept to read again, newest first. */
  saved: string[];
}

/** The topics there were before `offered` was recorded. */
const FIRST_TOPICS: Topic[] = ['psychology', 'software', 'philosophy'];

function load(): Saved {
  const all = TOPICS.map((t) => t.id);
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null;
    if (!saved?.topics) return { topics: all, offered: all, seen: saved?.seen ?? [], saved: saved?.saved ?? [] };
    // Topics added since the player last chose start on; ones they turned off stay off.
    const offered = saved.offered ?? FIRST_TOPICS;
    const added = all.filter((t) => !offered.includes(t));
    const topics = [...saved.topics.filter((t) => all.includes(t)), ...added];
    return { topics, offered: all, seen: saved.seen ?? [], saved: saved.saved ?? [] };
  } catch {
    return { topics: all, offered: all, seen: [], saved: [] };
  }
}

interface KnowledgeStore extends Saved {
  /** The card to show after a puzzle, from `prefer`'s topic if it's on; null with every topic off. */
  next: (prefer?: Topic) => string | null;
  setTopic: (topic: Topic, on: boolean) => void;
  toggleSaved: (id: string) => void;
}

export const useKnowledgeStore = create<KnowledgeStore>()((set, get) => {
  const persist = () => {
    const { topics, offered, seen, saved } = get();
    try {
      localStorage.setItem(KEY, JSON.stringify({ topics, offered, seen, saved }));
    } catch {
      // Full storage: lasts this visit.
    }
  };

  return {
    ...load(),

    next: (prefer) => {
      const picked = pickKnowledge(get().topics, get().seen, Math.random(), prefer);
      if (!picked) return null;
      set({ seen: picked.seen });
      persist();
      return picked.id;
    },

    setTopic: (topic, on) => {
      const topics = get().topics.filter((t) => t !== topic);
      set({ topics: on ? [...topics, topic] : topics });
      persist();
    },

    toggleSaved: (id) => {
      const { saved } = get();
      set({ saved: saved.includes(id) ? saved.filter((s) => s !== id) : [id, ...saved] });
      persist();
    },
  };
});
