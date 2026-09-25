import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { CreatureChip } from '../components/CreatureChip';
import { ItemChip } from '../components/ItemChip';
import { SettingsButton } from '../components/SettingsSheet';
import { TraitIcon } from '../components/TraitIcon';
import { setMusicLevel, sfx, startMusic, stopMusic, vibrate } from '../game/audio';
import { PhaserGame } from '../game/PhaserGame';
import { registerSellZone } from '../game/boardBridge';
import { BattleScene } from '../game/scenes/BattleScene';
import { useRunStore } from '../runStore';
import { Bag, FightBar, Notice, TeamStrip, UnitBubble, UnitGhost, UnitSheet, useDismiss, useDockInset } from './board';
import {
  getItem,
  getTrait,
  getUnit,
  LEVEL_XP,
  UNITS,
  MAX_LEVEL,
  REROLL_COST,
  SHOP_ODDS,
  MAX_INTEREST,
  WIN_BONUS,
  XP_COST,
  type TraitId,
} from '../sim/balance';
import { baseIncome, dropsItem, interest, nextDropRound, sellValue, surgePercent } from '../sim/economy';
import { boardCount, buy, buyXp, ownedUnits, reroll, toggleLock, whyNotBuy, type RunState } from '../sim/planning';
import { activeTraits } from '../sim/traits';

const SCENES = [BattleScene];

export function Run() {
  const run = useRunStore((s) => s.run);
  const battle = useRunStore((s) => s.battle);
  const startRun = useRunStore((s) => s.startRun);

  // Arriving here without a run (a bookmark, or the last one ended) starts a fresh one.
  useEffect(() => {
    if (!useRunStore.getState().run) startRun();
  }, [startRun]);

  // A new run, including one started from the summary, gets a new track.
  const seed = run?.seed;
  useEffect(() => {
    startMusic();
    return stopMusic;
  }, [seed]);

  useEffect(() => {
    if (!run) return;
    setMusicLevel(battle ? (run.round >= 10 ? 3 : run.round >= 5 ? 2 : 1) : 0);
  }, [battle, run]);

  const result = useRoundResult();
  useOnlineSync();
  const { stage, tray, fightBar } = useDockInset(battle !== null);

  if (!run) return null;
  // During the replay, show the run as it was when the fight began.
  const shown = battle ? battle.before : run;

  return (
    <main className={battle ? 'screen run fighting' : 'screen run'}>
      <Hud run={shown} />
      {battle ? (
        <TeamStrip side="rival" name={battle.opponent} tag={battle.opponentKind === 'ghost' ? 'player' : 'bot'} />
      ) : (
        <TraitRail run={shown} />
      )}
      {/* The board fills the stage and the dock floats over its bottom edge. The canvas never
          resizes between planning and a fight; the camera refits to the part left showing. */}
      <div className="stage" ref={stage}>
        <PhaserGame className="board-canvas" scenes={SCENES} responsive transparent />
        <div className="dock">
          <div ref={tray} className={battle ? 'dock-layer tray-layer inactive' : 'dock-layer tray-layer'} aria-hidden={battle ? true : undefined}>
            <Tray run={run} />
          </div>
          <div ref={fightBar} className={battle ? 'dock-layer fight-layer' : 'dock-layer fight-layer inactive'} aria-hidden={battle ? undefined : true}>
            {battle && <FightBar />}
          </div>
        </div>
        {result && <RoundResult result={result} />}
      </div>
      <UnitGhost />
      <UnitBubble />
      <UnitSheet />
      <Notice />
      {run.done && !battle && <Summary run={run} />}
    </main>
  );
}

function Hud({ run }: { run: RunState }) {
  const leaveRun = useRunStore((s) => s.leaveRun);
  const navigate = useNavigate();
  // Leaving throws the run away, so it takes a second tap.
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);
  return (
    <header className="glass run-hud">
      <Link className="icon-button" to="/" aria-label="Home">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      <div className="hud-round">
        <span className="micro">{run.mode === 'daily' ? 'Daily' : 'Round'}</span>
        <strong>
          {run.round}
          {surgePercent(run.round) > 100 && (
            <small className="surge" aria-label={`Rivals ${surgePercent(run.round) - 100}% stronger`}>
              +{surgePercent(run.round) - 100}%
            </small>
          )}
        </strong>
      </div>
      <div className="hud-hp" aria-label={`${run.hp} health`}>
        <div className="hp-bar">
          <span style={{ width: `${run.hp}%` }} />
        </div>
        <strong>
          <AnimatedNumber value={run.hp} />
        </strong>
      </div>
      <div className="hud-wins" aria-label={`${run.wins} wins`}>
        <strong>
          <AnimatedNumber value={run.wins} />
        </strong>
        <span className="micro">Wins</span>
      </div>
      <SettingsButton>
        <Link className="button ghost" to="/how">
          How to play
        </Link>
        <button
          className={confirming ? 'button danger' : 'button ghost danger'}
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              return;
            }
            leaveRun();
            navigate('/');
          }}
        >
          {confirming ? 'Tap again to leave' : 'Leave run'}
        </button>
      </SettingsButton>
    </header>
  );
}

/**
 * Your traits as coloured icons with a count, strongest first. Tapping one names it, says
 * what it does, and shows every creature that has it, dimming the ones you don't own.
 */
function TraitRail({ run }: { run: RunState }) {
  const [open, setOpen] = useState<TraitId | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(null), []);
  useDismiss(open !== null, wrap, close);
  const onBoard = run.board.flatMap((unit) => (unit ? [unit.unitId] : []));
  const benched = new Set(run.bench.flatMap((unit) => (unit ? [unit.unitId] : [])));
  const traits = activeTraits(onBoard)
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.tier - a.tier || b.count - a.count);
  const shown = open ? getTrait(open) : null;
  const roster = open ? UNITS.filter((unit) => unit.origin === open || unit.role === open).sort((a, b) => a.cost - b.cost) : [];

  return (
    <div className="trait-rail-wrap" ref={wrap}>
      <div className="trait-rail">
        <span className="board-count" aria-label={`${boardCount(run)} of ${run.level} on the board`}>
          {boardCount(run)}/{run.level}
        </span>
        {traits.map(({ trait, count, tier }) => (
          <button
            key={trait.id}
            className={`trait-chip tier-${tier}`}
            style={{ '--trait': `var(--trait-${trait.id})` } as CSSProperties}
            aria-label={`${trait.name} ${count}`}
            onClick={() => setOpen(open === trait.id ? null : trait.id)}
          >
            <TraitIcon trait={trait.id} size={16} />
            <b>{count}</b>
            <small>/{count >= trait.thresholds[0] ? trait.thresholds[1] : trait.thresholds[0]}</small>
          </button>
        ))}
        {traits.length === 0 && <span className="hint">Drag units from the bench onto your hexes</span>}
      </div>
      {shown && (
        <div className="glass trait-pop" role="dialog" onClick={() => setOpen(null)}>
          <strong>
            <TraitIcon trait={shown.id} size={14} /> {shown.name}
          </strong>
          <span className="note">
            {shown.thresholds.map((threshold, index) => `${threshold}: ${shown.description.replace('{v}', `${shown.values[index]}`)}`).join(' · ')}
          </span>
          <ul className="trait-roster" aria-label={`Creatures with ${shown.name}`}>
            {roster.map((unit) => (
              <li key={unit.id} className={onBoard.includes(unit.id) ? 'fielded' : benched.has(unit.id) ? 'benched' : 'unowned'}>
                <CreatureChip unitId={unit.id} size={36} />
                <span>{unit.name}</span>
                <small>
                  <span className="coin" aria-hidden="true" />
                  {unit.cost}
                </small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Tray({ run }: { run: RunState }) {
  const act = useRunStore((s) => s.act);
  const notify = useRunStore((s) => s.notify);
  const fight = useRunStore((s) => s.fight);
  const unitDrag = useRunStore((s) => s.unitDrag);
  const xpInto = run.xp - LEVEL_XP[run.level];
  const xpNeeded = run.level < MAX_LEVEL ? LEVEL_XP[run.level + 1] - LEVEL_XP[run.level] : 0;
  const empty = boardCount(run) === 0 && ownedUnits(run).length === 0;
  const dragged = unitDrag ? (unitDrag.slot.area === 'board' ? run.board : run.bench)[unitDrag.slot.index] : null;
  const nextIncome = baseIncome(run.round + 1) + interest(run.gold);
  const [pop, setPop] = useState<'income' | 'odds' | null>(null);
  const controls = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setPop(null), []);
  useDismiss(pop !== null, controls, close);

  return (
    <section className="glass tray-dock">
      <div className="controls" ref={controls}>
        <button
          className="gold"
          aria-label={`${run.gold} gold, +${nextIncome} next round`}
          aria-expanded={pop === 'income'}
          onClick={() => setPop(pop === 'income' ? null : 'income')}
        >
          <span className="coin" aria-hidden="true" />
          <AnimatedNumber value={run.gold} />
          <small className="income">+{nextIncome}</small>
        </button>
        <button className="level" aria-expanded={pop === 'odds'} onClick={() => setPop(pop === 'odds' ? null : 'odds')}>
          <span className="micro">Lv {run.level}</span>
          <span className="xp-bar" aria-label={`${xpInto} of ${xpNeeded} XP`}>
            <span style={{ width: xpNeeded ? `${(xpInto / xpNeeded) * 100}%` : '100%' }} />
          </span>
        </button>
        <button
          className="button small"
          disabled={run.gold < XP_COST || run.level >= MAX_LEVEL}
          onClick={() => {
            const before = run.level;
            if (!act(buyXp)) return;
            if (useRunStore.getState().run!.level > before) sfx.levelUp();
            else sfx.xp();
          }}
        >
          XP <span className="price">{XP_COST}</span>
        </button>
        <button
          className="button small"
          disabled={run.gold < REROLL_COST}
          onClick={() => {
            if (act(reroll)) sfx.reroll();
          }}
          aria-label={`Reroll for ${REROLL_COST} gold`}
        >
          ↻ <span className="price">{REROLL_COST}</span>
        </button>
        <button
          className={run.locked ? 'button small lock on' : 'button small lock'}
          aria-pressed={run.locked ?? false}
          aria-label={run.locked ? 'Shop kept for next round' : 'Keep this shop for next round'}
          onClick={() => act(toggleLock)}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d={run.locked ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.6-1.8'}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" />
          </svg>
        </button>
        {pop === 'income' && <IncomePop run={run} onClose={close} />}
        {pop === 'odds' && <OddsPop level={run.level} onClose={close} />}
      </div>

      {/* Always there, even empty, so the tray (and the board above it) never changes height. */}
      <Bag bag={run.bag} hint={`Next item after round ${nextDropRound(run.round)}`} />

      <div className="shop-wrap" ref={registerSellZone}>
        <div className="shop" aria-label="Shop" aria-hidden={dragged ? true : undefined}>
          {run.shop.map((unitId, index) =>
            unitId ? (
              <ShopCard
                key={`${index}-${unitId}`}
                unitId={unitId}
                owned={ownedUnits(run).filter((u) => u.unitId === unitId && u.star === 1).length}
                affordable={run.gold >= getUnit(unitId).cost}
                onBuy={() => {
                  const reason = whyNotBuy(run, index);
                  if (reason) notify(reason);
                  else if (act((r) => buy(r, index))) sfx.buy();
                }}
              />
            ) : (
              <div key={`${index}-sold`} className="shop-card sold" aria-hidden="true" />
            ),
          )}
        </div>
        {dragged && (
          <div className={unitDrag?.overSell ? 'sell-zone over' : 'sell-zone'} role="status">
            Sell for <span className="coin" aria-hidden="true" />
            {sellValue(getUnit(dragged.unitId).cost, dragged.star)}
          </div>
        )}
      </div>

      <button className="button primary big fight-button" disabled={empty} onClick={fight}>
        Fight
      </button>
    </section>
  );
}

/** What next round pays, and how banking gold adds to it. */
function IncomePop({ run, onClose }: { run: RunState; onClose: () => void }) {
  const base = baseIncome(run.round + 1);
  const earned = interest(run.gold);
  const toNext = earned < MAX_INTEREST ? (earned + 1) * 10 - run.gold : 0;
  return (
    <div className="glass trait-pop tray-pop" role="dialog" onClick={onClose}>
      <strong>Next round</strong>
      <dl className="income-lines">
        <div>
          <dt>Base</dt>
          <dd>+{base}</dd>
        </div>
        <div>
          <dt>Interest, 1 per 10 banked (up to {MAX_INTEREST})</dt>
          <dd>+{earned}</dd>
        </div>
        <div>
          <dt>If you win</dt>
          <dd>+{WIN_BONUS}</dd>
        </div>
      </dl>
      <span className="note">{toNext > 0 ? `Bank ${toNext} more for +1 interest.` : 'Interest is maxed.'}</span>
    </div>
  );
}

/** The chance of each cost in a shop slot, at this level and the next. */
function OddsPop({ level, onClose }: { level: number; onClose: () => void }) {
  const row = (at: number) => (
    <div className="odds-row">
      <span className="micro">Lv {at}</span>
      {SHOP_ODDS[at].map((percent, index) => (
        <span
          key={index}
          className={percent ? 'odds-chip' : 'odds-chip none'}
          style={{ '--tier': `var(--tier-${index + 1})` } as CSSProperties}
          aria-label={`${index + 1} gold: ${percent}%`}
        >
          <span className="coin" aria-hidden="true" />
          {index + 1} <b>{percent}%</b>
        </span>
      ))}
    </div>
  );
  return (
    <div className="glass trait-pop tray-pop" role="dialog" onClick={onClose}>
      <strong>Shop odds</strong>
      {row(level)}
      {level < MAX_LEVEL && row(level + 1)}
    </div>
  );
}

/** How long a press has to be held to peek at a creature instead of tapping it. */
const LONG_PRESS_MS = 380;

function ShopCard({ unitId, owned, affordable, onBuy }: { unitId: string; owned: number; affordable: boolean; onBuy: () => void }) {
  const unit = getUnit(unitId);
  const timer = useRef<number | undefined>(undefined);
  const start = useRef({ x: 0, y: 0 });
  // A long press peeks; the click that ends it mustn't also buy.
  const peeked = useRef(false);
  const cancel = () => window.clearTimeout(timer.current);
  useEffect(() => cancel, []);

  return (
    <button
      className={`shop-card cost-${unit.cost}${affordable ? '' : ' poor'}${owned >= 2 ? ' combines' : owned === 1 ? ' owned' : ''}`}
      aria-label={owned > 0 ? `${unit.name}, you have ${owned}` : unit.name}
      onPointerDown={(event) => {
        peeked.current = false;
        start.current = { x: event.clientX, y: event.clientY };
        const card = event.currentTarget.getBoundingClientRect();
        cancel();
        timer.current = window.setTimeout(() => {
          peeked.current = true;
          vibrate(10);
          useRunStore.setState({ peek: { unitId, star: 1, x: card.left + card.width / 2, y: card.top } });
        }, LONG_PRESS_MS);
      }}
      onPointerMove={(event) => {
        if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 8) cancel();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => {
        if (peeked.current) {
          peeked.current = false;
          return;
        }
        onBuy();
      }}
    >
      <CreatureChip unitId={unitId} size={44} />
      <span className="card-traits">
        <TraitIcon trait={unit.origin} size={14} />
        <TraitIcon trait={unit.role} size={14} />
      </span>
      <span className="card-name">{unit.name}</span>
      <span className="card-cost" aria-label={`${unit.cost} gold`}>
        <span className="coin" aria-hidden="true" />
        {unit.cost}
      </span>
    </button>
  );
}

interface RoundOutcome {
  id: number;
  won: boolean;
  draw: boolean;
  round: number;
  damage: number;
  item?: string;
}

/** A card over the board for a moment after a fight, saying what the round cost or paid. */
function RoundResult({ result }: { result: RoundOutcome }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    setGone(false);
    const timer = setTimeout(() => setGone(true), 2600);
    // It never takes a touch (the player is usually about to drag something under it);
    // the first press anywhere just clears it away.
    const dismiss = () => setGone(true);
    window.addEventListener('pointerdown', dismiss);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', dismiss);
    };
  }, [result.id]);
  if (gone) return null;
  const tone = result.won ? 'won' : result.draw ? 'draw' : 'lost';

  return (
    <div className={`glass round-result ${tone}`} role="status">
      <strong>{result.won ? 'Round won' : result.draw ? 'Round drawn' : 'Round lost'}</strong>
      <span className="note">
        {result.damage > 0
          ? `−${result.damage} HP`
          : surgePercent(result.round + 1) > 100
            ? `Next rival +${surgePercent(result.round + 1) - 100}%`
            : `Round ${result.round}`}
      </span>
      {result.item && (
        <span className="drop">
          <ItemChip itemId={result.item} size={22} />
          {getItem(result.item).name} dropped
        </span>
      )}
    </div>
  );
}

/** What the round just did to the run, for the card over the board. Shown as soon as the
    last unit falls; the run was already advanced when the fight began. */
function useRoundResult() {
  const over = useRunStore((s) => s.battle?.over ?? false);
  const fighting = useRunStore((s) => s.battle !== null);
  const [result, setResult] = useState<RoundOutcome | null>(null);
  // Skipping ends the replay before it's marked over, so the end of a fight counts too.
  const pending = useRef(false);
  useEffect(() => {
    if (fighting && !over) {
      pending.current = true;
      setResult(null);
      return;
    }
    if (!pending.current) return;
    pending.current = false;
    const run = useRunStore.getState().run;
    const last = run?.history.at(-1);
    if (!run || !last || run.done) return;
    const dropped = run.bag.length > 0 && dropsItem(last.round) ? run.bag[run.bag.length - 1] : undefined;
    setResult({ id: last.round, won: last.won, draw: last.draw, round: last.round, damage: last.damage, item: dropped });
  }, [fighting, over]);
  return result;
}

function Summary({ run }: { run: RunState }) {
  const startRun = useRunStore((s) => s.startRun);
  const leaveRun = useRunStore((s) => s.leaveRun);
  const stats = useRunStore((s) => s.stats);
  const online = useRunStore((s) => s.online);
  const navigate = useNavigate();
  const saving = online !== null && online.status !== 'offline' && (online.status === 'starting' || online.pending.length > 0);
  // Leaving drops anything unsaved, so wait for the result, but not forever.
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (!saving) return;
    const timer = setTimeout(() => setGaveUp(true), 12_000);
    return () => clearTimeout(timer);
  }, [saving]);
  const blocked = saving && !gaveUp;

  return (
    <div className="overlay">
      <div className="panel">
        <p className="micro">Knocked out in round {run.round}</p>
        <p className="big-score">
          <AnimatedNumber value={run.wins} from={0} />
        </p>
        <p className="note">wins in {run.history.length} rounds</p>
        {stats.lastRunWasBest && <p className="highlight">Best run yet!</p>}
        <ol className="round-strip" aria-label="Round results">
          {run.history.map((round) => (
            <li key={round.round} className={round.won ? 'won' : round.draw ? 'draw' : 'lost'} title={`Round ${round.round}`} />
          ))}
        </ol>
        <p className="note status-line small-print">
          {blocked ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Saving your result…
            </>
          ) : online?.status === 'live' && !saving ? (
            <Link to="/ranks">See today's rankings</Link>
          ) : (
            "This run couldn't be saved online, so it isn't ranked."
          )}
        </p>
        <div className="menu">
          <button className="button primary" disabled={blocked} onClick={() => startRun()}>
            New run
          </button>
          <button
            className="button ghost"
            disabled={blocked}
            onClick={() => {
              leaveRun();
              navigate('/');
            }}
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}

/** Keeps the run's Firestore writes moving, and finds a real player's board for each round. */
function useOnlineSync() {
  const round = useRunStore((s) => s.run?.round);
  const fighting = useRunStore((s) => s.battle !== null);
  const sync = useRunStore((s) => s.sync);
  const prepareOpponent = useRunStore((s) => s.prepareOpponent);

  useEffect(() => {
    void sync();
    const retry = () => void sync();
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [sync]);

  useEffect(() => {
    if (!fighting) void prepareOpponent();
  }, [round, fighting, prepareOpponent]);
}
