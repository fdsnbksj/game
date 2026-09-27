import { create } from 'zustand';
import { highlightKey, type Highlight } from './learn/highlights';
import { pickKnowledge, TOPICS, type Topic } from './learn/knowledge';
import { makeQuestion, type Question } from './learn/question';
import { dayNumber, newReview, nextDue, review, type Review } from './learn/schedule';
import { dayId } from './shared/constants';
import { hashSeed } from './shared/random';

// What the player learns between puzzles: the knowledge cards they've seen and saved,
// the topics they chose, and their own highlights with how well each is known. None of
// it leaves the device: no Firestore, no rules, nothing to audit.

const KEY = 'game:library';
/** 2: the Make Something Wonderful starter set was withdrawn, so its lines are removed. */
const VERSION = 2;
const WITHDRAWN_BOOKS = ['Make Something Wonderful'];

export interface Card extends Highlight {
  id: string;
  review: Review;
}

interface Saved {
  v: number;
  cards: Card[];
  /** The last line asked, so the same one isn't asked twice running. */
  lastId: string | null;
  /** Which knowledge topics to show; all of them to start. */
  topics: Topic[];
  /** Knowledge cards shown in the current round. */
  seen: string[];
  /** Knowledge cards kept to read again, newest first. */
  saved: string[];
}

const fresh = (): Saved => ({ v: VERSION, cards: [], lastId: null, topics: TOPICS.map((t) => t.id), seen: [], saved: [] });

function load(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null;
    if (!saved) return fresh();
    const loaded = { ...fresh(), ...saved, v: VERSION };
    if ((saved.v ?? 1) < 2) loaded.cards = loaded.cards.filter((c) => !WITHDRAWN_BOOKS.includes(c.book));
    return loaded;
  } catch {
    return fresh();
  }
}

const today = () => dayNumber(dayId());
const idOf = (h: Highlight) => hashSeed(highlightKey(h)).toString(36);

interface LibraryStore extends Saved {
  /** Adds highlights not already there; returns how many were new. */
  add: (highlights: Highlight[]) => number;
  remove: (id: string) => void;
  removeBook: (book: string) => void;
  /** The question for a card as it stands (it changes a little with each review). */
  questionFor: (id: string) => Question | null;
  /** The card to ask about next, or null if there's none to ask. */
  pickNext: () => string | null;
  /** Records an answer: right on the first try moves it up, anything else starts it over. */
  answer: (id: string, firstTry: boolean) => void;
  /** The knowledge card to show after a puzzle, counted as seen; null with no topics on. */
  nextKnowledge: () => string | null;
  setTopic: (topic: Topic, on: boolean) => void;
  toggleSaved: (id: string) => void;
}

export const useLibraryStore = create<LibraryStore>()((set, get) => {
  const persist = () => {
    const { v, cards, lastId, topics, seen, saved } = get();
    try {
      localStorage.setItem(KEY, JSON.stringify({ v, cards, lastId, topics, seen, saved }));
    } catch {
      // Full storage: the new lines last this visit.
    }
  };

  const question = (card: Card, cards: readonly Card[]) => {
    const sameBook = cards.filter((c) => c.id !== card.id && c.book === card.book).map((c) => c.text);
    const others = cards.filter((c) => c.id !== card.id && c.book !== card.book).map((c) => c.text);
    return makeQuestion(card.text, [...sameBook, ...others], `${card.id}:${card.review.seen}`);
  };

  return {
    ...load(),

    add: (highlights) => {
      const { cards } = get();
      const have = new Set(cards.map((c) => c.id));
      const fresh: Card[] = [];
      for (const h of highlights) {
        const id = idOf(h);
        if (have.has(id)) continue;
        have.add(id);
        fresh.push({ ...h, id, review: newReview(today()) });
      }
      if (fresh.length > 0) {
        set({ cards: [...cards, ...fresh] });
        persist();
      }
      return fresh.length;
    },

    remove: (id) => {
      set({ cards: get().cards.filter((c) => c.id !== id) });
      persist();
    },

    removeBook: (book) => {
      set({ cards: get().cards.filter((c) => c.book !== book) });
      persist();
    },

    questionFor: (id) => {
      const { cards } = get();
      const card = cards.find((c) => c.id === id);
      return card ? question(card, cards) : null;
    },

    pickNext: () => {
      const { cards, lastId } = get();
      const askable = cards.filter((card) => question(card, cards) !== null);
      return nextDue(askable, today(), lastId)?.id ?? null;
    },

    nextKnowledge: () => {
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

    answer: (id, firstTry) => {
      set({
        cards: get().cards.map((c) => (c.id === id ? { ...c, review: review(c.review, firstTry, today()) } : c)),
        lastId: id,
      });
      persist();
    },
  };
});
