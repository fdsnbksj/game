import { useState } from 'react';
import { useNonogramStore } from '../nonogramStore';
import { renamePlayer } from '../services/players';
import { useGameStore } from '../store';

export function Profile() {
  const player = useGameStore((s) => s.player);
  const solved = useNonogramStore((s) => s.solved);
  const level = useNonogramStore((s) => s.level);
  const days = useNonogramStore((s) => s.dailySolved.length);
  const ladderOnline = useNonogramStore((s) => s.ladderOnline);
  const waiting = useNonogramStore((s) => s.pending.length);
  return (
    <main className="screen with-tabs">
      <header className="page-head">
        <div>
          <p className="micro">Profile</p>
          <h1>{player?.displayName ?? 'You'}</h1>
        </div>
      </header>

      <section className="glass card-pad">
        <p className="micro">Display name</p>
        {player ? (
          <NameEditor name={player.displayName} />
        ) : (
          <p className="note">Connecting… Your name can be changed once you're online. Puzzles play either way.</p>
        )}
        <p className="note">Shown on the rankings.</p>
      </section>

      <section className="glass tray" aria-label="Your stats">
        <dl className="tray-stats">
          <div>
            <dd>{solved}</dd>
            <dt>Solved</dt>
          </div>
          <div>
            <dd>{level - 1}</dd>
            <dt>Levels</dt>
          </div>
          <div>
            <dd>{days}</dd>
            <dt>Daily puzzles</dt>
          </div>
        </dl>
      </section>
      <p className="note center-text">
        {!ladderOnline
          ? "Your levels couldn't be saved online, so they're counted on this device only."
          : waiting > 0
            ? `${waiting} ${waiting === 1 ? 'solve' : 'solves'} waiting for a connection.`
            : 'Stats are counted on this device.'}
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
