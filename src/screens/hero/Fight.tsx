import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Sheet } from '../../components/Sheet';
import { botMove } from '../../games/hero/bots';
import { ATTACK_NAMES, ATTACKS, hasEffect, type EffectId } from '../../games/hero/monsters';
import { RANKS, rankName, rouletteBalls, seconds, SPEED_MAX_MS, speedDelay, stopwatchTarget, VISIBLE_MS, WHEEL, type Move } from '../../games/hero/skills';
import { enraged, ready, usable, type HeroState, type Side, type Turn } from '../../games/hero/state';
import type { SkillId } from '../../games/hero/stats';
import { Stickman } from './Stickman';

// One fight on screen, a bot's or a friend's: two stick figures side by side, you on the
// left, each under its name, level and HP; then a text box that tells each turn line by
// line and becomes your skills. The screen only collects a move; the game
// (src/games/hero) decides what it does.

export const SKILL_NAME: Record<SkillId, string> = { stopwatch: 'Stopwatch', speed: 'I’m Speed', roulette: 'Roulette', poker: 'Poker' };

const EFFECT_NAME: Record<EffectId, string> = { burn: 'Burn', weak: 'Weak', fog: 'Smoke', guard: 'Guard', charged: 'Charged' };

/** How long each line of the text box stays before the next. */
const LINE_MS = 1000;

export function Fight({
  state,
  me,
  names,
  levels,
  boss = false,
  onMove,
  waiting,
  locked = false,
  children,
}: {
  state: HeroState;
  me: Side;
  /** Fighter names, in fighter order; yours shows as "You". */
  names: [string, string];
  /** Fighter levels, in fighter order. */
  levels: [number, number];
  /** The other side is a boss: drawn bigger. */
  boss?: boolean;
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
  }, [state.log.length]);

  const playing = show.current !== null && !show.done;
  const turn = show.current?.turn;
  const hp = playing && !show.hit ? show.current!.before : state.hp;
  const fx = (side: Side) => {
    const now = state.effects[side].map((e) => EFFECT_NAME[e.id]);
    return enraged(state, side) ? [...now, 'Enraged'] : now;
  };
  // Who's moving now, who's struck, who's down.
  const pose = (side: Side) => {
    if (state.winner !== null && state.winner !== side && (!playing || show.hit)) return ' down';
    if (!playing || !turn) return '';
    if (turn.by === side && !show.hit) return ' lunge';
    if (turn.by !== side && show.hit && (turn.damage > 0 || turn.kill)) return ' struck';
    return '';
  };
  const pop = playing && show.hit && turn && (turn.damage > 0 || turn.kill) ? (turn.kill ? 'KO' : `−${turn.damage}`) : null;
  const fighter = (side: Side) => (
    <div className={`battle-side ${side === me ? 'mine' : 'foe'}`}>
      <InfoBox name={side === me ? 'You' : names[side]} level={levels[side]} hp={hp[side]} max={state.stats[side].hp} effects={fx(side)} />
      <div className={`battle-figure${pose(side)}${side !== me && boss ? ' boss' : ''}`}>
        {pop && turn!.by !== side && (
          <span key={`pop${state.log.length}`} className={`battle-pop${turn!.crit || turn!.kill ? ' crit' : ''}`}>
            {pop}
          </span>
        )}
        <Stickman flip={side !== me} />
      </div>
    </div>
  );
  // Your loadout, in its order, each with the turns it still sits out.
  const loadout = usable(state.fighters[me]);
  const canUse = ready(state, me);

  return (
    <div className="battle">
      <div className="battle-field">
        {fighter(me)}
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
          <p className="battle-text">{state.pending?.by === me && !locked ? `${names[them]} is picking a card…` : waiting}</p>
        ) : state.pending ? (
          <PokerPick
            key={`answer${state.log.length}`}
            taken={state.pending.pick}
            takenBy={names[them]}
            onPick={(pick) => onMove({ skill: 'card', pick })}
            onCommit={() => setCommitted(true)}
          />
        ) : skill ? (
          <>
            <SkillPlay key={`${state.log.length}:${skill}`} skill={skill} state={state} me={me} onMove={onMove} onCommit={() => setCommitted(true)} />
            <button className="button ghost" disabled={committed} onClick={() => setSkill(null)}>
              ‹ Another skill
            </button>
          </>
        ) : (
          <>
            <p className="battle-prompt">
              {canUse.length === 0 ? 'Every skill is resting.' : state.log.length ? 'Your turn.' : 'You go first.'}
            </p>
            {canUse.length === 0 ? (
              <button className="button primary" onClick={() => onMove({ skill: 'rest' })}>
                Catch your breath
              </button>
            ) : (
              <div className="battle-menu">
                {loadout.map((s) => {
                  const left = state.cooldowns[me][s] ?? 0;
                  return (
                    <button key={s} className="button" disabled={left > 0} onClick={() => setSkill(s)}>
                      {SKILL_NAME[s]} <small>{left ? `rests ${left}` : `Lv ${state.fighters[me].tree[s]}`}</small>
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
                <span>{describe(state, t, t.by === me ? 'You' : names[t.by])}</span>
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

function InfoBox({ name, level, hp, max, effects }: { name: string; level: number; hp: number; max: number; effects: string[] }) {
  const pct = Math.max(0, Math.round((hp * 100) / max));
  return (
    <div className="battle-info">
      <strong>{name}</strong> <small>Lv {level}</small>
      <div className="battle-hp" role="meter" aria-label="HP" aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp}>
        <div className={`battle-hp-fill${pct <= 20 ? ' low' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <small>
        {hp}/{max}
        {effects.length > 0 && ` · ${effects.join(', ')}`}
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
  /** When the hit lands: HP bars move, the struck side shakes. */
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
  // "Foe Pocket Watch", but "The Dealer" as it is.
  const who = (side: Side) => (side === me ? 'You' : names[side].startsWith('The ') ? names[side] : `Foe ${names[side]}`);
  const is = (side: Side) => (side === me ? 'You are' : `${who(side)} is`);
  const whose = (side: Side) => (side === me ? 'Your' : `${who(side)}’s`);
  const d = turn.detail;
  const opening: string[] = [];
  const result: string[] = [];
  const hurt = () => {
    if (turn.crit) result.push('A critical hit!');
    result.push(`${target === me ? 'You take' : `${who(target)} takes`} ${turn.damage}.`);
  };
  let delay = 700;

  if (d.skill === 'attack') {
    const kit = state.fighters[by].kit;
    opening.push(`${who(by)} used ${kit ? ATTACK_NAMES[kit.family][d.id] : d.id}!`);
    const attack = ATTACKS[d.id];
    delay = d.missed ? 650 : d.id === 'finisher' ? 1100 : 800;
    if (d.missed) result.push(attack.power > 0 ? 'But it missed!' : 'But it didn’t work!');
    else if (attack.power > 0) hurt();
    if (d.healed > 0) result.push(`${who(by)} drained ${d.healed} HP.`);
    if (d.effect === 'burn') result.push(`${is(target)} burned!`);
    if (d.effect === 'weak') result.push(`${whose(target)} hits are weakened!`);
    if (d.effect === 'fog') result.push(target === me ? 'Smoke! Your next stopwatch hides its clock at once.' : `${who(target)} is lost in smoke!`);
    if (d.effect === 'guard') result.push(`${whose(by)} guard is up!`);
    if (d.effect === 'charged') result.push(`${is(by)} winding up a big hit!`);
  } else if (d.skill === 'stopwatch') {
    opening.push(`${who(by)} used Stopwatch!`);
    opening.push(`Stop at ${seconds(d.target)} s…`);
    delay = 1500;
    result.push(d.perfect ? `${secs(d.ms)}. Perfect!` : `${secs(d.ms)}: ${secs(Math.abs(d.ms - d.target))} off, ${d.pct}% power.`);
    hurt();
  } else if (d.skill === 'roulette') {
    opening.push(`${who(by)} used Roulette on ${d.pick}!`);
    opening.push(`The ${d.balls.length === 1 ? 'ball lands' : 'balls land'} on ${d.balls.join(', ')}…`);
    delay = 1600;
    if (d.hit) result.push(`A ball landed on ${d.pick}! Instant kill!`);
    else {
      result.push(`No ball on ${d.pick}. A punch instead!`);
      hurt();
    }
  } else if (d.skill === 'speed') {
    opening.push(`${who(by)} used I’m Speed!`);
    opening.push('Wait for green…');
    delay = 1400;
    if (d.ms < 0) result.push(`${by === me ? 'You' : who(by)} jumped the gun! No damage.`);
    else {
      result.push(d.flash ? `${secs(d.ms)}. I’M SPEED!` : `Reacted in ${secs(d.ms)}, ${d.pct}% power.`);
      hurt();
    }
  } else if (d.skill === 'rest') {
    opening.push(`${is(by)} catching ${by === me ? 'your' : 'their'} breath…`);
    delay = 900;
  } else {
    opening.push(`${who(by)} used Poker!`);
    opening.push(`${target === me ? 'You take' : `${who(target)} takes`} a card…`);
    delay = 1400;
    result.push(`${rankName(d.mine)} against ${rankName(d.theirs)}.`);
    if (d.won) hurt();
    else result.push('Lower card. No damage.');
  }

  // A boss that just dropped below half.
  if (!turn.kill && enraged(state, target) && before[target] * 2 >= state.stats[target].hp) result.push(`${is(target)} enraged!`);
  if (turn.burn > 0) result.push(`${is(by)} hurt by the burn (−${turn.burn}).`);
  if (state.winner !== null) result.push(`${is(state.winner === 0 ? 1 : 0)} down!`);

  const lines: Line[] = opening.map((text, i) => ({ text, at: i * Math.min(LINE_MS, Math.floor(delay / opening.length)) }));
  result.forEach((text, i) => lines.push({ text, at: delay + i * LINE_MS }));
  return { turn, lines, impact: delay, end: delay + result.length * LINE_MS, before };
}

/** How long the last turn takes to tell: the bot waits this long before its move. */
export function turnShowMs(state: HeroState): number {
  if (!state.log.length) return 0;
  return plan(state, ['', ''], 0, state.hp).end;
}

/** Plays each new turn: which line is up, whether the hit has landed, and a skip. */
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
    const next = [...current.lines.map((l) => l.at), current.impact, current.end].filter((x) => x > t).sort((a, b) => a - b)[0];
    const timer = setTimeout(() => setT(next), next - t);
    return () => clearTimeout(timer);
  }, [current, t]);

  const line = current ? current.lines.filter((l) => l.at <= t).length - 1 : -1;
  return {
    current,
    line: Math.max(0, line),
    hit: !!current && t >= current.impact,
    done: !current || t >= current.end,
    skip: () => current && setT(current.end),
  };
}

/** One line for the log. */
function describe(state: HeroState, t: Turn, who: string): string {
  const d = t.detail;
  const hit = t.kill ? 'instant kill!' : t.damage ? `${t.damage} damage${t.crit ? ' (crit)' : ''}` : 'no damage';
  const burn = t.burn ? `, burned for ${t.burn}` : '';
  if (d.skill === 'stopwatch') return `${who}: Stopwatch ${secs(d.ms)} for ${secs(d.target)}, ${hit}${burn}`;
  if (d.skill === 'speed') return d.ms < 0 ? `${who}: I’m Speed, too early, no damage${burn}` : `${who}: I’m Speed in ${secs(d.ms)}, ${hit}${burn}`;
  if (d.skill === 'rest') return `${who}: caught their breath${burn}`;
  if (d.skill === 'roulette') return `${who}: Roulette on ${d.pick}, ${d.hit ? 'hit' : 'missed'}, ${hit}${burn}`;
  if (d.skill === 'poker') return `${who}: Poker ${rankName(d.mine)} vs ${rankName(d.theirs)}, ${hit}${burn}`;
  const kit = state.fighters[t.by].kit;
  const name = kit ? ATTACK_NAMES[kit.family][d.id] : d.id;
  const what = d.missed ? 'missed' : ATTACKS[d.id].power > 0 ? hit : d.effect ? EFFECT_NAME[d.effect].toLowerCase() : 'nothing';
  return `${who}: ${name}, ${what}${d.healed ? `, healed ${d.healed}` : ''}`;
}

const secs = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

/** Side 1 is played by the bot brain. */
export function useBotTurn(state: HeroState, spread: number, play: (move: Move) => void) {
  const latest = useRef(play);
  latest.current = play;
  useEffect(() => {
    if (state.winner !== null || state.turn !== 1) return;
    // Let the last turn play out, then move.
    // Answering a Poker is quick; anything else waits for the last turn to play out.
    const wait = state.pending ? 1400 : state.log.length ? turnShowMs(state) + 500 : 900;
    const timer = setTimeout(() => latest.current(botMove(state, 1, { spread })), wait);
    return () => clearTimeout(timer);
  }, [state, spread]);
}

// ---------- Playing a skill ----------

function SkillPlay({ skill, state, me, onMove, onCommit }: { skill: SkillId; state: HeroState; me: Side; onMove: (move: Move) => void; onCommit: () => void }) {
  if (skill === 'stopwatch')
    return (
      <Stopwatch
        target={stopwatchTarget(state.seed, state.log.length)}
        fog={hasEffect(state.effects[me], 'fog')}
        onStart={onCommit}
        onStop={(ms) => onMove({ skill, ms })}
      />
    );
  if (skill === 'speed') return <SpeedPlay delay={speedDelay(state.seed, state.log.length)} onStart={onCommit} onTap={(ms) => onMove({ skill, ms })} />;
  if (skill === 'roulette') return <RoulettePick balls={rouletteBalls(state.fighters[me].tree.roulette)} onPick={(pick) => onMove({ skill, pick })} />;
  return <PokerPick onPick={(pick) => onMove({ skill, pick })} onCommit={onCommit} />;
}

// ---------- Poker: thirteen face-down cards, pick one ----------

/**
 * Thirteen cards, 2 to A, face down in a seeded order; pick one. Answering the other side's
 * Poker, their card (`taken`, with its owner's name) is already out.
 */
function PokerPick({ onPick, onCommit, taken, takenBy }: { onPick: (pick: number) => void; onCommit: () => void; taken?: number; takenBy?: string }) {
  return (
    <div className="hero-play">
      <p className="note center-note">
        {taken !== undefined ? `${takenBy} took a card. Pick yours: beat it and their hit misses.` : 'Pick a card, 2 low to A high. They pick another; the higher card wins a big crit.'}
      </p>
      <div className="pk-table">
        {Array.from({ length: RANKS }, (_, i) => (
          <button
            key={i}
            className="pk-card"
            disabled={i === taken}
            onClick={() => {
              onCommit();
              onPick(i);
            }}
            aria-label={i === taken ? `Card ${i + 1}, taken` : `Card ${i + 1}`}
          >
            {i === taken ? '✕' : '?'}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Start, then Stop as close to the target as you can. The clock hides after a second (at once in smoke). */
function Stopwatch({ target, fog, onStart, onStop }: { target: number; fog: boolean; onStart: () => void; onStop: (ms: number) => void }) {
  const visible = fog ? 0 : VISIBLE_MS;
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
        {startedAt !== null ? 'Counting…' : fog ? 'Smoke: the clock hides at once. Count in your head.' : 'The clock hides after a second. Count in your head.'}
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

function RoulettePick({ balls, onPick }: { balls: number; onPick: (pick: number) => void }) {
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
        {pick === null ? `Pick a number · ${balls} ${balls === 1 ? 'ball' : 'balls'}` : `Spin on ${pick}`}
      </button>
    </div>
  );
}
