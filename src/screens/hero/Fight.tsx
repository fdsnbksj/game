import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MEMORY_DIGITS, MEMORY_SHOW_MS, memoryNumber, seconds, SPEED_MAX_MS, speedDelay, stopwatchTarget, VISIBLE_MS, WHEEL, type Move } from '../../games/hero/skills';
import { ready, type HeroState, type Side, type Turn } from '../../games/hero/state';
import { SKILLS, type SkillId } from '../../games/hero/stats';
import { Stickman } from './Stickman';

// One fight on screen between two friends, laid out like a handheld creature battle: the
// other side's box top left and their stick figure top right, yours bottom left with your
// box bottom right. While a turn plays, its skill's show (the stopwatch's clock, the
// reaction light, the roulette wheel, the two rows of digits) fills the middle of the
// screen, then its result, then the hit lands on the field. Under it a text box tells the turn and becomes your four
// skills. The screen only collects a move; the game (src/games/hero) decides what it does.

export const SKILL_NAME: Record<SkillId, string> = { stopwatch: 'Stopwatch', speed: 'I’m Speed', roulette: 'Roulette', memory: 'Memory' };

/** One plain line under each skill's button. */
const SKILL_HINT: Record<SkillId, string> = { stopwatch: 'Stop near the time', speed: 'Tap on green', roulette: 'Pick a number', memory: '20 digits in 5 s' };

/** How long each line of the text box stays before the next. */
const LINE_MS = 1000;
/** How long the attacker's swing takes before the hit lands. */
const SWING_MS = 350;
/** Each skill's show over the field, until its result comes up under it. */
const ANIM_MS: Record<Turn['skill'], number> = { stopwatch: 1500, speed: 1300, roulette: 2600, memory: 1800, rest: 0 };
/** How long the result shows under the finished animation before the attacker swings. */
const RESULT_MS = 1600;
/** Catching your breath has no show: the turn just takes this long. */
const REST_MS = 900;
/** The roulette wheel's spin. */
const SPIN_MS = 2400;
/** Memory's show fills a digit this often. */
const DIGIT_MS = 60;
/** A wrong digit shows red this long, then the go is sent. */
const WRONG_MS = 700;
/** A tap on the text box skips the turn only after this long, so the click that follows a
 * Stop or a Tap (those act on pointerdown) can't skip the turn it just sent. */
const SKIP_AFTER_MS = 600;

export function Fight({
  state,
  me,
  names,
  hotseat = false,
  onMove,
  waiting,
  locked = false,
  children,
}: {
  state: HeroState;
  me: Side;
  /** Fighter names, in fighter order; yours shows as "You" (unless `hotseat`). */
  names: [string, string];
  /**
   * Both players on this phone, taking turns: `me` is only whose figure stands bottom left,
   * whoever's turn it is plays, and everyone goes by name.
   */
  hotseat?: boolean;
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
  // Who plays now: you, or on a shared phone whoever's turn it is.
  const actor: Side = hotseat ? state.turn : me;
  const other: Side = actor === 0 ? 1 : 0;
  const you: Side | null = hotseat ? null : me;
  const nameOf = (side: Side) => (side === you ? 'You' : names[side]);
  const show = useShow(state, names, you);
  const mine = state.turn === actor && state.winner === null && !locked;
  const [skill, setSkill] = useState<SkillId | null>(null);
  // Once a skill has started (the stopwatch running, a card picked) there's no going back.
  const [committed, setCommitted] = useState(false);
  // A new turn: back to the menu.
  useEffect(() => {
    setSkill(null);
    setCommitted(false);
  }, [state.log.length, state.turn]);

  const playing = show.current !== null && !show.done;
  const turn = show.current?.turn;
  const hp = playing && !show.hit ? show.current!.before : state.hp;
  // The attacker swings just before the hit; the struck one is knocked back; the loser falls.
  const pose = (side: Side) => {
    if (state.winner !== null && state.winner !== side && (!playing || show.hit)) return ' down';
    if (!playing || !turn || turn.skill === 'rest') return '';
    const impact = show.current!.impact;
    if (turn.by === side && show.t >= impact - SWING_MS && show.t < impact + 300) return ' lunge punch';
    if (turn.by !== side && show.hit && (turn.damage > 0 || turn.kill)) return ' struck';
    return '';
  };
  const pop = playing && show.hit && turn && (turn.damage > 0 || turn.kill) ? (turn.kill ? 'KO!' : `−${turn.damage}`) : null;
  const fighter = (side: Side) => (
    <>
      <InfoBox mine={side === me} numbers={side === me || hotseat} name={nameOf(side)} hp={hp[side]} max={state.stats[side].hp} />
      <div className={`battle-spot ${side === me ? 'mine' : 'foe'}`}>
        <span className="battle-platform" />
        <div className={`battle-figure${pose(side)}`}>
          {pop && turn!.by !== side && (
            <span key={`pop${state.log.length}`} className={`battle-pop${turn!.crit || turn!.kill ? ' crit' : ''}`}>
              {pop}
            </span>
          )}
          <Stickman flip={side !== me} />
        </div>
      </div>
    </>
  );
  const canUse = ready(state, actor);

  return (
    <div className="battle">
      <div className="battle-field">
        {fighter(them)}
        {fighter(me)}
      </div>
      {/* The skill's show, big in the middle of the screen, then its result, until the attacker swings. */}
      {playing && turn && turn.skill !== 'rest' && show.t < show.current!.impact - SWING_MS && (
        <div className="battle-overlay" aria-hidden="true">
          <div className="show-overlay-stack">
            <SkillShow key={state.log.length} turn={turn} who={nameOf(turn.by)} other={nameOf(turn.by === 0 ? 1 : 0)} />
            {show.t >= show.current!.anim && (
              <div className={`show-result${turn.damage > 0 || turn.kill ? ' hit' : ''}`}>
                {show.current!.verdict.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="battle-box">
        {playing ? (
          <button className="battle-text" onClick={show.skip} aria-label="Skip ahead">
            {show.current!.lines.slice(0, show.line + 1).slice(-2).map((l, i, shown) => (
              <span key={show.line - shown.length + 1 + i}>{l.text}</span>
            ))}
          </button>
        ) : state.winner !== null ? (
          <p className="battle-text">{state.winner === you ? 'You win!' : `${names[state.winner]} wins!`}</p>
        ) : !mine ? (
          <p className="battle-text">{state.pending?.by === actor && !locked ? `${playedLine(state, 'You')} ${names[them]}’s go…` : waiting}</p>
        ) : state.pending ? (
          <>
            {hotseat && (
              <p className="battle-prompt">
                <strong>{names[actor]}’s turn.</strong>
              </p>
            )}
            <p className="battle-prompt">{playedLine(state, names[other])} Beat it and their hit misses.</p>
            {state.pending.move.skill === 'memory' ? (
              <MemoryPlay key={`answer${state.log.length}`} digits={memoryNumber(state.seed, state.log.length, true)} onStart={() => setCommitted(true)} onDone={(count) => onMove({ skill: 'recall', count })} />
            ) : state.pending.move.skill === 'stopwatch' ? (
              <Stopwatch key={`answer${state.log.length}`} target={stopwatchTarget(state.seed, state.log.length)} onStart={() => setCommitted(true)} onStop={(ms) => onMove({ skill: 'answer', ms })} />
            ) : (
              <SpeedPlay key={`answer${state.log.length}`} delay={speedDelay(state.seed, state.log.length, true)} onStart={() => setCommitted(true)} onTap={(ms) => onMove({ skill: 'answer', ms })} />
            )}
          </>
        ) : skill ? (
          <>
            <SkillPlay key={`${state.log.length}:${skill}`} skill={skill} state={state} onMove={onMove} onCommit={() => setCommitted(true)} />
            {!committed && (
              <button className="button ghost" onClick={() => setSkill(null)}>
                ‹ Back
              </button>
            )}
          </>
        ) : (
          <>
            <p className="battle-prompt">
              {hotseat && <strong>{names[actor]}’s turn. </strong>}
              {canUse.length === 0 ? 'Every skill is resting.' : hotseat ? '' : state.log.length ? 'Your turn' : 'You go first'}
            </p>
            {canUse.length === 0 ? (
              <button className="button primary" onClick={() => onMove({ skill: 'rest' })}>
                Catch your breath
              </button>
            ) : (
              <div className="battle-menu">
                {SKILLS.map((s) => {
                  const left = state.cooldowns[actor][s] ?? 0;
                  return (
                    <button key={s} className={`button skill-button skill-${s}`} disabled={left > 0} onClick={() => setSkill(s)}>
                      <strong>{SKILL_NAME[s]}</strong>
                      <small>{left ? `Rests ${left} more` : SKILL_HINT[s]}</small>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      {children}
    </div>
  );
}

/** What the attacker did in a contest still waiting for the defender's go: "Ann stopped 0.04 s off." */
function playedLine(state: HeroState, who: string): string {
  const move = state.pending!.move;
  if (move.skill === 'memory') return `${who} remembered ${digitsOf(move.count)}.`;
  if (move.skill === 'stopwatch') return `${who} stopped at ${secs(move.ms)}, ${secs(Math.abs(move.ms - stopwatchTarget(state.seed, state.log.length)))} off.`;
  return move.ms < 0 ? `${who} jumped the gun.` : `${who} reacted in ${secs(move.ms)}.`;
}

function InfoBox({ mine, numbers, name, hp, max }: { mine: boolean; numbers: boolean; name: string; hp: number; max: number }) {
  const pct = Math.max(0, Math.round((hp * 100) / max));
  return (
    <div className={`battle-info ${mine ? 'mine' : 'foe'}`}>
      <strong>{name}</strong>
      <div className="battle-hp" role="meter" aria-label="HP" aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp}>
        <div className={`battle-hp-fill${pct <= 20 ? ' low' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      {numbers && (
        <small>
          {hp}/{max}
        </small>
      )}
    </div>
  );
}

// ---------- A turn told line by line ----------

interface Line {
  text: string;
  /** When it shows, in ms from the start of the turn. */
  at: number;
}

interface Planned {
  turn: Turn;
  lines: Line[];
  /** When the skill's show is over and its result comes up. */
  anim: number;
  /** The result, shown under the finished show. */
  verdict: string[];
  /** When the hit lands: HP bars move, the struck side is knocked back. */
  impact: number;
  end: number;
  /** HP before the turn. */
  before: [number, number];
}

/** The lines that tell the last turn, and when each shows. */
function plan(state: HeroState, names: [string, string], me: Side | null, before: [number, number]): Planned {
  const turn = state.log.at(-1)!;
  const by = turn.by;
  const target: Side = by === 0 ? 1 : 0;
  const who = (side: Side) => (side === me ? 'You' : names[side]);
  const is = (side: Side) => (side === me ? 'You are' : `${who(side)} is`);
  const d = turn.detail;
  const opening: string[] = [];
  // What the skill came to, shown once its show is over; then the hit's own lines.
  const result: string[] = [];
  const after: string[] = [];
  const hurt = () => {
    if (turn.crit) after.push('A critical hit!');
    after.push(`${target === me ? 'You take' : `${who(target)} takes`} ${turn.damage}.`);
  };

  if (d.skill === 'stopwatch') {
    opening.push(`${who(by)} used Stopwatch!`);
    opening.push(`Stop at ${seconds(d.target)} s…`);
    const off = (ms: number) => secs(Math.abs(ms - d.target));
    if (d.theirMs !== null) result.push(`${who(by)}: ${off(d.ms)} off. ${who(target)}: ${off(d.theirMs)} off.`);
    if (!d.won) result.push(`${who(target)} ${target === me ? 'were' : 'was'} as close or closer. No damage.`);
    else {
      result.push(d.perfect ? `${secs(d.ms)}. Perfect!` : `Closer! ${d.pct}% power.`);
      hurt();
    }
  } else if (d.skill === 'roulette') {
    opening.push(`${who(by)} used Roulette on ${d.pick}!`);
    opening.push('The wheel spins…');
    if (d.hit) result.push(`The ball landed on ${d.pick}! Instant kill!`);
    else {
      result.push(`The ball landed on ${d.balls.join(', ')}. A punch instead!`);
      hurt();
    }
  } else if (d.skill === 'speed') {
    opening.push(`${who(by)} used I’m Speed!`);
    opening.push('Wait for green…');
    const time = (ms: number) => (ms < 0 ? 'too early' : secs(ms));
    if (d.theirMs !== null) result.push(`${who(by)}: ${time(d.ms)}. ${who(target)}: ${time(d.theirMs)}.`);
    if (d.ms < 0) result.push(`${who(by)} jumped the gun! No damage.`);
    else if (!d.won) result.push(`${who(target)} ${target === me ? 'were' : 'was'} as fast or faster. No damage.`);
    else {
      result.push(d.flash ? `${secs(d.ms)}. I’M SPEED!` : `Faster! ${d.pct}% power.`);
      hurt();
    }
  } else if (d.skill === 'rest') {
    opening.push(`${is(by)} catching ${by === me ? 'your' : 'their'} breath…`);
  } else {
    opening.push(`${who(by)} used Memory!`);
    opening.push(`${MEMORY_DIGITS} digits in ${MEMORY_SHOW_MS / 1000} seconds…`);
    if (d.theirCount !== null) result.push(`${who(by)}: ${d.count}. ${who(target)}: ${d.theirCount}.`);
    if (!d.won) result.push(d.count === 0 ? `${who(by)} got none. No damage.` : `${who(target)} remembered as many or more. No damage.`);
    else {
      result.push(d.perfect ? `All ${MEMORY_DIGITS}. Perfect!` : 'More digits!');
      hurt();
    }
  }
  if (state.winner !== null) after.push(`${is(state.winner === 0 ? 1 : 0)} down!`);

  // Rest has no show: its line, then the turn passes.
  const anim = ANIM_MS[turn.skill];
  const impact = d.skill === 'rest' ? REST_MS : anim + RESULT_MS + SWING_MS;
  const lines: Line[] = opening.map((text, i) => ({ text, at: i * Math.min(LINE_MS, Math.floor((anim || REST_MS) / opening.length)) }));
  result.forEach((text, i) => lines.push({ text, at: anim + i * Math.floor(RESULT_MS / result.length) }));
  after.forEach((text, i) => lines.push({ text, at: impact + i * LINE_MS }));
  return { turn, lines, anim, verdict: result, impact, end: impact + after.length * LINE_MS, before };
}

/** How long the last turn takes to tell: the result panel waits this long. */
export function turnShowMs(state: HeroState): number {
  if (!state.log.length) return 0;
  return plan(state, ['', ''], 0, state.hp).end;
}

/** Plays each new turn: the time into it, which line is up, whether the hit has landed, and a skip. */
function useShow(state: HeroState, names: [string, string], me: Side | null) {
  const seen = useRef({ length: state.log.length, hp: state.hp });
  const [current, setCurrent] = useState<Planned | null>(null);
  const [t, setT] = useState(0);
  const latest = useRef({ state, names, me });
  latest.current = { state, names, me };

  useEffect(() => {
    const before = seen.current;
    const now = latest.current.state;
    seen.current = { length: now.log.length, hp: now.hp };
    // Only a turn that arrives while watching is played; opening a fight shows it as it stands.
    if (now.log.length !== before.length + 1) {
      setCurrent(null);
      return;
    }
    setCurrent(plan(now, latest.current.names, latest.current.me, before.hp));
    setT(0);
  }, [state.log.length]);

  useEffect(() => {
    if (!current || t >= current.end) return;
    const marks = [...current.lines.map((l) => l.at), SKIP_AFTER_MS, current.anim, current.impact - SWING_MS, current.impact, current.impact + 300, current.end];
    const next = marks.filter((x) => x > t).sort((a, b) => a - b)[0];
    const timer = setTimeout(() => setT(next), next - t);
    return () => clearTimeout(timer);
  }, [current, t]);

  const line = current ? current.lines.filter((l) => l.at <= t).length - 1 : -1;
  return {
    current,
    t,
    line: Math.max(0, line),
    hit: !!current && t >= current.impact,
    done: !current || t >= current.end,
    skip: () => current && t >= SKIP_AFTER_MS && setT(current.end),
  };
}

const secs = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
const digitsOf = (n: number) => `${n} digit${n === 1 ? '' : 's'}`;

// ---------- Each skill's show over the field ----------

function SkillShow({ turn, who, other }: { turn: Turn; who: string; other: string }) {
  const d = turn.detail;
  if (d.skill === 'stopwatch') return <ClockShow target={d.target} ms={d.ms} theirs={d.theirMs} perfect={d.perfect} who={who} other={other} />;
  if (d.skill === 'speed') return <LightShow delay={700} ms={d.ms} theirs={d.theirMs} flash={d.flash} who={who} other={other} />;
  if (d.skill === 'roulette') return <RouletteSpin pick={d.pick} balls={d.balls} />;
  if (d.skill === 'memory') return <MemoryShow count={d.count} theirs={d.theirCount} who={who} other={other} />;
  return null;
}

/** A clock face, ten seconds a lap: a mark at the target, and a hand for each side sweeps round to its stop. */
function ClockShow({ target, ms, theirs, perfect, who, other }: { target: number; ms: number; theirs: number | null; perfect: boolean; who: string; other: string }) {
  const angle = (n: number) => (Math.min(n, 60_000) / 10_000) * 360;
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 1300);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="show-clock">
      <svg viewBox="-50 -50 100 100" className={done && perfect ? 'perfect' : ''} aria-hidden="true">
        <circle className="clock-face" r="46" />
        {Array.from({ length: 10 }, (_, i) => (
          <path key={i} className="clock-tick" d="M0 -46V-39" transform={`rotate(${i * 36})`} />
        ))}
        <path className="clock-target" d="M0 -46V-30" transform={`rotate(${angle(target)})`} />
        {theirs !== null && <path className="clock-hand theirs" d="M0 4V-34" style={{ '--to': `${angle(theirs)}deg` } as CSSProperties} />}
        <path className="clock-hand" d="M0 4V-40" style={{ '--to': `${angle(ms)}deg` } as CSSProperties} />
        <circle className="clock-hub" r="4" />
      </svg>
      <small className={`show-readout${done ? ' in' : ''}`}>
        {theirs === null ? `${seconds(ms)} / ${seconds(target)}` : `${who} ${seconds(ms)} · ${other} ${seconds(theirs)} / ${seconds(target)}`}
        {perfect && ' · Perfect!'}
      </small>
    </div>
  );
}

/** The reaction light: red, then green, then the time (or still red: too early). */
function LightShow({ delay, ms, theirs, flash, who, other }: { delay: number; ms: number; theirs: number | null; flash: boolean; who: string; other: string }) {
  const [phase, setPhase] = useState<'red' | 'green' | 'done'>('red');
  useEffect(() => {
    if (ms < 0) {
      const t = setTimeout(() => setPhase('done'), delay);
      return () => clearTimeout(t);
    }
    const a = setTimeout(() => setPhase('green'), delay);
    const b = setTimeout(() => setPhase('done'), delay + 400);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [delay, ms]);
  const green = ms >= 0 && phase !== 'red';
  return (
    <div className="show-light">
      <span className={`light-bulb${green ? ' green' : ' red'}${phase === 'done' && flash ? ' flash' : ''}`} />
      <small className={`show-readout${phase === 'done' ? ' in' : ''}`}>{theirs === null ? (ms < 0 ? 'Too early!' : secs(ms)) : `${who} ${ms < 0 ? 'too early' : secs(ms)} · ${other} ${theirs < 0 ? 'too early' : secs(theirs)}`}</small>
    </div>
  );
}

/** A row of digit slots for each side, filling up to how many they remembered; the first miss shows red. */
function MemoryShow({ count, theirs, who, other }: { count: number; theirs: number | null; who: string; other: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown > MEMORY_DIGITS) return;
    const t = setTimeout(() => setShown(shown + 1), DIGIT_MS);
    return () => clearTimeout(t);
  }, [shown]);
  const rows = theirs === null ? [{ name: who, n: count }] : [{ name: who, n: count }, { name: other, n: theirs }];
  return (
    <div className="show-memory">
      {rows.map((r) => (
        <div key={r.name} className="memory-row">
          <small>
            {r.name} <strong>{Math.min(shown, r.n)}</strong>
          </small>
          <div className="memory-slots">
            {Array.from({ length: MEMORY_DIGITS }, (_, i) => (
              <span key={i} className={`memory-slot${i < Math.min(shown, r.n) ? ' right' : i === r.n && shown > r.n ? ' wrong' : ''}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Playing a skill ----------

function SkillPlay({ skill, state, onMove, onCommit }: { skill: SkillId; state: HeroState; onMove: (move: Move) => void; onCommit: () => void }) {
  if (skill === 'stopwatch') return <Stopwatch target={stopwatchTarget(state.seed, state.log.length)} onStart={onCommit} onStop={(ms) => onMove({ skill, ms })} />;
  if (skill === 'speed') return <SpeedPlay delay={speedDelay(state.seed, state.log.length)} onStart={onCommit} onTap={(ms) => onMove({ skill, ms })} />;
  if (skill === 'roulette') return <RoulettePick onPick={(pick) => onMove({ skill, pick })} />;
  return <MemoryPlay digits={memoryNumber(state.seed, state.log.length)} onStart={onCommit} onDone={(count) => onMove({ skill, count })} />;
}

/**
 * Memory: Ready, then the number shows for MEMORY_SHOW_MS and hides; type it back on the
 * keypad. The first wrong digit ends the go (it shows red a moment, then the count is sent);
 * Done sends what you have.
 */
function MemoryPlay({ digits, onStart, onDone }: { digits: string; onStart: () => void; onDone: (count: number) => void }) {
  const [phase, setPhase] = useState<'ready' | 'show' | 'type' | 'done'>('ready');
  const [typed, setTyped] = useState('');
  const [wrong, setWrong] = useState<string | null>(null);
  const sent = useRef(false);
  const send = (count: number, delay = 0) => {
    if (sent.current) return;
    sent.current = true;
    setPhase('done');
    setTimeout(() => onDone(count), delay);
  };
  useEffect(() => {
    if (phase !== 'show') return;
    const t = setTimeout(() => setPhase('type'), MEMORY_SHOW_MS);
    return () => clearTimeout(t);
  }, [phase]);
  const press = (d: string) => {
    if (phase !== 'type') return;
    if (d !== digits[typed.length]) {
      setWrong(d);
      send(typed.length, WRONG_MS);
      return;
    }
    const next = typed + d;
    setTyped(next);
    if (next.length === MEMORY_DIGITS) send(next.length, WRONG_MS);
  };

  if (phase === 'ready')
    return (
      <div className="hero-play">
        <p className="note center-note">
          A {MEMORY_DIGITS}-digit number shows for {MEMORY_SHOW_MS / 1000} seconds. Then type it back: the first wrong digit ends your go. More digits than the other side hits for 90.
        </p>
        <button
          className="button primary"
          onClick={() => {
            onStart();
            setPhase('show');
          }}
        >
          Ready
        </button>
      </div>
    );
  // Groups of five, to read like a phone number.
  const groups = (text: string) => text.match(/.{1,5}/g) ?? [];
  return (
    <div className="hero-play">
      {phase === 'show' ? (
        <>
          <div className="memory-number">
            {groups(digits).map((g, i) => (
              <span key={i}>{g}</span>
            ))}
          </div>
          <span className="memory-timer" style={{ animationDuration: `${MEMORY_SHOW_MS}ms` }} />
          <p className="note center-note">Remember it…</p>
        </>
      ) : (
        <>
          <div className="memory-number typed" aria-live="polite">
            {Array.from({ length: MEMORY_DIGITS / 5 }, (_, g) => (
              <span key={g}>
                {Array.from({ length: 5 }, (_, j) => {
                  const i = g * 5 + j;
                  const ch = i < typed.length ? typed[i] : i === typed.length && wrong !== null ? wrong : '·';
                  return (
                    <b key={j} className={i === typed.length && wrong !== null ? 'wrong' : i < typed.length ? 'right' : ''}>
                      {ch}
                    </b>
                  );
                })}
              </span>
            ))}
          </div>
          <p className="note center-note">
            {wrong !== null ? `Wrong digit: ${digitsOf(typed.length)}.` : typed.length === MEMORY_DIGITS ? `All ${MEMORY_DIGITS}!` : phase === 'done' ? `Sent: ${digitsOf(typed.length)}.` : `${digitsOf(typed.length)} so far.`}
          </p>
          <div className="memory-keys">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d) => (
              <button key={d} className="button" disabled={phase !== 'type'} onClick={() => press(d)}>
                {d}
              </button>
            ))}
            <button className="button primary" disabled={phase !== 'type'} onClick={() => send(typed.length)}>
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Start, then Stop as close to the target as you can. The clock hides after a second. */
function Stopwatch({ target, onStart, onStop }: { target: number; onStart: () => void; onStop: (ms: number) => void }) {
  const visible = VISIBLE_MS;
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [shown, setShown] = useState(0);
  const frame = useRef(0);
  useEffect(() => {
    if (startedAt === null) return;
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      setShown(elapsed);
      if (elapsed < visible) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [startedAt, visible]);

  const hidden = startedAt !== null && shown >= visible;
  return (
    <div className="hero-play">
      <div className="hero-stopwatch">
        <span>
          <small className="micro">Stop at</small>
          <strong className="hero-target">{seconds(target)} s</strong>
        </span>
        <span className={`hero-clock${hidden ? ' hidden' : ''}`}>{hidden ? '?.??' : (shown / 1000).toFixed(2)}</span>
      </div>
      <p className="note center-note">
        {startedAt !== null ? 'Counting…' : 'The clock hides after a second. Count in your head.'}
      </p>
      {startedAt === null ? (
        <button
          className="button primary"
          onPointerDown={() => {
            setStartedAt(performance.now());
            onStart();
          }}
        >
          Start
        </button>
      ) : (
        <button className="button primary" onPointerDown={() => onStop(Math.round(performance.now() - startedAt))}>
          Stop
        </button>
      )}
    </div>
  );
}

/**
 * I'm Speed: Ready, then the light stays red for the turn's wait and turns green; tap the
 * moment it does. A tap on red jumps the gun (-1). Once ready there's no going back.
 */
function SpeedPlay({ delay, onStart, onTap }: { delay: number; onStart: () => void; onTap: (ms: number) => void }) {
  const [phase, setPhase] = useState<'ready' | 'red' | 'green' | 'done'>('ready');
  const greenAt = useRef(0);
  const sent = useRef(false);
  const send = (ms: number) => {
    if (sent.current) return;
    sent.current = true;
    setPhase('done');
    onTap(ms);
  };
  useEffect(() => {
    if (phase === 'red') {
      const t = setTimeout(() => {
        greenAt.current = performance.now();
        setPhase('green');
      }, delay);
      return () => clearTimeout(t);
    }
    if (phase === 'green') {
      // Too slow to count: the slowest reaction there is.
      const t = setTimeout(() => send(SPEED_MAX_MS), SPEED_MAX_MS);
      return () => clearTimeout(t);
    }
  }, [phase]);

  if (phase === 'ready')
    return (
      <div className="hero-play">
        <p className="note center-note">Tap Ready, then tap the light the moment it turns green. Faster hits harder; tap on red and you miss.</p>
        <button
          className="button primary"
          onClick={() => {
            onStart();
            setPhase('red');
          }}
        >
          Ready
        </button>
      </div>
    );
  return (
    <button
      className={`speed-light ${phase}`}
      onPointerDown={() => {
        if (phase === 'red') send(-1);
        else if (phase === 'green') send(Math.min(SPEED_MAX_MS, Math.max(0, Math.round(performance.now() - greenAt.current))));
      }}
    >
      <strong>{phase === 'red' ? 'Wait for green…' : phase === 'green' ? 'Tap!' : 'Sent'}</strong>
    </button>
  );
}

const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const colourOf = (n: number) => (n === 0 ? 'green' : redNumbers.has(n) ? 'red' : 'black');

function RoulettePick({ onPick }: { onPick: (pick: number) => void }) {
  const [pick, setPick] = useState<number | null>(null);
  return (
    <div className="hero-play">
      <div className="hero-wheel">
        {Array.from({ length: WHEEL }, (_, n) => (
          <button key={n} className={`hero-slot ${colourOf(n)}${pick === n ? ' picked' : ''}`} onClick={() => setPick(n)}>
            {n}
          </button>
        ))}
      </div>
      <button className="button primary" disabled={pick === null} onClick={() => pick !== null && onPick(pick)}>
        {pick === null ? 'Pick a number' : `Spin on ${pick}`}
      </button>
    </div>
  );
}

/** The pockets of a single-zero wheel, clockwise. */
const POCKETS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const STEP = 360 / POCKETS.length;

const polar = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
};

/** The wheel spins one way, the ball the other, and drops into its pocket. */
function RouletteSpin({ pick, balls }: { pick: number; balls: number[] }) {
  const wheel = useRef<SVGGElement>(null);
  const runs = useRef<(SVGGElement | null)[]>([]);
  const [landed, setLanded] = useState(false);
  // Where the wheel stops: fixed for the turn, so a redraw never moves it.
  const spin = 720 + ((pick * 47 + balls.length * 13) % 360);

  useEffect(() => {
    const timing = { duration: SPIN_MS, easing: 'cubic-bezier(0.12, 0.6, 0.2, 1)', fill: 'forwards' as const };
    wheel.current?.animate([{ transform: 'rotate(0deg)' }, { transform: `rotate(${spin}deg)` }], timing);
    balls.forEach((ball, i) => {
      const run = runs.current[i];
      if (!run) return;
      const stop = spin + POCKETS.indexOf(ball) * STEP;
      // Round the other way, at least two laps.
      const end = stop - 360 * (Math.ceil(stop / 360) + 2);
      run.animate([{ transform: `rotate(${i * 33}deg)` }, { transform: `rotate(${end}deg)` }], timing);
      run.querySelector('.spin-ball')?.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(0)', offset: 0.72 }, { transform: 'translateY(13px)' }], {
        duration: SPIN_MS,
        easing: 'ease-in',
        fill: 'forwards',
      });
    });
    const t = setTimeout(() => setLanded(true), SPIN_MS);
    return () => clearTimeout(t);
    // One spin per turn: the component is keyed by it.
  }, []);

  const hit = balls.includes(pick);
  return (
    <svg className={`spin-wheel${landed ? (hit ? ' hit' : ' landed') : ''}`} viewBox="-112 -112 224 224" aria-label={`Roulette on ${pick}`}>
      <circle className="spin-rim" r="111" />
      <g ref={wheel}>
        {POCKETS.map((n, i) => {
          const a0 = i * STEP - STEP / 2;
          const a1 = i * STEP + STEP / 2;
          return (
            <g key={n}>
              <path
                className={`spin-pocket ${colourOf(n)}${n === pick ? ' picked' : ''}${landed && balls.includes(n) ? ' ball' : ''}`}
                d={`M${polar(104, a0)} A104 104 0 0 1 ${polar(104, a1)} L${polar(70, a1)} A70 70 0 0 0 ${polar(70, a0)} Z`}
              />
              <text className="spin-num" transform={`rotate(${i * STEP}) translate(0 -86)`}>
                {n}
              </text>
            </g>
          );
        })}
        <circle className="spin-cone" r="70" />
      </g>
      {balls.map((_, i) => (
        <g
          key={i}
          ref={(el) => {
            runs.current[i] = el;
          }}
        >
          <circle className="spin-ball" cy="-99" r="6" />
        </g>
      ))}
    </svg>
  );
}
