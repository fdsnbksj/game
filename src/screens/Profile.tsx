import { useState } from 'react';
import { Link } from 'react-router';
import { useRunStore } from '../runStore';
import { renamePlayer } from '../services/profile';
import { useGameStore } from '../store';

export function Profile() {
  const profile = useGameStore((s) => s.profile)!;
  const stats = useRunStore((s) => s.stats);
  return (
    <main className="screen">
      <header className="topbar">
        <Link className="button small" to="/">
          ← Home
        </Link>
        <h2>Profile</h2>
      </header>

      <NameEditor name={profile.displayName} />

      <dl className="stat-row">
        <div className="stat">
          <dt>Runs</dt>
          <dd>{stats.runs}</dd>
        </div>
        <div className="stat">
          <dt>Best wins</dt>
          <dd>{stats.bestWins}</dd>
        </div>
        <div className="stat">
          <dt>Best round</dt>
          <dd>{stats.bestRound}</dd>
        </div>
      </dl>
      <p className="muted small-print">
        Stats are kept on this device for now. Online rankings, and rivals built from other players' boards, are coming
        next.
      </p>
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
