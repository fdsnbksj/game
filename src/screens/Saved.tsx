import { KnowledgeCard } from '../components/KnowledgeCard';
import { Page } from '../components/Page';
import { useKnowledgeStore } from '../knowledgeStore';

export function Saved() {
  const saved = useKnowledgeStore((s) => s.saved);
  return (
    <Page title="Saved cards" back="/nonograms">
      {saved.length === 0 && <p className="note">Tap Save on a card after a puzzle to keep it here.</p>}
      {saved.map((id) => (
        <section key={id} className="group card-pad">
          <KnowledgeCard id={id} />
        </section>
      ))}
    </Page>
  );
}
