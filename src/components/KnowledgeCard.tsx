import { knowledgeById, TOPICS } from '../learn/knowledge';
import { useKnowledgeStore } from '../knowledgeStore';

/** One idea worth knowing: what it is, and something to do with it today. */
export function KnowledgeCard({ id }: { id: string }) {
  const card = knowledgeById(id);
  const saved = useKnowledgeStore((s) => s.saved.includes(id));
  const toggleSaved = useKnowledgeStore((s) => s.toggleSaved);
  if (!card) return null;

  return (
    <article className="knowledge">
      <header className="knowledge-head">
        <span className="micro">{TOPICS.find((t) => t.id === card.topic)?.name}</span>
        <button className={saved ? 'save-button on' : 'save-button'} aria-pressed={saved} onClick={() => toggleSaved(id)}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M7 4h10v16l-5-4-5 4z" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          {saved ? 'Saved' : 'Save'}
        </button>
      </header>
      <h2>{card.title}</h2>
      <p className="knowledge-body">{card.body}</p>
      <p className="knowledge-try">
        <span className="micro">Try this</span>
        {card.tryThis}
      </p>
    </article>
  );
}
