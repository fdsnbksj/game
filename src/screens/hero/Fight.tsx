import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Sheet } from '../../components/Sheet';
import { pokerDeck, RANKS, rankName, seconds, SPEED_MAX_MS, speedDelay, stopwatchTarget, VISIBLE_MS, WHEEL, type Move } from '../../games/hero/skills';
import { ready, type HeroState, type Side, type Turn } from '../../games/hero/state';
import { cooldownOf, SKILLS, type SkillId } from '../../games/hero/stats';
import { Stickman } from './Stickman';

// One fight on screen between two friends: two stick figures, you on the left, each under
// its name and HP, and between them each skill's show (the stopwatch's clock, the reaction
// light, the roulette wheel, the two cards turning over). Then a text box that tells each
// turn line by line and becomes your skills. The screen only collects a move; the game
// (src/games/hero) decides what it does.

export const SKILL_NAME: Record<SkillId, string> = { stopwatch: 'Stopwatch', speed: 'I’m Speed', roulette: 'Roulette', poker: 'Poker' };

/** How long each line of the text box stays before the next. */
const LINE_MS = 1000;
/** How long the attacker's swing takes before the hit lands. */
const SWING_MS = 350;
/** Each skill's show over the field, until the hit lands. */
const SHOW_MS: Record<Turn['skill'], number> = { stopwatch: 1900, speed: 1500, roulette: 2900, poker: 1600, rest: 900 };
/** The roulette wheel's spin. */
const SPIN_MS = 2400;
/** A picked card turns over, then the move goes. */
const FLIP_MS = 700;

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
  const show = useShow(state, names, me);
  const mine = state.turn === me && state.winner === null && !locked;
  const [skill, setSkill] = useState<SkillId | null>(null);
  // Once a skill has started (the stopwatch running, a card picked) there's no going back.
  const [committed, setCommitted] = useState(false);
  const [log, setLog] = useState(false);
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
      <InfoBox area={side === me ? 'info-mine' : 'info-foe'} name={side === me ? 'You' : names[side]} hp={hp[side]} max={state.stats[side].hp} />
      <div className={`battle-figure ${side === me ? 'mine' : 'foe'}${pose(side)}`}>
        {pop && turn!.by !== side && (
          <span key={`pop${state.log.length}`} className={`battle-pop${turn!.crit || turn!.kill ? ' crit' : ''}`}>
            {pop}
          </span>
        )}
        <Stickman flip={side !== me} />
      </div>
    </>
  );
  const canUse = ready(state, me);

  return (
    <div className="battle">
      <div className="battle-field">
        {fighter(me)}
        <div className="battle-show">{playing && turn && <SkillShow key={state.log.length} turn={turn} who={turn.by === me ? 'You' : names[turn.by]} other={turn.by === me ? names[them] : 'You'} />}</div>
        {fighter(them)}
      </div>

      <div className="battle-box">
        {playing ? (
          <button className="battle-text" onClick={show.skip} aria-label="Skip ahead">
            {show.current!.lines.slice(0, show.line + 1).slice(-2).map((l, i, shown) => (
              <span key={show.line - shown.length + 1 + i}>{l.text}</span>
            ))}
          </button>
        ) : state.winner !== null ? (
          <p className="battle-text">{state.winner === me ? 'You win!' : `${names[them]} wins.`}</p>
        ) : !mine ? (
          <p className="battle-text">
            {state.pending?.by === me && !locked
              ? `You drew ${rankName(pokerDeck(state.seed, state.log.length)[state.pending.pick])}. ${names[them]} is picking a card…`
              : waiting}
          </p>
        ) : state.pending ? (
          <PokerPick
            key={`answer${state.log.length}`}
            deck={pokerDeck(state.seed, state.log.length)}
            taken={state.pending.pick}
            takenBy={names[them]}
            onPick={(pick) => onMove({ skill: 'card', pick })}
            onCommit={() => setCommitted(true)}
          />
        ) : skill ? (
          <>
            <SkillPlay key={`${state.log.length}:${skill}`} skill={skill} state={state} onMove={onMove} onCommit={() => setCommitted(true)} />
            <button className="button ghost" disabled={committed} onClick={() => setSkill(null)}>
              ‹ Another skill
            </button>
          </>
        ) : (
          <>
            <p className="battle-prompt">{canUse.length === 0 ? 'Every skill is resting.' : state.log.length ? 'Your turn.' : 'You go first.'}</p>
            {canUse.length === 0 ? (
              <button className="button primary" onClick={() => onMove({ skill: 'rest' })}>
                Catch your breath
              </button>
            ) : (
              <div className="battle-menu">
                {SKILLS.map((s) => {
                  const left = state.cooldowns[me][s] ?? 0;
                  const rest = cooldownOf(s);
                  return (
                    <button key={s} className="button" disabled={left > 0} onClick={() => setSkill(s)}>
                      {SKILL_NAME[s]} <small>{left ? `rests ${left} more` : rest ? `then rests ${rest}` : 'never rests'}</small>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
        <button className="button ghost battle-log" disabled={!state.log.length} onClick={() => setLog(true)}>
          Fight log ({state.log.length})
        </button>
      </div>
      {log && (
        <Sheet title="Fight log" onClose={() => setLog(false)}>
          <ol className="group hero-log">
            {[...state.log].reverse().map((t, i) => (
              <li key={i} className="row">
                <span>{describe(t, t.by === me ? 'You' : names[t.by])}</span>
              </li>
            ))}
          </ol>
          <button className="button" onClick={() => setLog(false)}>
            Close
          </button>
        </Sheet>
      )}
      {children}
    </div>
  );
}

function InfoBox({ area, name, hp, max }: { area: string; name: string; hp: number; max: number }) {
  const pct = Math.max(0, Math.round((hp * 100) / max));
  return (
    <div className="battle-info" style={{ gridArea: area }}>
      <strong>{name}</strong>
      <div className="battle-hp" role="meter" aria-label="HP" aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp}>
        <div className={`battle-hp-fill${pct <= 20 ? ' low' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <small>
        {hp}/{max}
      </small>
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
  /** When the hit lands: HP bars move, the struck side is knocked back. */
  impact: number;
  end: number;
  /** HP before the turn. */
  before: [number, number];
}

/** The lines that tell the last turn, and when each shows. */
function plan(state: HeroState, names: [string, string], me: Side, before: [number, number]): Planned {
  const turn = state.log.at(-1)!;
  const by = turn.by;
  const target: Side = by === 0 ? 1 : 0;
  const who = (side: Side) => (side === me ? 'You' : names[side]);
  const is = (side: Side) => (side === me ? 'You are' : `${who(side)} is`);
  const d = turn.detail;
  const opening: string[] = [];
  const result: string[] = [];
  const hurt = () => {
    if (turn.crit) result.push('A critical hit!');
    result.push(`${target === me ? 'You take' : `${who(target)} takes`} ${turn.damage}.`);
  };
  const delay = SHOW_MS[turn.skill];

  if (d.skill === 'stopwatch') {
    opening.push(`${who(by)} used Stopwatch!`);
    opening.push(`Stop at ${seconds(d.target)} s…`);
    result.push(d.perfect ? `${secs(d.ms)}. Perfect!` : `${secs(d.ms)}: ${secs(Math.abs(d.ms - d.target))} off, ${d.pct}% power.`);
    hurt();
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
    if (d.ms < 0) result.push(`${who(by)} jumped the gun! No damage.`);
    else {
      result.push(d.flash ? `${secs(d.ms)}. I’M SPEED!` : `Reacted in ${secs(d.ms)}, ${d.pct}% power.`);
      hurt();
    }
  } else if (d.skill === 'rest') {
    opening.push(`${is(by)} catching ${by === me ? 'your' : 'their'} breath…`);
  } else {
    opening.push(`${who(by)} used Poker!`);
    opening.push('The cards turn over…');
    result.push(`${rankName(d.mine)} against ${rankName(d.theirs)}.`);
    if (d.won) hurt();
    else result.push('Lower card. No damage.');
  }
  if (state.winner !== null) result.push(`${is(state.winner === 0 ? 1 : 0)} down!`);

  const lines: Line[] = opening.map((text, i) => ({ text, at: i * Math.min(LINE_MS, Math.floor(delay / opening.length)) }));
  result.forEach((text, i) => lines.push({ text, at: delay + i * LINE_MS }));
  return { turn, lines, impact: delay, end: delay + result.length * LINE_MS, before };
}

/** How long the last turn takes to tell: the result panel waits this long. */
export function turnShowMs(state: HeroState): number {
  if (!state.log.length) return 0;
  return plan(state, ['', ''], 0, state.hp).end;
}

/** Plays each new turn: the time into it, which line is up, whether the hit has landed, and a skip. */
function useShow(state: HeroState, names: [string, string], me: Side) {
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
    const marks = [...current.lines.map((l) => l.at), current.impact - SWING_MS, current.impact, current.impact + 300, current.end];
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
    skip: () => current && setT(current.end),
  };
}

/** One line for the log. */
function describe(t: Turn, who: string): string {
  const d = t.detail;
  const hit = t.kill ? 'instant kill!' : t.damage ? `${t.damage} damage${t.crit ? ' (crit)' : ''}` : 'no damage';
  if (d.skill === 'stopwatch') return `${who}: Stopwatch ${secs(d.ms)} for ${secs(d.target)}, ${hit}`;
  if (d.skill === 'speed') return d.ms < 0 ? `${who}: I’m Speed, too early, no damage` : `${who}: I’m Speed in ${secs(d.ms)}, ${hit}`;
  if (d.skill === 'rest') return `${who}: caught their breath`;
  if (d.skill === 'roulette') return `${who}: Roulette on ${d.pick}, ball on ${d.balls.join(', ')}, ${hit}`;
  return `${who}: Poker ${rankName(d.mine)} vs ${rankName(d.theirs)}, ${hit}`;
}

const secs = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

// ---------- Each skill's show over the field ----------

function SkillShow({ turn, who, other }: { turn: Turn; who: string; other: string }) {
  const d = turn.detail;
  if (d.skill === 'stopwatch') return <ClockShow target={d.target} ms={d.ms} perfect={d.perfect} />;
  if (d.skill === 'speed') return <LightShow delay={Math.min(700, Math.floor(SHOW_MS.speed / 2))} ms={d.ms} flash={d.flash} />;
  if (d.skill === 'roulette') return <RouletteSpin pick={d.pick} balls={d.balls} />;
  if (d.skill === 'poker') return <CardsShow mine={d.mine} theirs={d.theirs} won={d.won} who={who} other={other} />;
  return null;
}

/** A clock face, ten seconds a lap: a mark at the target, and the hand sweeps round to the stop. */
function ClockShow({ target, ms, perfect }: { target: number; ms: number; perfect: boolean }) {
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
        <path className="clock-hand" d="M0 4V-40" style={{ '--to': `${angle(ms)}deg` } as CSSProperties} />
        <circle className="clock-hub" r="4" />
      </svg>
      <small className={`show-readout${done ? ' in' : ''}`}>
        {seconds(ms)} / {seconds(target)}
        {perfect && ' · Perfect!'}
      </small>
    </div>
  );
}

/** The reaction light: red, then green, then the time (or still red: too early). */
function LightShow({ delay, ms, flash }: { delay: number; ms: number; flash: boolean }) {
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
      <small className={`show-readout${phase === 'done' ? ' in' : ''}`}>{ms < 0 ? 'Too early!' : secs(ms)}</small>
    </div>
  );
}

/** The two picked cards turn over side by side, the higher one lifted. */
function CardsShow({ mine, theirs, won, who, other }: { mine: number; theirs: number; won: boolean; who: string; other: string }) {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setUp(true), 500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="show-cards">
      {[
        { rank: mine, name: who, high: won },
        { rank: theirs, name: other, high: !won },
      ].map((c, i) => (
        <span key={i} className="show-card-wrap">
          <span className={`pk-card big${up ? ' up' : ''}${up && c.high ? ' high' : ''}`} style={{ transitionDelay: `${i * 200}ms` }}>
            <span className="pk-back" />
            <span className="pk-face">{rankName(c.rank)}</span>
          </span>
          <small>{c.name}</small>
        </span>
      ))}
    </div>
  );
}

// ---------- Playing a skill ----------

function SkillPlay({ skill, state, onMove, onCommit }: { skill: SkillId; state: HeroState; onMove: (move: Move) => void; onCommit: () => void }) {
  if (skill === 'stopwatch') return <Stopwatch target={stopwatchTarget(state.seed, state.log.length)} onStart={onCommit} onStop={(ms) => onMove({ skill, ms })} />;
  if (skill === 'speed') return <SpeedPlay delay={speedDelay(state.seed, state.log.length)} onStart={onCommit} onTap={(ms) => onMove({ skill, ms })} />;
  if (skill === 'roulette') return <RoulettePick onPick={(pick) => onMove({ skill, pick })} />;
  return <PokerPick deck={pokerDeck(state.seed, state.log.length)} onPick={(pick) => onMove({ skill, pick })} onCommit={onCommit} />;
}

/**
 * Thirteen cards, 2 to A, face down; the one you tap turns over at once, then the move goes.
 * Answering the other side's Poker, their card (`taken`) already lies face up.
 */
function PokerPick({ deck, onPick, onCommit, taken, takenBy }: { deck: number[]; onPick: (pick: number) => void; onCommit: () => void; taken?: number; takenBy?: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => {
    if (picked === null) return;
    const t = setTimeout(() => onPick(picked), FLIP_MS);
    return () => clearTimeout(t);
    // Sent once, after the card has turned.
  }, [picked]);
  return (
    <div className="hero-play">
      <p className="note center-note">
        {picked !== null
          ? `You drew ${rankName(deck[picked])}!`
          : taken !== undefined
            ? `${takenBy} drew ${rankName(deck[taken])}. Pick yours: beat it and their hit misses.`
            : 'Pick a card, 2 low to A high. They pick another; the higher card wins a big crit.'}
      </p>
      <div className="pk-table">
        {Array.from({ length: RANKS }, (_, i) => (
          <button
            key={i}
            className={`pk-card${i === picked || i === taken ? ' up' : ''}${i === taken ? ' theirs' : ''}`}
            disabled={i === taken || picked !== null}
            onClick={() => {
              onCommit();
              setPicked(i);
            }}
            aria-label={i === taken ? `${takenBy}'s card, ${rankName(deck[i])}` : `Card ${i + 1}`}
          >
            <span className="pk-back" />
            <span className="pk-face">{rankName(deck[i])}</span>
          </button>
        ))}
      </div>
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
