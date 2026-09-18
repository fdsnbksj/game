import { FirebaseError } from 'firebase/app';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { FlameIcon } from '../components/icons';
import { SoundToggle } from '../components/SoundToggle';
import { sfx, startMusic, stopMusic } from '../game/audio';
import { EventBus, RESTART_RUN, RUN_FINISHED } from '../game/EventBus';
import { PhaserGame } from '../game/PhaserGame';
import { FlapScene, GAME_HEIGHT, GAME_WIDTH } from '../game/scenes/FlapScene';
import { submitRun, type RunOutcome } from '../services/runs';
import { dayId } from '../shared/constants';
import type { RunResult } from '../shared/types';
import { useGameStore } from '../store';

const SCENES = [FlapScene];

type RunState =
  | { status: 'playing' }
  | { status: 'saving'; score: number }
  | { status: 'done'; outcome: RunOutcome }
  | { status: 'failed'; score: number; message: string };

function describeError(error: unknown) {
  if (error instanceof FirebaseError && error.code === 'permission-denied') {
    return 'Score was rejected. Try again in a few seconds.';
  }
  return 'Could not save your score. Check your connection.';
}

export function Play() {
  const loadout = useGameStore((s) => s.loadout);
  const profile = useGameStore((s) => s.profile)!;
  const registry = useMemo(() => ({ loadout, courseId: dayId() }), [loadout]);
  const [run, setRun] = useState<RunState>({ status: 'playing' });

  useEffect(() => {
    const onFinished = ({ score }: RunResult) => {
      setRun({ status: 'saving', score });
      submitRun(score)
        .then((outcome) => {
          if (outcome.newBest || outcome.unlocked.length > 0 || outcome.newBestStreak) sfx.reward();
          setRun({ status: 'done', outcome });
        })
        .catch((error: unknown) => setRun({ status: 'failed', score, message: describeError(error) }));
    };
    EventBus.on(RUN_FINISHED, onFinished);
    startMusic();
    return () => {
      EventBus.off(RUN_FINISHED, onFinished);
      stopMusic();
    };
  }, []);

  function playAgain() {
    EventBus.emit(RESTART_RUN);
    setRun({ status: 'playing' });
  }

  const bestToday = profile.dailyId === dayId() ? profile.dailyScore : 0;

  return (
    <main className="screen play">
      <header className="topbar">
        <Link className="button small" to="/">
          ← Home
        </Link>
        <span className="spacer" />
        <SoundToggle />
      </header>
      <PhaserGame
        className="game-container"
        scenes={SCENES}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        registry={registry}
      />
      {run.status !== 'playing' && (
        <div className="overlay">
          <div className="panel">
            <p className="big-score">{run.status === 'done' ? run.outcome.score : run.score}</p>
            {run.status === 'done' && run.outcome.newBest && <p className="highlight">All-time best!</p>}
            {run.status === 'done' && run.outcome.newDailyBest && !run.outcome.newBest && (
              <p className="highlight">Best today!</p>
            )}
            {run.status === 'done' && run.outcome.streak !== null && (
              <p className="streak-line">
                <FlameIcon />
                {run.outcome.streak === 1
                  ? 'Streak started. Come back tomorrow!'
                  : `${run.outcome.streak}-day streak${run.outcome.newBestStreak ? ' · your best' : ''}`}
              </p>
            )}
            {run.status === 'done' && run.outcome.unlocked.length > 0 && (
              <>
                <p className="eyebrow">Unlocked</p>
                <ul className="unlocks">
                  {run.outcome.unlocked.map((item) => (
                    <li key={item.id} className={`unlock ${item.rarity}`}>
                      {item.name}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="muted">
              Today {bestToday} · Best {profile.bestScore}
            </p>
            {run.status === 'saving' && (
              <p className="muted status-line">
                <span className="spinner" aria-hidden="true" />
                Saving…
              </p>
            )}
            {run.status === 'failed' && <p className="error">{run.message}</p>}
            <div className="menu">
              <button className="button primary" onClick={playAgain} autoFocus>
                Play again
              </button>
              <Link className="button" to="/">
                Home
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
