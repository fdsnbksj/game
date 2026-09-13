import { FirebaseError } from 'firebase/app';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { EventBus, RUN_FINISHED } from '../game/EventBus';
import { PhaserGame } from '../game/PhaserGame';
import { GAME_HEIGHT, GAME_WIDTH, PlayScene } from '../game/scenes/PlayScene';
import { submitRun, type RunOutcome } from '../services/runs';
import type { RunResult } from '../shared/types';
import { useGameStore } from '../store';

const SCENES = [PlayScene];

type RunState =
  | { status: 'playing' }
  | { status: 'saving'; score: number }
  | { status: 'saved'; outcome: RunOutcome }
  | { status: 'failed'; score: number; message: string };

function describeError(error: unknown) {
  if (error instanceof FirebaseError && error.code === 'permission-denied') {
    return 'Score was rejected. Runs must be at least a few seconds apart.';
  }
  return 'Could not save your score. Check your connection.';
}

export function Play() {
  const loadout = useGameStore((s) => s.loadout);
  const registry = useMemo(() => ({ loadout }), [loadout]);
  const [runId, setRunId] = useState(0);
  const [run, setRun] = useState<RunState>({ status: 'playing' });

  useEffect(() => {
    const onFinished = ({ score }: RunResult) => {
      setRun({ status: 'saving', score });
      submitRun(score)
        .then((outcome) => setRun({ status: 'saved', outcome }))
        .catch((error: unknown) => setRun({ status: 'failed', score, message: describeError(error) }));
    };
    EventBus.on(RUN_FINISHED, onFinished);
    return () => {
      EventBus.off(RUN_FINISHED, onFinished);
    };
  }, []);

  function playAgain() {
    setRunId((id) => id + 1);
    setRun({ status: 'playing' });
  }

  return (
    <main className="screen play">
      <header className="topbar">
        <Link className="button small" to="/">
          ← Home
        </Link>
      </header>
      {/* A new key remounts the Phaser game for a fresh run. */}
      <PhaserGame
        key={runId}
        className="game-container"
        scenes={SCENES}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        registry={registry}
      />
      {run.status !== 'playing' && (
        <div className="overlay">
          <div className="panel">
            {run.status === 'saving' && <p className="muted">Saving…</p>}
            <p className="big-score">{run.status === 'saved' ? run.outcome.score : run.score}</p>
            {run.status === 'saved' && run.outcome.newBest && <p className="highlight">New best!</p>}
            {run.status === 'saved' && run.outcome.unlocked.length > 0 && (
              <p>Unlocked: {run.outcome.unlocked.map((item) => item.name).join(', ')}</p>
            )}
            {run.status === 'failed' && <p className="error">{run.message}</p>}
            {run.status !== 'saving' && (
              <div className="menu">
                <button className="button primary" onClick={playAgain}>
                  Play again
                </button>
                <Link className="button" to="/">
                  Home
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
