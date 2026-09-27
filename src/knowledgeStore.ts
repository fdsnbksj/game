import { create } from 'zustand';
import { pickKnowledge, TOPICS, type Topic } from './learn/knowledge';

// Which knowledge cards to show and which the player kept. Stays on the device.
// The key is still `game:library`, from when it also held book highlights; older saves'
// highlight fields are ignored.

const KEY = 'game:library';

interface Saved {
  /** Which topics to show; all of them to start. */
  topics: Topic[];
  /** Cards shown in the current round. */
  seen: string[];
  /** Cards kept to read again, newest first. */
  saved: string[];
}

function load(): Saved {
  const all = TOPICS.map((t) => t.id);
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null;
    return { topics: saved?.topics ?? all, seen: saved?.seen ?? [], saved: saved?.saved ?? [] };
  } catch {
    return { topics: all, seen: [], saved: [] };
  }
}

interface KnowledgeStore extends Saved {
  /** The card to show after a puzzle, counted as seen; null with every topic off. */
  next: () => string | null;
  setTopic: (topic: Topic, on: boolean) => void;
  toggleSaved: (id: string) => void;
}

export const useKnowledgeStore = create<KnowledgeStore>()((set, get) => {
  const persist = () => {
    const { topics, seen, saved } = get();
    try {
      localStorage.setItem(KEY, JSON.stringify({ topics, seen, saved }));
    } catch {
      // Full storage: lasts this visit.
    }
  };

  return {
    ...load(),

    next: () => {
      const picked = pickKnowledge(get().topics, get().seen, Math.random());
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
