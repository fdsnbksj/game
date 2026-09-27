import { useState } from 'react';
import { Page, Toggle } from '../components/Page';
import { useKnowledgeStore } from '../knowledgeStore';
import { KNOWLEDGE, TOPICS } from '../learn/knowledge';
import { useNonogramStore } from '../nonogramStore';
import { reloadFresh } from '../reload';
import { renamePlayer } from '../services/players';
import { useGameStore } from '../store';

export function Settings() {
  const player = useGameStore((s) => s.player);
  const topics = useKnowledgeStore((s) => s.topics);
  const setTopic = useKnowledgeStore((s) => s.setTopic);
  const haptics = useNonogramStore((s) => s.haptics);
  const setHaptics = useNonogramStore((s) => s.setHaptics);
  const canVibrate = 'vibrate' in navigator;

  return (
    <Page title="Settings">
      <p className="group-title">Name on the rankings</p>
      <div className="group card-pad">
        {player ? <NameEditor name={player.displayName} /> : <p className="note">Connecting… You can change it once you're online.</p>}
      </div>

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

      <button className="button ghost" onClick={() => void reloadFresh()}>
        Reload the latest version
      </button>
    </Page>
  );
}

function NameEditor({ name }: { name: string }) {
  const [draft, setDraft] = useState(name);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const trimmed = draft.trim();
  const canSave = trimmed.length > 0 && trimmed !== name && status !== 'saving';

  async function save() {
    setStatus('saving');
    try {
      await renamePlayer(trimmed);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <form
      className="name-editor"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <input aria-label="Name" value={draft} maxLength={20} onChange={(e) => setDraft(e.target.value)} />
      <button className="button" disabled={!canSave}>
        {status === 'saved' && trimmed === name ? 'Saved' : 'Save'}
      </button>
      {status === 'error' && <span className="error">Couldn't save</span>}
    </form>
  );
}
