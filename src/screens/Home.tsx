import { useState } from 'react';
import { Link } from 'react-router';
import { BirdPreview } from '../components/BirdPreview';
import { renamePlayer } from '../services/profile';
import { dayId } from '../shared/constants';
import { useGameStore } from '../store';

export function Home() {
  const profile = useGameStore((s) => s.profile)!;
  const loadout = useGameStore((s) => s.loadout);
  const bestToday = profile.dailyId === dayId() ? profile.dailyScore : 0;

  return (
    <main className="screen">
      <h1 className="title">Neon Flap</h1>
      <BirdPreview loadout={loadout} />
      <NameEditor name={profile.displayName} />
      <p className="muted">
        Today {bestToday} · Best {profile.bestScore} · {profile.gamesPlayed} runs
      </p>
      <nav className="menu">
        <Link className="button primary" to="/play">
          Play
        </Link>
        <Link className="button" to="/customize">
          Customize
        </Link>
        <Link className="button" to="/leaderboard">
          Leaderboard
        </Link>
      </nav>
    </main>
  );
}

function NameEditor({ name }: { name: string }) {
  const [draft, setDraft] = useState(name);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const trimmed = draft.trim();
  const canSave = trimmed.length > 0 && trimmed !== name && status !== 'saving';

  async function save() {
    setStatus('saving');
    try {
      await renamePlayer(trimmed);
      setStatus('idle');
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
      {status === 'error' && <span className="error">Couldn't save</span>}
    </form>
  );
}
