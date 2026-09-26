import { create } from 'zustand';
import { highlightKey, type Highlight } from './learn/highlights';
import { makeQuestion, type Question } from './learn/question';
import { dayNumber, newReview, nextDue, review, type Review } from './learn/schedule';
import { dayId } from './shared/constants';
import { hashSeed } from './shared/random';

// The player's highlights and how well each is known. They never leave the device: no
// Firestore, no rules, nothing to audit. Saved to localStorage like everything else.

const KEY = 'game:library';

export interface Card extends Highlight {
  id: string;
  review: Review;
}

interface Saved {
  cards: Card[];
  /** The last line asked, so the same one isn't asked twice running. */
  lastId: string | null;
}

function load(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null;
    return { cards: saved?.cards ?? [], lastId: saved?.lastId ?? null };
  } catch {
    return { cards: [], lastId: null };
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
}

export const useLibraryStore = create<LibraryStore>()((set, get) => {
  const persist = () => {
    const { cards, lastId } = get();
    try {
      localStorage.setItem(KEY, JSON.stringify({ cards, lastId }));
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

    answer: (id, firstTry) => {
      set({
        cards: get().cards.map((c) => (c.id === id ? { ...c, review: review(c.review, firstTry, today()) } : c)),
        lastId: id,
      });
      persist();
    },
  };
});
