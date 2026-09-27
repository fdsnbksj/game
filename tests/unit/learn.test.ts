import { describe, expect, it } from 'vitest';
import { looksLikeClippings, parseClippings, parsePasted } from '../../src/learn/highlights';
import { keyWords, makeQuestion } from '../../src/learn/question';
import { dayNumber, INTERVALS, newReview, nextDue, review } from '../../src/learn/schedule';

const CLIPPINGS = `﻿Thinking, Fast and Slow (Daniel Kahneman)
- Your Highlight on page 20 | Location 301-302 | Added on Monday, 1 September 2026 08:12:03

A reliable way to make people believe in falsehoods is frequent repetition.
==========
Thinking, Fast and Slow (Daniel Kahneman)
- Your Bookmark on page 21 | Location 310 | Added on Monday, 1 September 2026 08:13:00


==========
Atomic Habits (James Clear)
- Your Note on page 3 | Location 40 | Added on Tuesday, 2 September 2026 07:50:00

Habits are the compound interest of self-improvement.
==========
Thinking, Fast and Slow (Daniel Kahneman)
- Your Highlight on page 20 | Location 301-302 | Added on Monday, 1 September 2026 08:12:03

A reliable way to make people believe in falsehoods is frequent repetition.
==========
`;

describe('highlights', () => {
  it('reads a Kindle clippings file, skipping bookmarks and repeats', () => {
    expect(looksLikeClippings(CLIPPINGS)).toBe(true);
    expect(parseClippings(CLIPPINGS)).toEqual([
      { book: 'Thinking, Fast and Slow', text: 'A reliable way to make people believe in falsehoods is frequent repetition.' },
      { book: 'Atomic Habits', text: 'Habits are the compound interest of self-improvement.' },
    ]);
  });

  it('splits pasted text by paragraph, or by line when there are no paragraphs', () => {
    expect(parsePasted('One line that is long enough.\n\nAnother line,\nwrapped over two.', 'Book')).toEqual([
      { book: 'Book', text: 'One line that is long enough.' },
      { book: 'Book', text: 'Another line, wrapped over two.' },
    ]);
    expect(parsePasted('First highlight goes here\nSecond highlight goes here\nshort', ' Book ')).toHaveLength(2);
    expect(looksLikeClippings('just some text')).toBe(false);
  });
});

describe('questions', () => {
  const text = 'A reliable way to make people believe in falsehoods is frequent repetition.';
  const pool = ['Habits are the compound interest of self-improvement.', 'Nothing in life is as important as you think it is.'];

  it('blank out a telling word, not filler', () => {
    expect(keyWords(text)).toEqual(['reliable', 'believe', 'falsehoods', 'frequent', 'repetition']);
    const q = makeQuestion(text, pool, 'seed')!;
    expect(['falsehoods', 'repetition', 'reliable', 'frequent']).toContain(q.answer);
    expect(q.before + q.answer + q.after).toBe(text);
  });

  it('offer four different choices, one of them right', () => {
    for (let i = 0; i < 20; i++) {
      const q = makeQuestion(text, pool, `seed:${i}`)!;
      expect(q.choices).toHaveLength(4);
      expect(q.choices).toContain(q.answer);
      expect(new Set(q.choices.map((c) => c.toLowerCase())).size).toBe(4);
    }
  });

  it('match the capital letter of the answer', () => {
    const q = makeQuestion('Remembrance is key.', ['habits compound interest improvement'], 'x')!;
    for (const choice of q.choices) expect(choice[0]).toBe(choice[0].toUpperCase());
  });

  it('are the same for the same seed', () => {
    expect(makeQuestion(text, pool, 'a')).toEqual(makeQuestion(text, pool, 'a'));
  });

  it('skip a line with nothing worth asking', () => {
    expect(makeQuestion('it is what it is', pool, 'a')).toBeNull();
  });
});

describe('schedule', () => {
  it('counts days like the calendar', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayNumber('2000-03-01')).toBe(11017);
    expect(dayNumber('2026-09-26')).toBe(Date.UTC(2026, 8, 26) / 86_400_000);
    expect(dayNumber('2028-02-29') + 1).toBe(dayNumber('2028-03-01'));
  });

  it('pushes a known line further away, and brings a missed one back', () => {
    let r = newReview(100);
    r = review(r, true, 100);
    expect(r).toEqual({ box: 1, due: 100 + INTERVALS[1], seen: 1 });
    r = review(r, true, 101);
    expect(r.due).toBe(101 + INTERVALS[2]);
    r = review(r, false, 104);
    expect(r).toEqual({ box: 0, due: 104, seen: 3 });
  });

  it('asks the most overdue line, not the one just asked', () => {
    const item = (id: string, due: number, box = 0) => ({ id, review: { box, due, seen: 0 } });
    const items = [item('a', 5), item('b', 3), item('c', 9)];
    expect(nextDue(items, 6, null)?.id).toBe('b');
    expect(nextDue(items, 6, 'b')?.id).toBe('a');
    // Nothing due: the soonest, since the next level still needs a question.
    expect(nextDue(items, 1, null)?.id).toBe('b');
    expect(nextDue([item('a', 5)], 6, 'a')?.id).toBe('a');
    expect(nextDue([], 6, null)).toBeNull();
  });
});

describe('knowledge cards', () => {
  it('have unique ids, every topic, and fit on a phone', async () => {
    const { KNOWLEDGE, TOPICS } = await import('../../src/learn/knowledge');
    expect(new Set(KNOWLEDGE.map((k) => k.id)).size).toBe(KNOWLEDGE.length);
    for (const topic of TOPICS) expect(KNOWLEDGE.filter((k) => k.topic === topic.id).length).toBeGreaterThanOrEqual(15);
    for (const k of KNOWLEDGE) {
      expect(k.title.length, k.id).toBeLessThanOrEqual(45);
      expect(k.body.length, k.id).toBeLessThanOrEqual(260);
      expect(k.tryThis.length, k.id).toBeLessThanOrEqual(90);
    }
  });

  it('show every card of the chosen topics before any repeats', async () => {
    const { KNOWLEDGE, pickKnowledge } = await import('../../src/learn/knowledge');
    const deck = KNOWLEDGE.filter((k) => k.topic === 'philosophy');
    let seen: string[] = [];
    const shown = new Set<string>();
    for (let i = 0; i < deck.length; i++) {
      const next = pickKnowledge(['philosophy'], seen, (i * 0.37) % 1)!;
      expect(shown.has(next.id)).toBe(false);
      expect(deck.some((k) => k.id === next.id)).toBe(true);
      shown.add(next.id);
      seen = next.seen;
    }
    // A full round, then it starts over and keeps going.
    const again = pickKnowledge(['philosophy'], seen, 0.5)!;
    expect(again.seen).toEqual([again.id]);
  });

  it('keep other topics\' history when one topic starts over', async () => {
    const { KNOWLEDGE, pickKnowledge } = await import('../../src/learn/knowledge');
    const philosophy = KNOWLEDGE.filter((k) => k.topic === 'philosophy').map((k) => k.id);
    const next = pickKnowledge(['philosophy'], ['spacing-effect', ...philosophy], 0)!;
    expect(next.seen).toEqual(['spacing-effect', next.id]);
  });

  it('show nothing with every topic off', async () => {
    const { pickKnowledge } = await import('../../src/learn/knowledge');
    expect(pickKnowledge([], [], 0.5)).toBeNull();
  });
});
