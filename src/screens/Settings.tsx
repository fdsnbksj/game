import { useCameFrom } from '../components/cameFrom';
import { Page, Toggle } from '../components/Page';
import { useKnowledgeStore } from '../knowledgeStore';
import { KNOWLEDGE, TOPICS } from '../learn/knowledge';
import { useNonogramStore } from '../nonogramStore';

export function Settings() {
  const cameFrom = useCameFrom();
  const topics = useKnowledgeStore((s) => s.topics);
  const setTopic = useKnowledgeStore((s) => s.setTopic);
  const haptics = useNonogramStore((s) => s.haptics);
  const setHaptics = useNonogramStore((s) => s.setHaptics);
  const canVibrate = 'vibrate' in navigator;

  return (
    <Page title="Settings" back={cameFrom() ?? '/'}>
      <p className="group-title">A card after each puzzle</p>
      <div className="group">
        {TOPICS.map((topic) => (
          <Toggle
            key={topic.id}
            label={`${topic.name} (${KNOWLEDGE.filter((k) => k.topic === topic.id).length})`}
            on={topics.includes(topic.id)}
            onChange={(on) => setTopic(topic.id, on)}
          />
        ))}
      </div>

      {canVibrate && (
        <div className="group">
          <Toggle label="Vibrate when solved" on={haptics} onChange={setHaptics} />
        </div>
      )}

      <p className="group-title">How to play</p>
      <div className="group card-pad">
        <p className="note">
          The numbers by each row and column are the runs of filled squares in it, in order, with a gap between runs. Tap to
          fill, drag to fill a line, switch to Cross to mark squares you know are empty. Every puzzle can be solved by logic
          alone, and every tap is saved, so stop whenever you like.
        </p>
      </div>

    </Page>
  );
}
