import { describe, expect, it } from 'vitest';

describe('knowledge cards', () => {
  it('have unique ids, every topic, and fit on a phone', async () => {
    const { KNOWLEDGE, TOPICS } = await import('../../src/learn/knowledge');
    expect(new Set(KNOWLEDGE.map((k) => k.id)).size).toBe(KNOWLEDGE.length);
    for (const topic of TOPICS) expect(KNOWLEDGE.filter((k) => k.topic === topic.id).length).toBeGreaterThanOrEqual(40);
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

  it("prefer the solved picture's topic, when it's on", async () => {
    const { knowledgeById, pickKnowledge } = await import('../../src/learn/knowledge');
    for (let i = 0; i < 10; i++) {
      const next = pickKnowledge(['psychology', 'software'], [], i / 10, 'software')!;
      expect(knowledgeById(next.id)?.topic).toBe('software');
    }
    const off = pickKnowledge(['psychology'], [], 0.5, 'software')!;
    expect(knowledgeById(off.id)?.topic).toBe('psychology');
  });

  it('show nothing with every topic off', async () => {
    const { pickKnowledge } = await import('../../src/learn/knowledge');
    expect(pickKnowledge([], [], 0.5)).toBeNull();
  });
});
