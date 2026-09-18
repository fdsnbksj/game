import { useState } from 'react';
import { Link } from 'react-router';
import { BirdPreview } from '../components/BirdPreview';
import { SoundToggle } from '../components/SoundToggle';
import { FlameIcon } from '../components/icons';
import { Wordmark } from '../components/Wordmark';
import { liveStreak, streakAtRisk } from '../shared/progress';
import { renamePlayer } from '../services/profile';
import { dayId } from '../shared/constants';
import { useGameStore } from '../store';

export function Home() {
  const profile = useGameStore((s) => s.profile)!;
  const loadout = useGameStore((s) => s.loadout);
  const today = dayId();
  const bestToday = profile.dailyId === today ? profile.dailyScore : 0;
  const streak = liveStreak(profile, today);

  return (
    <main className="screen">
      <header className="topbar">
        <span className="spacer" />
        <SoundToggle />
      </header>
      <Wordmark />
      <BirdPreview loadout={loadout} />
      <NameEditor name={profile.displayName} />
      <dl className="stat-row">
        <div className="stat">
          <dt>Today</dt>
          <dd>{bestToday}</dd>
        </div>
        <div className="stat">
          <dt>Best</dt>
          <dd>{profile.bestScore}</dd>
        </div>
        <div className={streak > 0 ? 'stat streak lit' : 'stat streak'}>
          <dt>Streak</dt>
          <dd>
            <FlameIcon />
            {streak}
          </dd>
        </div>
      </dl>
      {streakAtRisk(profile, today) && (
        <p className="nudge">Score today to keep your {profile.streak}-day streak</p>
      )}
      <nav className="menu">
        <Link className="button primary play-cta" to="/play">
          Play
        </Link>
        <div className="menu-row">
          <Link className="button" to="/customize">
            Customize
          </Link>
          <Link className="button" to="/leaderboard">
            Ranks
          </Link>
          <Link className="button" to="/profile">
            Profile
          </Link>
        </div>
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
