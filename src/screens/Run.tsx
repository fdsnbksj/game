import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { CreatureChip } from '../components/CreatureChip';
import { ItemChip } from '../components/ItemChip';
import { SettingsButton } from '../components/SettingsSheet';
import { TraitIcon } from '../components/TraitIcon';
import { setMusicLevel, sfx, startMusic, stopMusic } from '../game/audio';
import { PhaserGame } from '../game/PhaserGame';
import { registerSellZone, setBottomInset, unitSlotAtClient } from '../game/boardBridge';
import { BattleScene } from '../game/scenes/BattleScene';
import { useRunStore, type Battle } from '../runStore';
import {
  getItem,
  getTrait,
  ITEM_ROUNDS,
  getUnit,
  LEVEL_XP,
  MAX_LEVEL,
  MAX_ROUNDS,
  REROLL_COST,
  STAR_PERCENT,
  TICKS_PER_SECOND,
  XP_COST,
  type TraitId,
} from '../sim/balance';
import { sellValue } from '../sim/economy';
import { boardCount, buy, buyXp, equip, ownedUnits, reroll, sell, unequip, whyNotBuy, type RunState, type Slot } from '../sim/planning';
import { activeTraits } from '../sim/traits';

const SCENES = [BattleScene];

const traitName = (id: TraitId) => getTrait(id).name;

export function Run() {
  const run = useRunStore((s) => s.run);
  const battle = useRunStore((s) => s.battle);
  const startRun = useRunStore((s) => s.startRun);

  // Arriving here without a run (a bookmark, or the last one ended) starts a fresh one.
  useEffect(() => {
    if (!useRunStore.getState().run) startRun();
  }, [startRun]);

  useEffect(() => {
    startMusic();
    return stopMusic;
  }, []);

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
      {battle ? <VersusHeader battle={battle} /> : <TraitRail run={shown} />}
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
      <UnitSheet />
      <Notice />
      {run.done && !battle && <Summary run={run} />}
    </main>
  );
}

/** Tells the board how much of the canvas the dock covers, as the dock changes. */
function useDockInset(fighting: boolean) {
  const stage = useRef<HTMLDivElement>(null);
  const tray = useRef<HTMLDivElement>(null);
  const fightBar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Measured by height rather than position: the layers slide in and out with transforms.
    const report = () => {
      const layer = fighting ? fightBar.current : tray.current;
      const dock = layer?.parentElement;
      if (!stage.current || !layer || !dock) return;
      const gap = stage.current.getBoundingClientRect().bottom - dock.getBoundingClientRect().bottom;
      setBottomInset(Math.round(layer.offsetHeight + gap));
    };
    report();
    const observer = new ResizeObserver(report);
    for (const element of [stage.current, tray.current, fightBar.current]) if (element) observer.observe(element);
    return () => observer.disconnect();
  }, [fighting]);
  useEffect(() => () => setBottomInset(0), []);
  return { stage, tray, fightBar };
}

function Hud({ run }: { run: RunState }) {
  const leaveRun = useRunStore((s) => s.leaveRun);
  const navigate = useNavigate();
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
          <small>/{MAX_ROUNDS}</small>
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
          className="button ghost danger"
          onClick={() => {
            leaveRun();
            navigate('/');
          }}
        >
          Leave run
        </button>
      </SettingsButton>
    </header>
  );
}

/** Active traits first, named, then the rest as icons, with a popover for whichever one is tapped. */
function TraitRail({ run }: { run: RunState }) {
  const [open, setOpen] = useState<TraitId | null>(null);
  const traits = activeTraits(run.board.flatMap((unit) => (unit ? [unit.unitId] : [])))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.tier - a.tier || b.count - a.count);
  const shown = open ? getTrait(open) : null;

  return (
    <div className="trait-rail-wrap">
      <div className="trait-rail">
        <span className="board-count" aria-label={`${boardCount(run)} of ${run.level} on the board`}>
          {boardCount(run)}/{run.level}
        </span>
        {traits.map(({ trait, count, tier }) => (
          <button key={trait.id} className={`trait-chip tier-${tier}`} onClick={() => setOpen(open === trait.id ? null : trait.id)}>
            <TraitIcon trait={trait.id} size={16} />
            {tier > 0 && <span className="trait-name">{trait.name}</span>}
            <b>{count}</b>
            <small>/{count >= trait.thresholds[0] ? trait.thresholds[1] : trait.thresholds[0]}</small>
          </button>
        ))}
        {traits.length === 0 && <span className="hint">Drag units from the bench onto your hexes</span>}
      </div>
      {shown && (
        <div className="glass trait-pop" role="dialog" onClick={() => setOpen(null)}>
          <strong>{shown.name}</strong>
          <span className="note">
            {shown.thresholds.map((threshold, index) => `${threshold}: ${shown.description.replace('{v}', `${shown.values[index]}`)}`).join(' · ')}
          </span>
        </div>
      )}
    </div>
  );
}

/** During a fight: both teams, with the health each has left. */
function VersusHeader({ battle }: { battle: Battle }) {
  const teamHp = useRunStore((s) => s.teamHp);
  const share = (hp: number, max: number) => (max > 0 ? `${(hp / max) * 100}%` : '0%');
  return (
    <div className="versus-header" aria-label={`You versus ${battle.opponent}`}>
      <div className="team mine">
        <span className="team-name">You</span>
        <div className="team-bar">
          <span style={{ width: share(teamHp?.a ?? 1, teamHp?.maxA ?? 1) }} />
        </div>
      </div>
      <span className="vs">vs</span>
      <div className="team rival">
        <span className="team-name">
          <span className="rival-name">{battle.opponent}</span>
          <small className="rival-kind">{battle.opponentKind === 'ghost' ? 'player' : 'bot'}</small>
        </span>
        <div className="team-bar">
          <span style={{ width: share(teamHp?.b ?? 1, teamHp?.maxB ?? 1) }} />
        </div>
      </div>
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

  return (
    <section className="glass tray-dock">
      <div className="controls">
        <div className="gold" aria-label={`${run.gold} gold`}>
          <span className="coin" aria-hidden="true" />
          <AnimatedNumber value={run.gold} />
        </div>
        <div className="level">
          <span className="micro">Lv {run.level}</span>
          <div className="xp-bar" aria-label={`${xpInto} of ${xpNeeded} XP`}>
            <span style={{ width: xpNeeded ? `${(xpInto / xpNeeded) * 100}%` : '100%' }} />
          </div>
        </div>
        <button
          className="button small"
          disabled={run.gold < XP_COST || run.level >= MAX_LEVEL}
          onClick={() => {
            const before = run.level;
            if (act(buyXp) && useRunStore.getState().run!.level > before) sfx.levelUp();
          }}
        >
          XP <span className="price">{XP_COST}</span>
        </button>
        <button className="button small" disabled={run.gold < REROLL_COST} onClick={() => act(reroll)} aria-label={`Reroll for ${REROLL_COST} gold`}>
          ↻ <span className="price">{REROLL_COST}</span>
        </button>
      </div>

      {run.bag.length > 0 && <Bag bag={run.bag} />}

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

/** A little movement before a press becomes a drag, so a tap still opens the item's card. */
const DRAG_START = 6;

interface ItemDrag {
  index: number;
  itemId: string;
  start: { x: number; y: number };
  at: { x: number; y: number };
  moving: boolean;
  /** Dropped away from a creature: the ghost glides back before it goes. */
  returning: boolean;
}

/** Items waiting to be given out. Drag one onto a creature to give it; tap to read it. */
function Bag({ bag }: { bag: string[] }) {
  const act = useRunStore((s) => s.act);
  // The drag lives in a ref, so a quick flick's up event sees its own move; state only draws it.
  const live = useRef<ItemDrag | null>(null);
  const [drag, setDragState] = useState<ItemDrag | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const target = useRef<Slot | null>(null);

  const setDrag = (next: ItemDrag | null) => {
    live.current = next;
    setDragState(next);
  };
  const setTarget = (slot: Slot | null) => {
    const same = slot && target.current && slot.area === target.current.area && slot.index === target.current.index;
    if (same || slot === target.current) return;
    target.current = slot;
    useRunStore.setState({ itemTarget: slot });
  };
  const end = () => {
    setTarget(null);
    setDrag(null);
  };
  useEffect(() => () => void useRunStore.setState({ itemTarget: null }), []);

  const shownItem = open !== null && open < bag.length ? getItem(bag[open]) : null;

  return (
    <div className="bag-wrap">
      <div className="bag" aria-label="Items to give out">
        {bag.map((itemId, index) => (
          <button
            key={`${itemId}-${index}`}
            className={drag?.index === index && drag.moving ? 'bag-item lifted' : 'bag-item'}
            aria-label={`${getItem(itemId).name}: drag onto a creature`}
            onPointerDown={(event) => {
              if (live.current?.returning) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              const point = { x: event.clientX, y: event.clientY };
              setDrag({ index, itemId, start: point, at: point, moving: false, returning: false });
            }}
            onPointerMove={(event) => {
              const current = live.current;
              if (!current || current.index !== index || current.returning) return;
              const at = { x: event.clientX, y: event.clientY };
              const moving = current.moving || Math.hypot(at.x - current.start.x, at.y - current.start.y) > DRAG_START;
              if (!moving) return;
              if (!current.moving) setOpen(null);
              setDrag({ ...current, at, moving });
              setTarget(unitSlotAtClient(at.x, at.y));
            }}
            onPointerUp={(event) => {
              const current = live.current;
              if (!current || current.index !== index || current.returning) return;
              const at = { x: event.clientX, y: event.clientY };
              if (!current.moving && Math.hypot(at.x - current.start.x, at.y - current.start.y) <= DRAG_START) {
                setOpen(open === index ? null : index);
                end();
                return;
              }
              const slot = unitSlotAtClient(at.x, at.y);
              if (slot && act((run) => equip(run, slot, itemId))) {
                sfx.buy();
                end();
                return;
              }
              setTarget(null);
              setDrag({ ...current, at: current.start, moving: true, returning: true });
              setTimeout(() => setDrag(null), 200);
            }}
            onPointerCancel={end}
          >
            <ItemChip itemId={itemId} size={34} />
          </button>
        ))}
        <span className="hint">Drag onto a creature</span>
      </div>
      {shownItem && (
        <div className="glass trait-pop item-pop" role="dialog" onClick={() => setOpen(null)}>
          <strong>{shownItem.name}</strong>
          <span className="note">{shownItem.description}</span>
        </div>
      )}
      {drag?.moving && (
        <div className={drag.returning ? 'drag-ghost returning' : 'drag-ghost'} style={{ left: drag.at.x, top: drag.at.y }} aria-hidden="true">
          <ItemChip itemId={drag.itemId} size={40} />
        </div>
      )}
    </div>
  );
}

/** A unit dragged off the canvas (toward the shop, to sell it) is drawn here instead. */
function UnitGhost() {
  const unitDrag = useRunStore((s) => s.unitDrag);
  const run = useRunStore((s) => s.run);
  if (!unitDrag?.outside || !run) return null;
  const unit = (unitDrag.slot.area === 'board' ? run.board : run.bench)[unitDrag.slot.index];
  if (!unit) return null;
  return (
    <div className="drag-ghost unit" style={{ left: unitDrag.outside.x, top: unitDrag.outside.y }} aria-hidden="true">
      <CreatureChip unitId={unit.unitId} size={52} />
    </div>
  );
}

function ShopCard({ unitId, owned, affordable, onBuy }: { unitId: string; owned: number; affordable: boolean; onBuy: () => void }) {
  const unit = getUnit(unitId);
  return (
    <button className={`shop-card cost-${unit.cost}${affordable ? '' : ' poor'}${owned === 2 ? ' combines' : ''}`} onClick={onBuy}>
      {owned > 0 && <span className="owned-badge">{owned}/3</span>}
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

/** Replay speed and skip; the teams are in the header above the board. */
function FightBar() {
  const speed = useRunStore((s) => s.speed);
  const setSpeed = useRunStore((s) => s.setSpeed);
  const endReplay = useRunStore((s) => s.endReplay);

  return (
    <section className="glass fight-bar">
      <div className="speed" role="group" aria-label="Replay speed">
        <button aria-pressed={speed === 1} onClick={() => setSpeed(1)}>
          1×
        </button>
        <button aria-pressed={speed === 2} onClick={() => setSpeed(2)}>
          2×
        </button>
      </div>
      <button className="button small skip" onClick={endReplay}>
        Skip
      </button>
    </section>
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
    return () => clearTimeout(timer);
  }, [result.id]);
  if (gone) return null;
  const tone = result.won ? 'won' : result.draw ? 'draw' : 'lost';

  return (
    <div className={`glass round-result ${tone}`} role="status" onClick={() => setGone(true)}>
      <strong>{result.won ? 'Round won' : result.draw ? 'Round drawn' : 'Round lost'}</strong>
      <span className="note">{result.damage > 0 ? `−${result.damage} HP` : `Round ${result.round} of ${MAX_ROUNDS}`}</span>
      {result.item && (
        <span className="drop">
          <ItemChip itemId={result.item} size={22} />
          {getItem(result.item).name} dropped
        </span>
      )}
    </div>
  );
}

function UnitSheet() {
  const selected = useRunStore((s) => s.selected);
  const run = useRunStore((s) => s.run);
  const battle = useRunStore((s) => s.battle);
  const act = useRunStore((s) => s.act);
  const select = useRunStore((s) => s.select);
  const unit = selected && run ? (selected.area === 'board' ? run.board : run.bench)[selected.index] : null;
  if (!run || !unit || !selected || battle) return null;

  const def = getUnit(unit.unitId);
  const scale = (value: number) => Math.floor((value * STAR_PERCENT[unit.star]) / 100);
  const ability = def.ability;
  const perStar = ability.damage ?? ability.heal ?? ability.shield;
  const stats: [string, string | number][] = [
    ['Health', scale(def.hp)],
    ['Damage', scale(def.damage)],
    ['Attacks/s', (TICKS_PER_SECOND / def.attackTicks).toFixed(2)],
    ['Range', def.range],
    ['Armor', def.armor],
    ['Mana', `${def.startMana}/${def.maxMana}`],
  ];

  return (
    <div className="sheet-backdrop" onClick={() => select(null)}>
      <div className="sheet" role="dialog" aria-label={def.name} onClick={(event) => event.stopPropagation()}>
        <div className="sheet-head">
          <CreatureChip unitId={def.id} size={64} />
          <div>
            <h3>
              {def.name} <span className="stars">{'★'.repeat(unit.star)}</span>
            </h3>
            <p className="sheet-traits">
              <TraitIcon trait={def.origin} size={14} /> {traitName(def.origin)}
              <TraitIcon trait={def.role} size={14} /> {traitName(def.role)}
              <span className="coin" aria-hidden="true" />
              {def.cost}
            </p>
          </div>
        </div>
        <dl className="sheet-stats">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="ability">
          <strong>{ability.name}</strong>
          <p className="note">
            {ability.description}
            {perStar && ` ${perStar.slice(0, 3).join(' / ')}`}
            {ability.stunTicks && `, stun ${(ability.stunTicks / TICKS_PER_SECOND).toFixed(1)}s`}
          </p>
        </div>
        <TraitLines traits={[def.origin, def.role]} />
        <ItemSection slot={selected} held={unit.item} />
        <div className="sheet-actions">
          <button
            className="button danger"
            onClick={() => {
              if (act((r) => sell(r, selected as Slot))) sfx.sell();
              select(null);
            }}
          >
            Sell for <span className="coin" aria-hidden="true" />
            {sellValue(def.cost, unit.star)}
          </button>
          <button className="button ghost" onClick={() => select(null)}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/** The item a creature holds; new ones are dragged on from the bag. */
function ItemSection({ slot, held }: { slot: Slot; held?: string }) {
  const act = useRunStore((s) => s.act);
  if (!held) return null;
  return (
    <div className="item-section">
      <p className="micro">Item</p>
      <button className="item-row held" onClick={() => act((run) => unequip(run, slot))}>
        <ItemChip itemId={held} size={28} />
        <span>
          <strong>{getItem(held).name}</strong>
          <small className="note">{getItem(held).description}</small>
        </span>
        <span className="take-off">Take off</span>
      </button>
    </div>
  );
}

function TraitLines({ traits }: { traits: TraitId[] }) {
  return (
    <ul className="trait-lines">
      {traits.map((id) => {
        const trait = getTrait(id);
        return (
          <li key={id}>
            <TraitIcon trait={id} size={16} />
            <span>
              <strong>{trait.name}</strong>{' '}
              <span className="note">
                {trait.thresholds.map((t, i) => `(${t}) ${trait.description.replace('{v}', `${trait.values[i]}`)}`).join('  ')}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Notice() {
  const notice = useRunStore((s) => s.notice);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!notice) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 2400);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!notice || !visible) return null;
  return (
    <div key={notice.id} className="notice" role="status">
      {notice.text}
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
    const dropped = run.bag.length > 0 && ITEM_ROUNDS.includes(last.round) ? run.bag[run.bag.length - 1] : undefined;
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
  const survived = run.hp > 0;
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
        <p className="micro">{survived ? 'Run complete' : 'Knocked out'}</p>
        <p className="big-score">
          <AnimatedNumber value={run.wins} from={0} />
        </p>
        <p className="note">wins in {run.history.length} rounds</p>
        {run.wins >= stats.bestWins && run.wins > 0 && <p className="highlight">Best run yet!</p>}
        <ol className="round-strip" aria-label="Round results">
          {run.history.map((round) => (
            <li key={round.round} className={round.won ? 'won' : round.draw ? 'draw' : 'lost'} title={`Round ${round.round}`} />
          ))}
        </ol>
        {survived && <p className="note">{run.hp} HP left</p>}
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
