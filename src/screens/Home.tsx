import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CreatureChip } from '../components/CreatureChip';
import { SoundToggle } from '../components/SoundToggle';
import { Wordmark } from '../components/Wordmark';
import { useRunStore } from '../runStore';

const PARADE = ['sparkmouse', 'bytebat', 'thunderstag', 'mirrorowl', 'glitchtoad'];

export function Home() {
  const run = useRunStore((s) => s.run);
  const stats = useRunStore((s) => s.stats);
  const startRun = useRunStore((s) => s.startRun);
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const inProgress = run !== null && !run.done;

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  function newRun() {
    if (inProgress && !confirming) {
      setConfirming(true);
      return;
    }
    startRun();
    navigate('/run');
  }

  return (
    <main className="screen home">
      <header className="topbar">
        <span className="spacer" />
        <SoundToggle />
      </header>
      <Wordmark />
      <p className="tagline">Draft neon creatures. Build synergies. Outlast every rival.</p>
      <div className="parade" aria-hidden="true">
        {PARADE.map((unitId, i) => (
          <span key={unitId} style={{ animationDelay: `${i * 160}ms` }}>
            <CreatureChip unitId={unitId} size={i === 2 ? 72 : 52} />
          </span>
        ))}
      </div>

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

      <nav className="menu">
        {inProgress ? (
          <>
            <Link className="button primary play-cta" to="/run">
              Continue
            </Link>
            <p className="muted continue-line">
              Round {run.round} · {run.hp} HP · {run.wins} wins
            </p>
            <button className={confirming ? 'button danger' : 'button'} onClick={newRun}>
              {confirming ? 'Tap again to abandon this run' : 'New run'}
            </button>
          </>
        ) : (
          <button className="button primary play-cta" onClick={newRun}>
            Play
          </button>
        )}
        <div className="menu-row">
          <Link className="button" to="/how">
            How to play
          </Link>
          <Link className="button" to="/profile">
            Profile
          </Link>
          <Link className="button" to="/ranks">
            Ranks
          </Link>
        </div>
      </nav>
    </main>
  );
}
