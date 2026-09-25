import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CreatureChip } from '../components/CreatureChip';
import { SettingsButton } from '../components/SettingsSheet';
import { TraitIcon } from '../components/TraitIcon';
import { Wordmark } from '../components/Wordmark';
import { usePuzzleStore } from '../puzzleStore';
import { useRunStore } from '../runStore';
import { dayId } from '../shared/constants';
import { getTrait, UNITS } from '../sim/balance';

/** How long each creature takes the stage on Home. */
const FEATURE_MS = 3200;

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

  function newRun(mode: 'run' | 'daily' = 'run') {
    if (inProgress && !confirming) {
      setConfirming(true);
      return;
    }
    startRun(mode);
    navigate('/run');
  }

  return (
    <main className="screen home with-tabs">
      <header className="home-top">
        <span className="micro">Season 1</span>
        <SettingsButton />
      </header>

      <div className="home-brand">
        <Wordmark />
        <p className="tagline">Draft creatures. Build a team. Outlast every rival.</p>
      </div>

      <section className="glass hero">
        <FeaturedCreature />
        {inProgress ? (
          <>
            <Link className="button primary big" to="/run">
              Continue
            </Link>
            <p className="micro center-text">
              {run.mode === 'daily' ? 'Daily challenge' : 'Run'} · round {run.round} · {run.hp} HP · {run.wins} wins
            </p>
            <button className={confirming ? 'button danger' : 'button ghost'} onClick={() => newRun()}>
              {confirming ? 'Tap again to abandon this run' : 'Start a new run'}
            </button>
          </>
        ) : (
          <button className="button primary big" onClick={() => newRun()}>
            Play
          </button>
        )}
      </section>

      <DailyCard onPlay={() => newRun('daily')} />
      <PuzzleCard />

      <section className="glass tray" aria-label="Your stats">
        {stats.runs === 0 ? (
          <p className="tray-empty">Your first run awaits. Win rounds to climb today's rankings.</p>
        ) : (
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
        )}
      </section>
    </main>
  );
}

/** A creature on a lit pedestal, changing every few seconds. */
function FeaturedCreature() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * UNITS.length));
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % UNITS.length), FEATURE_MS);
    return () => clearInterval(timer);
  }, []);
  const unit = UNITS[index];
  return (
    <div className="featured">
      <div className="featured-stage" key={unit.id}>
        <CreatureChip unitId={unit.id} size={112} />
      </div>
      <div className="featured-name">
        <strong>{unit.name}</strong>
        <span className="featured-traits">
          <TraitIcon trait={unit.origin} size={14} /> {getTrait(unit.origin).name}
          <TraitIcon trait={unit.role} size={14} /> {getTrait(unit.role).name}
        </span>
      </div>
    </div>
  );
}

/** Battle puzzles: endless, and the same levels for everyone. */
function PuzzleCard() {
  const level = usePuzzleStore((s) => s.level);
  return (
    <Link className="glass daily-card puzzle-card" to="/puzzle">
      <span className="daily-mark" aria-hidden="true" />
      <span className="daily-text">
        <span className="micro">Puzzles</span>
        <strong>{level > 1 ? `Level ${level}` : 'Endless levels'}</strong>
      </span>
      <span className="daily-go">{level > 1 ? 'Resume' : 'Play'}</span>
    </Link>
  );
}

/** The daily challenge: the same run for everyone, once a day. */
function DailyCard({ onPlay }: { onPlay: () => void }) {
  const run = useRunStore((s) => s.run);
  const dailyDone = useRunStore((s) => s.dailyDone);
  const playing = run !== null && !run.done && run.mode === 'daily';
  const done = dailyDone(dayId()) && !playing;

  return (
    <button className={done ? 'glass daily-card done' : 'glass daily-card'} onClick={onPlay} disabled={done}>
      <span className="daily-mark" aria-hidden="true" />
      <span className="daily-text">
        <span className="micro">Daily challenge</span>
        <strong>{playing ? `In progress · round ${run.round}` : done ? 'Played today' : 'The same run for everyone'}</strong>
      </span>
      <span className="daily-go">{playing ? 'Resume' : done ? '✓' : 'Play'}</span>
    </button>
  );
}
