import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { BoardStoreContext } from '../boardStore';
import { PhaserGame } from '../game/PhaserGame';
import { BattleScene } from '../game/scenes/BattleScene';
import { HINT_AFTER, usePuzzleStore } from '../puzzleStore';
import { boardCount } from '../sim/planning';
import { Bag, FightBar, Notice, TeamStrip, UnitBubble, UnitGhost, UnitSheet, useDockInset } from './board';

// Battle puzzles: the rival is already on the board; place your hand and fight. Uses the
// run screen's board and parts, reading the puzzle store instead (src/puzzleStore.ts).

const SCENES = [BattleScene];

export function Puzzle() {
  const run = usePuzzleStore((s) => s.run);
  const battle = usePuzzleStore((s) => s.battle);
  // While a cleared level's replay plays, it's still the one on show.
  const level = usePuzzleStore((s) => s.cleared?.level ?? s.level);
  const open = usePuzzleStore((s) => s.open);
  const registry = useMemo(() => ({ store: usePuzzleStore }), []);
  const { stage, tray, fightBar } = useDockInset(battle !== null);

  // Clears still waiting to be written go now, and again when the connection comes back.
  const sync = usePuzzleStore((s) => s.sync);
  useEffect(() => {
    void sync();
    const retry = () => void sync();
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [sync]);

  useEffect(() => {
    // Making a level can take a moment on a phone; let the screen paint first.
    const timer = window.setTimeout(open, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <BoardStoreContext.Provider value={usePuzzleStore}>
      <main className={battle ? 'screen run puzzle fighting' : 'screen run puzzle'}>
        <PuzzleHud level={level} />
        {battle ? (
          <TeamStrip side="rival" name={battle.opponent} tag="puzzle" />
        ) : (
          <p className="puzzle-brief">
            {run ? 'Place your creatures to beat the rival. Hold one to read it.' : 'Setting up the board…'}
          </p>
        )}
        <div className="stage" ref={stage}>
          <PhaserGame className="board-canvas" scenes={SCENES} registry={registry} responsive transparent />
          <div className="dock">
            <div ref={tray} className={battle ? 'dock-layer tray-layer inactive' : 'dock-layer tray-layer'} aria-hidden={battle ? true : undefined}>
              <PuzzleTray />
            </div>
            <div ref={fightBar} className={battle ? 'dock-layer fight-layer' : 'dock-layer fight-layer inactive'} aria-hidden={battle ? undefined : true}>
              {battle && <FightBar />}
            </div>
          </div>
          <LostCard />
        </div>
        <UnitGhost />
        <UnitBubble />
        <UnitSheet canSell={false} />
        <Notice />
        <ClearedCard />
      </main>
    </BoardStoreContext.Provider>
  );
}

function PuzzleHud({ level }: { level: number }) {
  // Losses on the level on show, which during a winning replay is the one just cleared.
  const attempts = usePuzzleStore((s) => (s.cleared ? s.cleared.tries - 1 : s.attempts));
  return (
    <header className="glass run-hud puzzle-hud">
      <Link className="icon-button" to="/" aria-label="Home">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      <div className="hud-round">
        <span className="micro">Puzzle</span>
        <strong>{level}</strong>
      </div>
      <span />
      <div className="hud-wins" aria-label={`${attempts} tries`}>
        <strong>{attempts}</strong>
        <span className="micro">{attempts === 1 ? 'Try' : 'Tries'}</span>
      </div>
    </header>
  );
}

function PuzzleTray() {
  const run = usePuzzleStore((s) => s.run);
  const attempts = usePuzzleStore((s) => s.attempts);
  const fight = usePuzzleStore((s) => s.fight);
  const reset = usePuzzleStore((s) => s.reset);
  const hint = usePuzzleStore((s) => s.hint);
  if (!run) return <section className="glass tray-dock puzzle-tray" />;
  const placed = boardCount(run);
  const waiting = run.level - placed;

  return (
    <section className="glass tray-dock puzzle-tray">
      <div className="puzzle-status">
        <span className="board-count">
          {placed}/{run.level}
        </span>
        <span className="note">{waiting > 0 ? `${waiting} still on the bench` : 'Everyone is placed'}</span>
        <span className="puzzle-actions">
          {attempts >= HINT_AFTER && (
            <button className="button small" onClick={hint}>
              Hint
            </button>
          )}
          <button className="button small" disabled={placed === 0} onClick={reset}>
            Reset
          </button>
        </span>
      </div>
      {run.bag.length > 0 || run.board.some((unit) => unit?.item) || run.bench.some((unit) => unit?.item) ? (
        <Bag bag={run.bag} hint="Every item is given out" />
      ) : null}
      <button className="button primary big fight-button" disabled={placed === 0} onClick={fight}>
        Fight
      </button>
    </section>
  );
}

/** After a lost fight: a moment's card over the board, then back to it. */
function LostCard() {
  const lost = usePuzzleStore((s) => s.lost);
  const over = usePuzzleStore((s) => s.battle?.over ?? false);
  const fighting = usePuzzleStore((s) => s.battle !== null);
  if (!lost || !(over || !fighting)) return null;
  return <LostNote />;
}

function LostNote() {
  const attempts = usePuzzleStore((s) => s.attempts);
  useEffect(() => {
    const clear = () => usePuzzleStore.setState({ lost: false });
    const timer = window.setTimeout(clear, 2400);
    window.addEventListener('pointerdown', clear);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', clear);
    };
  }, []);
  return (
    <div className="glass round-result lost" role="status">
      <strong>Not this time</strong>
      <span className="note">{attempts >= HINT_AFTER ? 'Try another layout, or take a hint' : 'Try another layout'}</span>
    </div>
  );
}

/** A cleared level, once its fight has played out. */
function ClearedCard() {
  const cleared = usePuzzleStore((s) => s.cleared);
  const over = usePuzzleStore((s) => s.battle?.over ?? false);
  const fighting = usePuzzleStore((s) => s.battle !== null);
  const next = usePuzzleStore((s) => s.next);
  if (cleared === null || (fighting && !over)) return null;
  return (
    <div className="overlay">
      <div className="panel">
        <p className="micro">Puzzle {cleared.level}</p>
        <p className="big-score">Cleared</p>
        <p className="note">{cleared.tries === 1 ? 'First try.' : `In ${cleared.tries} tries.`}</p>
        <div className="menu">
          <button className="button primary" onClick={next}>
            Next puzzle
          </button>
          <Link className="button ghost" to="/">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
