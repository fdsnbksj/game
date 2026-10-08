import { useEffect, useRef, useState, type ReactNode } from 'react';
import { botMove } from '../../games/hero/bots';
import { SummaryRow } from '../../components/SummaryRow';
import { rankName, stopwatchTarget, VISIBLE_MS, WHEEL, type Move } from '../../games/hero/skills';
import { type HeroState, type Side, type Turn } from '../../games/hero/state';
import { SKILLS, type SkillId } from '../../games/hero/stats';

// One fight on screen, a bot's or a friend's: both HP bars on top, what just happened in
// the middle, and your skills (or the skill's own button) at the bottom, under the thumb. The screen only
// collects a move; the game (src/games/hero) decides what it does.

const SKILL_NAME: Record<SkillId, string> = { stopwatch: 'Stopwatch', roulette: 'Roulette', poker: 'Poker' };

export function Fight({
  state,
  me,
  names,
  onMove,
  waiting,
  locked = false,
  children,
}: {
  state: HeroState;
  me: Side;
  /** Fighter names, in fighter order; yours shows as "You". */
  names: [string, string];
  /** Sends your move; only called on your turn. */
  onMove: (move: Move) => void;
  /** What the other side is doing while it's their turn. */
  waiting: string;
  /** Your move is on its way: no other until it lands (shows `waiting`). */
  locked?: boolean;
  /** Laid over the fight: its result. */
  children?: ReactNode;
}) {
  const them: Side = me === 0 ? 1 : 0;
  const mine = state.turn === me && state.winner === null && !locked;
  const [skill, setSkill] = useState<SkillId | null>(null);
  // Once the stopwatch is running there's no going back for another try at the same target.
  const [committed, setCommitted] = useState(false);
  const last = state.log.at(-1);
  // A new turn: back to the skill list.
  useEffect(() => {
    setSkill(null);
    setCommitted(false);
  }, [state.log.length]);

  const tree = state.fighters[me].tree;
  const name = (side: Side) => (side === me ? 'You' : names[side]);

  return (
    <div className="hero-fight">
      <HpBar label={names[them]} hp={state.hp[them]} max={state.stats[them].hp} foe active={state.turn === them && state.winner === null} />
      <HpBar label="You" hp={state.hp[me]} max={state.stats[me].hp} active={mine} />

      <div className="hero-stage">
        {skill && mine ? (
          <SkillPlay key={`${state.log.length}:${skill}`} skill={skill} state={state} onMove={onMove} onCommit={() => setCommitted(true)} />
        ) : last ? (
          <Reveal key={state.log.length} turn={last} name={name(last.by)} target={name(last.by === 0 ? 1 : 0)} />
        ) : (
          <p className="note center-note">{mine ? 'You go first. Pick a skill.' : `${names[them]} goes first.`}</p>
        )}
      </div>

      <div className="hero-controls">
        {state.winner !== null ? null : !mine ? (
          <p className="note center-note">{waiting}</p>
        ) : skill ? (
          <button className="button ghost" disabled={committed} onClick={() => setSkill(null)}>
            ‹ Another skill
          </button>
        ) : (
          <div className="hero-skills">
            {SKILLS.map((s) => {
              const level = tree[s];
              return (
                <button key={s} className={`hero-skill ${s}`} disabled={level < 1} onClick={() => setSkill(s)}>
                  <SkillIcon skill={s} />
                  <strong>{SKILL_NAME[s]}</strong>
                  <small>{level < 1 ? 'Locked' : `Lv ${level}`}</small>
                </button>
              );
            })}
          </div>
        )}
        {state.log.length > 0 && (
          <SummaryRow label="Fight log" figures={`${state.log.length} turns`} title="Fight log">
            <ol className="group hero-log">
              {[...state.log].reverse().map((t, i) => (
                <li key={i} className="row">
                  <span>{describe(t, name(t.by))}</span>
                </li>
              ))}
            </ol>
          </SummaryRow>
        )}
      </div>
      {children}
    </div>
  );
}

function HpBar({ label, hp, max, foe, active }: { label: string; hp: number; max: number; foe?: boolean; active: boolean }) {
  const pct = Math.max(0, Math.round((hp * 100) / max));
  return (
    <div className={`hero-hp${foe ? ' foe' : ''}${active ? ' active' : ''}`}>
      <div className="hero-hp-top">
        <strong>{label}</strong>
        <span>
          {hp} / {max}
        </span>
      </div>
      <div className="hero-hp-track">
        <div className="hero-hp-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** One line for the log. */
function describe(t: Turn, who: string): string {
  const d = t.detail;
  const hit = t.kill ? 'instant kill!' : t.damage ? `${t.damage} damage${t.crit ? ' (crit)' : ''}` : 'no damage';
  if (d.skill === 'stopwatch') return `${who}: Stopwatch ${secs(d.ms)} for ${secs(d.target)}, ${hit}`;
  if (d.skill === 'roulette') return `${who}: Roulette on ${d.pick}, ${d.hit ? 'hit' : 'missed'}, ${hit}`;
  return `${who}: Poker ${rankName(d.mine)} vs ${rankName(d.theirs)}, ${hit}`;
}

const secs = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

/** How long a turn's result stays up before the bot plays. */
const BOT_DELAY_MS = 1600;

/** Side 1 is played by the bot brain (a bot level, or another player's hero in the arena). */
export function useBotTurn(state: HeroState, spread: number, play: (move: Move) => void) {
  const latest = useRef(play);
  latest.current = play;
  useEffect(() => {
    if (state.winner !== null || state.turn !== 1) return;
    // Let the last result sink in, then play.
    const timer = setTimeout(() => latest.current(botMove(state, 1, { spread })), state.log.length ? BOT_DELAY_MS : 700);
    return () => clearTimeout(timer);
  }, [state, spread]);
}

// ---------- Playing a skill ----------

function SkillPlay({ skill, state, onMove, onCommit }: { skill: SkillId; state: HeroState; onMove: (move: Move) => void; onCommit: () => void }) {
  if (skill === 'stopwatch') return <Stopwatch target={stopwatchTarget(state.seed, state.log.length)} onStart={onCommit} onStop={(ms) => onMove({ skill, ms })} />;
  if (skill === 'roulette') return <RoulettePick balls={state.fighters[state.turn].tree.roulette} onPick={(pick) => onMove({ skill, pick })} />;
  return (
    <div className="hero-play">
      <p className="micro">Poker</p>
      <div className="hero-cards">
        <Card rank={null} />
        <Card rank={null} />
      </div>
      <p className="note center-note">You each draw a card from 2 to A. Higher wins a big crit; lower does nothing.</p>
      <button className="button primary hero-go" onClick={() => onMove({ skill: 'poker' })}>
        Draw
      </button>
    </div>
  );
}

/** Start, then Stop as close to the target as you can. The clock hides after a second. */
function Stopwatch({ target, onStart, onStop }: { target: number; onStart: () => void; onStop: (ms: number) => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [shown, setShown] = useState(0);
  const frame = useRef(0);
  useEffect(() => {
    if (startedAt === null) return;
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      setShown(elapsed);
      if (elapsed < VISIBLE_MS) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [startedAt]);

  const hidden = startedAt !== null && shown >= VISIBLE_MS;
  return (
    <div className="hero-play">
      <p className="micro">Stop at</p>
      <p className="hero-target">{target / 1000} s</p>
      <p className={`hero-clock${hidden ? ' hidden' : ''}`}>{hidden ? '?.??' : (shown / 1000).toFixed(2)}</p>
      <p className="note center-note">{startedAt === null ? 'The clock hides after a second. Count in your head.' : 'Counting…'}</p>
      {startedAt === null ? (
        <button
          className="button primary hero-go"
          onPointerDown={() => {
            setStartedAt(performance.now());
            onStart();
          }}
        >
          Start
        </button>
      ) : (
        <button className="button primary hero-go stop" onPointerDown={() => onStop(Math.round(performance.now() - startedAt))}>
          Stop
        </button>
      )}
    </div>
  );
}

function RoulettePick({ balls, onPick }: { balls: number; onPick: (pick: number) => void }) {
  const [pick, setPick] = useState<number | null>(null);
  return (
    <div className="hero-play">
      <p className="micro">
        Pick a number · {balls} {balls === 1 ? 'ball' : 'balls'}
      </p>
      <Wheel pick={pick} onPick={setPick} />
      <button className="button primary hero-go" disabled={pick === null} onClick={() => pick !== null && onPick(pick)}>
        {pick === null ? 'Pick a number' : `Spin on ${pick}`}
      </button>
    </div>
  );
}

const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const colourOf = (n: number) => (n === 0 ? 'green' : redNumbers.has(n) ? 'red' : 'black');

function Wheel({ pick, balls = [], onPick }: { pick: number | null; balls?: number[]; onPick?: (n: number) => void }) {
  return (
    <div className="hero-wheel">
      {Array.from({ length: WHEEL }, (_, n) => {
        const count = balls.filter((b) => b === n).length;
        const order = balls.indexOf(n);
        return (
          <button
            key={n}
            className={`hero-slot ${colourOf(n)}${pick === n ? ' picked' : ''}${count ? ' ball' : ''}`}
            style={count ? { animationDelay: `${order * 180}ms` } : undefined}
            disabled={!onPick}
            onClick={() => onPick?.(n)}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function Card({ rank, won, delay = 0 }: { rank: number | null; won?: boolean; delay?: number }) {
  return (
    <div className={`hero-pcard${rank === null ? ' back' : ' face'}${won ? ' won' : ''}`} style={{ animationDelay: `${delay}ms` }}>
      {rank !== null && rankName(rank)}
    </div>
  );
}

// ---------- What just happened ----------

function Reveal({ turn, name, target }: { turn: Turn; name: string; target: string }) {
  const d = turn.detail;
  const result = turn.kill ? (
    <p className="hero-hit kill">Instant kill!</p>
  ) : turn.damage ? (
    <p className={`hero-hit${turn.crit ? ' crit' : ''}`}>
      −{turn.damage}
      {turn.crit && <small> crit</small>}
    </p>
  ) : (
    <p className="hero-hit miss">No damage</p>
  );
  return (
    <div className="hero-play reveal">
      <p className="micro">
        {name} · {SKILL_NAME[turn.skill]} → {target}
      </p>
      {d.skill === 'stopwatch' && (
        <>
          <p className="hero-target">{secs(d.ms)}</p>
          <p className="note center-note">
            Target {d.target / 1000} s · {d.perfect ? 'Perfect!' : `${secs(Math.abs(d.ms - d.target))} off · ${d.pct}%`}
          </p>
        </>
      )}
      {d.skill === 'roulette' && (
        <>
          <Wheel pick={d.pick} balls={d.balls} />
          <p className="note center-note">{d.hit ? `A ball landed on ${d.pick}!` : `No ball on ${d.pick}: a punch instead.`}</p>
        </>
      )}
      {d.skill === 'poker' && (
        <div className="hero-cards">
          <Card rank={d.mine} won={d.won} />
          <span className="micro">vs</span>
          <Card rank={d.theirs} won={!d.won} delay={250} />
        </div>
      )}
      <div className="hero-hit-wrap" style={{ animationDelay: d.skill === 'roulette' ? `${d.balls.length * 180 + 200}ms` : '450ms' }}>
        {result}
      </div>
    </div>
  );
}

export function SkillIcon({ skill }: { skill: SkillId }) {
  if (skill === 'stopwatch')
    return (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <circle cx="12" cy="13.5" r="7.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 13.5V9.5M10 2.5h4M12 2.5V6M18.5 6.5l1.5-1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  if (skill === 'roulette')
    return (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 3v5M12 16v5M3 12h5M16 12h5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="17" cy="7" r="1.8" fill="currentColor" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <rect x="4" y="4" width="11" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" transform="rotate(-10 9.5 12)" />
      <rect x="9" y="4" width="11" height="16" rx="2" fill="currentColor" opacity="0.85" transform="rotate(8 14.5 12)" />
    </svg>
  );
}

