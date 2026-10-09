import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Sheet } from '../../components/Sheet';
import { botMove } from '../../games/hero/bots';
import { ATTACK_NAMES, ATTACKS, hasEffect, type EffectId } from '../../games/hero/monsters';
import { RANKS, rankName, seconds, stopwatchTarget, VISIBLE_MS, WHEEL, type Move } from '../../games/hero/skills';
import { enraged, type HeroState, type Side, type Turn } from '../../games/hero/state';
import { SKILLS, type SkillId } from '../../games/hero/stats';
import { AttackFx, attackImpactMs, quakes } from './AttackFx';
import type { Appearance } from '../../games/hero/look';
import { Sprite, type SpriteSpec } from './Sprites';

// One fight on screen, a bot's, an arena hero's or a friend's, laid out like a handheld
// creature battle: the foe's box and the foe up top, your hero (from behind) and your box
// below, and a text box under the thumb that tells each turn line by line, then becomes
// your menu. The screen only collects a move; the game (src/games/hero) decides what it does.

const SKILL_NAME: Record<SkillId, string> = { stopwatch: 'Stopwatch', roulette: 'Roulette', poker: 'Poker' };

const EFFECT_NAME: Record<EffectId, string> = { burn: 'Burn', weak: 'Weak', fog: 'Smoke', guard: 'Guard', charged: 'Charged' };

/** How long each line of the text box stays before the next. */
const LINE_MS = 1000;
/** The roulette wheel's spin, and the gap between one ball and the next. */
const SPIN_MS = 2400;
const BALL_GAP = 140;

export function Fight({
  state,
  me,
  names,
  levels,
  foe,
  look,
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
  /** How the other side is drawn. */
  foe: SpriteSpec;
  /** How you look. */
  look: Appearance;
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
  // Once the stopwatch is running there's no going back for another try at the same target.
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
  // A creature's attack is drawn over the field, and a boss's heaviest shake it.
  const attack = playing && turn?.detail.skill === 'attack' && !turn.detail.missed ? turn.detail : null;
  const attacker = turn ? state.fighters[turn.by].kit : undefined;
  const spot = (side: Side) => `${pose(side)}${enraged(state, side) ? ' enraged' : ''}`;

  return (
    <div className="battle">
      <div className={`battle-field${attack && show.hit && quakes(attack.id, !!attacker?.enrage) ? ' quake' : ''}`}>
        <InfoBox name={names[them]} level={levels[them]} hp={hp[them]} max={state.stats[them].hp} effects={fx(them)} foe />
        <div className={`battle-spot foe${spot(them)}`}>
          <span className="battle-platform" />
          <Sprite spec={foe} />
        </div>
        <div className={`battle-spot mine${spot(me)}`}>
          <span className="battle-platform" />
          <Sprite spec={{ kind: 'hero', appearance: look }} back />
        </div>
        <InfoBox name="You" level={levels[me]} hp={hp[me]} max={state.stats[me].hp} effects={fx(me)} numbers />
        {attack && attacker && <AttackFx key={`fx${state.log.length}`} id={attack.id} family={attacker.family} boss={attacker.enrage} />}
        {playing && show.hit && turn && (turn.damage > 0 || turn.kill) && (
          <span key={`pop${state.log.length}`} className={`battle-pop ${turn.by === me ? 'at-foe' : 'at-mine'}${turn.crit || turn.kill ? ' crit' : ''}`}>
            {turn.kill ? 'KO!' : `−${turn.damage}`}
          </span>
        )}
        {playing && show.hit && turn && stampOf(turn) && (
          <span key={`meme${state.log.length}`} className="battle-meme">
            {stampOf(turn)}
          </span>
        )}
        {playing && turn?.detail.skill === 'roulette' && <RouletteSpin key={`spin${state.log.length}`} pick={turn.detail.pick} balls={turn.detail.balls} />}
        {playing && turn?.detail.skill === 'poker' && (
          <PokerReveal
            key={`poker${state.log.length}`}
            detail={turn.detail}
            mine={turn.by === me ? 'You' : names[turn.by]}
            chose={turn.by !== me}
            theirs={turn.by === me ? names[them] : 'You'}
          />
        )}
        {playing && turn?.detail.skill === 'stopwatch' && show.line >= 1 && (
          <div className="battle-show light">
            <p className="battle-stop">
              {secs(turn.detail.ms)}
              <small>target {seconds(turn.detail.target)} s</small>
            </p>
          </div>
        )}
      </div>

      <div className="battle-box">
        {playing ? (
          <button className="battle-text" onClick={show.skip} aria-label="Skip ahead">
            {show.current!.lines.slice(0, show.line + 1).slice(-2).map((l, i, shown) => (
              <span key={show.line - shown.length + 1 + i} className={i === shown.length - 1 ? 'new' : ''}>
                {l.text}
              </span>
            ))}
          </button>
        ) : state.winner !== null ? (
          <p className="battle-text static">{state.winner === me ? 'You win!' : `${names[them]} wins.`}</p>
        ) : !mine ? (
          <p className="battle-text static">{state.pending?.by === me && !locked ? `${names[them]} is picking a card…` : waiting}</p>
        ) : state.pending ? (
          <div className="battle-play">
            <PokerPick
              key={`answer${state.log.length}`}
              taken={state.pending.pick}
              takenBy={names[them]}
              onPick={(pick) => onMove({ skill: 'card', pick })}
              onCommit={() => setCommitted(true)}
            />
          </div>
        ) : skill ? (
          <div className="battle-play">
            <SkillPlay key={`${state.log.length}:${skill}`} skill={skill} state={state} me={me} onMove={onMove} onCommit={() => setCommitted(true)} />
            <button className="battle-back" disabled={committed} onClick={() => setSkill(null)}>
              ‹ Another skill
            </button>
          </div>
        ) : (
          <div className="battle-menu-wrap">
            <p className="battle-prompt">{state.log.length ? 'What will you do?' : 'You go first. What will you do?'}</p>
            <div className="battle-menu">
              {SKILLS.map((s) => {
                const level = state.fighters[me].tree[s];
                return (
                  <button key={s} className={`battle-cmd ${s}`} disabled={level < 1} onClick={() => setSkill(s)}>
                    <SkillIcon skill={s} />
                    <strong>{SKILL_NAME[s]}</strong>
                    <small>{level < 1 ? 'Locked' : `Lv ${level}`}</small>
                  </button>
                );
              })}
              <button className="battle-cmd log" disabled={!state.log.length} onClick={() => setLog(true)}>
                <LogIcon />
                <strong>Log</strong>
                <small>{state.log.length} turns</small>
              </button>
            </div>
          </div>
        )}
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

function InfoBox({ name, level, hp, max, effects, foe, numbers }: { name: string; level: number; hp: number; max: number; effects: string[]; foe?: boolean; numbers?: boolean }) {
  const pct = Math.max(0, Math.round((hp * 100) / max));
  return (
    <div className={`battle-info ${foe ? 'foe' : 'mine'}`}>
      <div className="battle-info-top">
        <strong>{name}</strong>
        <span>Lv{level}</span>
      </div>
      <div className="battle-hp">
        <small>HP</small>
        <div className="battle-hp-track">
          <div className={`battle-hp-fill${pct <= 20 ? ' low' : pct <= 50 ? ' mid' : ''}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      {(numbers || effects.length > 0) && (
        <div className="battle-info-foot">
          <span className="battle-fx">
            {effects.map((e) => (
              <i key={e}>{e}</i>
            ))}
          </span>
          {numbers && (
            <span className="battle-hp-num">
              {hp}/{max}
            </span>
          )}
        </div>
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
    delay = d.missed ? 650 : attackImpactMs(d.id, !!kit?.enrage);
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
    delay = SPIN_MS + Math.max(0, d.balls.length - 1) * BALL_GAP + 300;
    if (d.hit) result.push(`A ball landed on ${d.pick}! Instant kill!`);
    else {
      result.push(`No ball on ${d.pick}. A punch instead!`);
      hurt();
    }
  } else {
    opening.push(`${who(by)} used Poker!`);
    opening.push(`${target === me ? 'You take' : `${who(target)} takes`} a card…`);
    delay = POKER_FLIP_MS + 500;
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

/** A big moment gets a stamp across the field. */
function stampOf(t: Turn): string | null {
  const d = t.detail;
  if (t.kill) return '💀 INSTANT KO';
  if (d.skill === 'stopwatch' && d.perfect) return 'NO WAY!!';
  if (d.skill === 'poker') return d.won ? 'ROYAL W' : 'FOLDED';
  if (d.skill === 'attack' && d.missed) return 'MISSED LOL';
  if (t.crit) return 'CRIT!!';
  return null;
}

/** One line for the log. */
function describe(state: HeroState, t: Turn, who: string): string {
  const d = t.detail;
  const hit = t.kill ? 'instant kill!' : t.damage ? `${t.damage} damage${t.crit ? ' (crit)' : ''}` : 'no damage';
  const burn = t.burn ? `, burned for ${t.burn}` : '';
  if (d.skill === 'stopwatch') return `${who}: Stopwatch ${secs(d.ms)} for ${secs(d.target)}, ${hit}${burn}`;
  if (d.skill === 'roulette') return `${who}: Roulette on ${d.pick}, ${d.hit ? 'hit' : 'missed'}, ${hit}${burn}`;
  if (d.skill === 'poker') return `${who}: Poker ${rankName(d.mine)} vs ${rankName(d.theirs)}, ${hit}${burn}`;
  const kit = state.fighters[t.by].kit;
  const name = kit ? ATTACK_NAMES[kit.family][d.id] : d.id;
  const what = d.missed ? 'missed' : ATTACKS[d.id].power > 0 ? hit : d.effect ? EFFECT_NAME[d.effect].toLowerCase() : 'nothing';
  return `${who}: ${name}, ${what}${d.healed ? `, healed ${d.healed}` : ''}`;
}

const secs = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

/** Side 1 is played by the bot brain (a bot creature, or another player's hero in the arena). */
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
  if (skill === 'roulette') return <RoulettePick balls={state.fighters[me].tree.roulette} onPick={(pick) => onMove({ skill, pick })} />;
  return <PokerPick onPick={(pick) => onMove({ skill, pick })} onCommit={onCommit} />;
}

// ---------- Poker: thirteen cards, shuffled, then a pick ----------

/** How long the deck shows face up, then how long the shuffle takes. */
const POKER_SHOW_MS = 1300;
const POKER_SHUFFLE_MS = 1300;
/** In the reveal: when the two picked cards turn over. */
const POKER_FLIP_MS = 1500;

const ORDERED = Array.from({ length: RANKS }, (_, i) => i + 2);

/** Where card `i` lies: seven on top, six under, as offsets from the middle in card widths. */
const slot = (i: number) => (i < 7 ? { col: i - 3, row: -0.5 } : { col: i - 7 - 2.5, row: 0.5 });

/**
 * The deck shows 2 to A face up, turns over and shuffles; then you pick one. Answering the
 * other side's Poker, their card (`taken`, with its owner's name) is already out.
 */
function PokerPick({ onPick, onCommit, taken, takenBy }: { onPick: (pick: number) => void; onCommit: () => void; taken?: number; takenBy?: string }) {
  const [phase, setPhase] = useState<'show' | 'shuffle' | 'pick'>('show');
  useEffect(() => {
    const a = setTimeout(() => setPhase('shuffle'), POKER_SHOW_MS);
    const b = setTimeout(() => setPhase('pick'), POKER_SHOW_MS + POKER_SHUFFLE_MS);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  return (
    <div className="hero-play">
      <p className="note center-note">
        {phase === 'show'
          ? 'Thirteen cards, 2 to A…'
          : phase === 'shuffle'
            ? 'Shuffling…'
            : taken !== undefined
              ? `${takenBy} took a card. Pick yours: beat it and their hit misses.`
              : 'Pick a card. They pick another; the higher card wins a big crit.'}
      </p>
      <div className={`pk-table pk-${phase}`}>
        {ORDERED.map((rank, i) => {
          const { col, row } = slot(i);
          // Each card's own path into the pile and back.
          const style = { '--col': col, '--row': row, '--spin': `${((i * 47) % 40) - 20}deg`, '--wait': `${(i * 37) % 300}ms` } as CSSProperties;
          const out = phase === 'pick' && i === taken;
          return (
            <button
              key={i}
              className={`pk-card${out ? ' theirs' : ''}`}
              style={style}
              disabled={phase !== 'pick' || out}
              onClick={() => {
                onCommit();
                onPick(i);
              }}
              aria-label={phase === 'pick' ? `Card ${i + 1}` : rankName(rank)}
            >
              <span className={`pk-inner${phase === 'show' ? '' : ' down'}`}>
                <span className="pk-face">{rankName(rank)}</span>
                <span className="pk-back" />
              </span>
              {out && <small className="pk-who">{takenBy}</small>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Over the field: the face-down deck, the attacker's pick, the defender's choosing, then both turn over. */
function PokerReveal({ detail, mine, theirs, chose }: { detail: Extract<Turn['detail'], { skill: 'poker' }>; mine: string; theirs: string; chose: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [all, setAll] = useState(false);
  useEffect(() => {
    // The defender's eye wanders over the other cards, then settles.
    const others = ORDERED.map((_, i) => i).filter((i) => i !== detail.pick);
    // You picked it yourself: no need to watch yourself choose.
    const hops = chose ? [] : [3, 9, 1, 6, 11].map((k) => others[(k + detail.theirPick) % others.length]);
    const timers = hops.map((h, k) => setTimeout(() => setHover(h), 250 + k * 180));
    timers.push(setTimeout(() => setHover(detail.theirPick), 250 + hops.length * 180));
    timers.push(setTimeout(() => setFlipped(true), POKER_FLIP_MS));
    timers.push(setTimeout(() => setAll(true), POKER_FLIP_MS + 700));
    return () => timers.forEach(clearTimeout);
  }, [detail]);
  return (
    <div className="battle-show">
      <div className="pk-table reveal">
        {detail.deck.map((rank, i) => {
          const { col, row } = slot(i);
          const isAttacker = i === detail.pick;
          const isDefender = i === detail.theirPick && hover === detail.theirPick;
          const up = (flipped && (i === detail.pick || i === detail.theirPick)) || all;
          const won = flipped && ((isAttacker && detail.won) || (i === detail.theirPick && !detail.won));
          // Your card is ringed in gold, theirs in red, whoever attacked.
          const yours = chose ? isDefender : isAttacker;
          const foes = chose ? isAttacker : isDefender;
          return (
            <span
              key={i}
              className={`pk-card${yours ? ' picked' : ''}${foes ? ' theirs' : ''}${hover === i && !isDefender ? ' hover' : ''}${won ? ' won' : ''}${all && !isAttacker && i !== detail.theirPick ? ' dim' : ''}${row < 0 ? ' top' : ''}`}
              style={{ '--col': col, '--row': row } as CSSProperties}
            >
              <span className={`pk-inner${up ? '' : ' down'}`}>
                <span className="pk-face">{rankName(rank)}</span>
                <span className="pk-back" />
              </span>
              {isAttacker && <small className="pk-who">{mine}</small>}
              {i === detail.theirPick && hover === detail.theirPick && <small className="pk-who">{theirs}</small>}
            </span>
          );
        })}
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
      <button className="button primary hero-go" disabled={pick === null} onClick={() => pick !== null && onPick(pick)}>
        {pick === null ? `Pick a number · ${balls} ${balls === 1 ? 'ball' : 'balls'}` : `Spin on ${pick}`}
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

/** The wheel spins one way, the balls the other, and each drops into its pocket. */
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
      const start = i * 33;
      run.animate([{ transform: `rotate(${start}deg)` }, { transform: `rotate(${end}deg)` }], { ...timing, delay: i * BALL_GAP });
      run.querySelector('.spin-ball')?.animate(
        [{ transform: 'translateY(0)' }, { transform: 'translateY(0)', offset: 0.72 }, { transform: 'translateY(13px)' }],
        { duration: SPIN_MS, delay: i * BALL_GAP, easing: 'ease-in', fill: 'forwards' },
      );
    });
    const t = setTimeout(() => setLanded(true), SPIN_MS + Math.max(0, balls.length - 1) * BALL_GAP);
    return () => clearTimeout(t);
    // One spin per turn: the component is keyed by it.
  }, []);

  const hit = balls.includes(pick);
  return (
    <div className="battle-show">
      <svg className={`spin-wheel${landed ? (hit ? ' hit' : ' landed') : ''}`} viewBox="-112 -112 224 224" aria-label={`Roulette on ${pick}`}>
        <circle className="spin-rim" r="111" />
        <circle className="spin-track" r="104" />
        <g ref={wheel} className="spin-turn">
          {POCKETS.map((n, i) => {
            const a0 = i * STEP - STEP / 2;
            const a1 = i * STEP + STEP / 2;
            const ballHere = landed && balls.includes(n);
            return (
              <g key={n}>
                <path
                  className={`spin-pocket ${colourOf(n)}${n === pick ? ' picked' : ''}${ballHere ? ' ball' : ''}`}
                  d={`M${polar(94, a0)} A94 94 0 0 1 ${polar(94, a1)} L${polar(70, a1)} A70 70 0 0 0 ${polar(70, a0)} Z`}
                />
                <text className="spin-num" transform={`rotate(${i * STEP}) translate(0 -82)`}>
                  {n}
                </text>
              </g>
            );
          })}
          <circle className="spin-cone" r="70" />
          {[0, 90, 180, 270].map((a) => (
            <path key={a} className="spin-spoke" d={`M0 0 L${polar(46, a)}`} />
          ))}
          <circle className="spin-hub" r="14" />
        </g>
        {balls.map((_, i) => (
          <g
            key={i}
            ref={(el) => {
              runs.current[i] = el;
            }}
            className="spin-run"
          >
            <circle r="111" fill="none" />
            <circle className="spin-ball" cy="-99" r="5" />
          </g>
        ))}
      </svg>
    </div>
  );
}

const LogIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <path d="M5 6h14M5 12h14M5 18h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

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
