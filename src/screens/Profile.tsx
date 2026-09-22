import { useState } from 'react';
import { useRunStore } from '../runStore';
import { renamePlayer } from '../services/players';
import { useGameStore } from '../store';

export function Profile() {
  const player = useGameStore((s) => s.player)!;
  const stats = useRunStore((s) => s.stats);
  return (
    <main className="screen with-tabs">
      <header className="page-head">
        <div>
          <p className="micro">Profile</p>
          <h1>{player.displayName}</h1>
        </div>
      </header>

      <section className="glass card-pad">
        <p className="micro">Display name</p>
        <NameEditor name={player.displayName} />
        <p className="note">Shown on the rankings, and to players who meet your teams as rivals.</p>
      </section>

      <section className="glass tray" aria-label="Your stats">
        <dl className="tray-stats">
          <div>
            <dd>{stats.runs}</dd>
            <dt>Runs</dt>
          </div>
          <div>
            <dd>{stats.bestWins}</dd>
            <dt>Best wins</dt>
          </div>
          <div>
            <dd>{stats.bestRound}</dd>
            <dt>Best round</dt>
          </div>
        </dl>
      </section>
      <p className="note center-text">Stats are counted on this device.</p>
    </main>
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
      <input aria-label="Display name" value={draft} maxLength={20} onChange={(e) => setDraft(e.target.value)} />
      <button className="button small" disabled={!canSave}>
        Rename
      </button>
      {status === 'saved' && <span className="muted">Saved</span>}
      {status === 'error' && <span className="error">Couldn't save</span>}
    </form>
  );
}
