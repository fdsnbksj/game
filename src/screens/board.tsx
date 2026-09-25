import { useCallback, useEffect, useRef, useState, type RefObject, type PointerEvent as ReactPointerEvent } from 'react';
import { useBoard, useBoardStore } from '../boardStore';
import { CreatureChip } from '../components/CreatureChip';
import { ItemChip } from '../components/ItemChip';
import { KindIcon } from '../components/KindIcon';
import { TraitIcon } from '../components/TraitIcon';
import { sfx } from '../game/audio';
import { setBottomInset, unitSlotAtClient } from '../game/boardBridge';
import { getItem, getTrait, getUnit, KIND_NAMES, STAR_PERCENT, TICKS_PER_SECOND, type TraitId } from '../sim/balance';
import { sellValue } from '../sim/economy';
import { equip, sell, suggestHolders, unequip, type Slot } from '../sim/planning';

// The parts of the board screen that every mode shares: the long-press card, the unit
// sheet, the item bag, the fight bar and the like. They read whichever board store the
// screen provides (see src/boardStore.ts), so runs and puzzles use the same ones.

const traitName = (id: TraitId) => getTrait(id).name;

/** Closes a popover on a press anywhere outside `inside`. */
export function useDismiss(open: boolean, inside: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !inside.current?.contains(event.target)) close();
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open, inside, close]);
}

/** Tells the board how much of the canvas the dock covers, as the dock changes. */
export function useDockInset(fighting: boolean) {
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

/** One team's name, units left and health, beside its half of the board. */
export function TeamStrip({ side, name, tag }: { side: 'mine' | 'rival'; name: string; tag?: string }) {
  const teamHp = useBoard((s) => s.teamHp);
  const mine = side === 'mine';
  const hp = mine ? teamHp?.a : teamHp?.b;
  const max = mine ? teamHp?.maxA : teamHp?.maxB;
  const alive = mine ? teamHp?.aliveA : teamHp?.aliveB;
  return (
    <div className={`team-strip ${side}`} aria-label={alive !== undefined ? `${name}: ${alive} left` : name}>
      <div className="team-row">
        <span className="team-name">{name}</span>
        {tag && <small className="rival-kind">{tag}</small>}
        {alive !== undefined && <span className="team-left">{alive} left</span>}
      </div>
      <div className="team-bar">
        <span style={{ width: hp !== undefined && max ? `${(hp / max) * 100}%` : '100%' }} />
      </div>
    </div>
  );
}

/** A little movement before a press becomes a drag, so a tap still opens the item's card. */
const DRAG_START = 6;
/** Under a finger the dragged item rides this far above it, so it stays in view; the drop
    lands where the item is drawn, not under the fingertip. A mouse pointer hides nothing. */
const touchLift = (event: PointerEvent) => (event.pointerType === 'mouse' ? 0 : 28);

interface ItemDrag {
  index: number;
  itemId: string;
  start: { x: number; y: number };
  /** Where the item is drawn and where it would land. */
  at: { x: number; y: number };
  moving: boolean;
  /** Dropped away from a creature: the ghost glides back before it goes. */
  returning: boolean;
}

/**
 * Items waiting to be given out. Drag one onto a creature to give it; tap to read it.
 * The drag follows window events rather than pointer capture on the chip, which some
 * browsers drop mid-gesture.
 */
export function Bag({ bag, hint }: { bag: string[]; hint: string }) {
  const act = useBoard((s) => s.act);
  const store = useBoardStore();
  const [drag, setDrag] = useState<ItemDrag | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(null), []);
  useDismiss(open !== null, wrap, close);
  const target = useRef<Slot | null>(null);
  const stopListening = useRef<(() => void) | null>(null);

  const setTarget = (slot: Slot | null) => {
    const same = slot && target.current && slot.area === target.current.area && slot.index === target.current.index;
    if (same || slot === target.current) return;
    target.current = slot;
    store.setState({ itemTarget: slot });
  };
  useEffect(
    () => () => {
      stopListening.current?.();
      store.setState({ itemTarget: null });
    },
    [store],
  );

  const begin = (event: ReactPointerEvent, index: number, itemId: string) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    stopListening.current?.();
    const start = { x: event.clientX, y: event.clientY };
    let current: ItemDrag = { index, itemId, start, at: start, moving: false, returning: false };
    setDrag(current);

    const move = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      const moving = current.moving || Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_START;
      if (!moving) return;
      if (!current.moving) {
        setOpen(null);
        sfx.pickUp();
      }
      current = { ...current, at: { x: e.clientX, y: e.clientY - touchLift(e) }, moving };
      setDrag(current);
      setTarget(unitSlotAtClient(current.at.x, current.at.y));
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      stop();
      if (!current.moving) {
        setOpen((shown) => (shown === index ? null : index));
        setDrag(null);
        return;
      }
      const at = { x: e.clientX, y: e.clientY - touchLift(e) };
      const slot = unitSlotAtClient(at.x, at.y);
      setTarget(null);
      if (slot && act((run) => equip(run, slot, itemId))) {
        sfx.equip();
        setDrag(null);
        return;
      }
      // Purely visual: the next press can start a new drag straight away.
      setDrag({ ...current, at: start, returning: true });
      setTimeout(() => setDrag((shown) => (shown?.returning ? null : shown)), 200);
    };
    const cancel = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      stop();
      setTarget(null);
      setDrag(null);
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      stopListening.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    stopListening.current = stop;
  };

  const shownItem = open !== null && open < bag.length ? getItem(bag[open]) : null;

  return (
    <div className="bag-wrap" ref={wrap}>
      <div className="bag" aria-label="Items to give out">
        {bag.map((itemId, index) => (
          <button
            key={`${itemId}-${index}`}
            className={drag?.index === index && drag.moving && !drag.returning ? 'bag-item lifted' : 'bag-item'}
            aria-label={`${getItem(itemId).name}: drag onto a creature`}
            onPointerDown={(event) => begin(event, index, itemId)}
          >
            <ItemChip itemId={itemId} size={34} />
          </button>
        ))}
        <span className="hint">
          {bag.length > 0 ? 'Drag onto a creature' : hint}
        </span>
      </div>
      {shownItem && open !== null && <ItemPop itemId={bag[open]} onClose={() => setOpen(null)} />}
      {drag?.moving && (
        <div className={drag.returning ? 'drag-ghost returning' : 'drag-ghost'} style={{ left: drag.at.x, top: drag.at.y }} aria-hidden="true">
          <ItemChip itemId={drag.itemId} size={40} />
        </div>
      )}
    </div>
  );
}

/** What an item does, and which of your creatures it would suit; tap one to give it. */
function ItemPop({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const run = useBoard((s) => s.run);
  const act = useBoard((s) => s.act);
  const item = getItem(itemId);
  const holders = run ? suggestHolders(run, itemId) : [];
  return (
    <div className="glass trait-pop item-pop" role="dialog" onClick={onClose}>
      <strong>{item.name}</strong>
      <span className="note">{item.description}</span>
      {holders.length > 0 && (
        <div className="good-on">
          <span className="micro">Good on</span>
          {holders.map(({ slot, unit }) => (
            <button
              key={unit.uid}
              className="good-on-unit"
              aria-label={`Give ${item.name} to ${getUnit(unit.unitId).name}`}
              onClick={(event) => {
                event.stopPropagation();
                if (act((r) => equip(r, slot, itemId))) sfx.equip();
                onClose();
              }}
            >
              <CreatureChip unitId={unit.unitId} size={30} />
              <span>{getUnit(unit.unitId).name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A unit dragged off the canvas (toward the shop, to sell it) is drawn here instead. */
export function UnitGhost() {
  const unitDrag = useBoard((s) => s.unitDrag);
  const run = useBoard((s) => s.run);
  if (!unitDrag?.outside || !run) return null;
  const unit = (unitDrag.slot.area === 'board' ? run.board : run.bench)[unitDrag.slot.index];
  if (!unit) return null;
  return (
    <div className="drag-ghost unit" style={{ left: unitDrag.outside.x, top: unitDrag.outside.y }} aria-hidden="true">
      <CreatureChip unitId={unit.unitId} size={52} />
    </div>
  );
}

/** A held-down creature's essentials, in a bubble over it, until the next touch. */
export function UnitBubble() {
  const peek = useBoard((s) => s.peek);
  const store = useBoardStore();
  useEffect(() => {
    if (!peek) return;
    const close = () => store.setState({ peek: null });
    // Added after this press has ended, so only the next one closes it.
    const timer = window.setTimeout(() => window.addEventListener('pointerdown', close, { once: true }), 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', close);
    };
  }, [peek, store]);
  if (!peek) return null;

  const def = getUnit(peek.unitId);
  const scale = (value: number) => Math.floor((value * STAR_PERCENT[peek.star]) / 100);
  const ability = def.ability;
  const amount = ability.damage ? `${ability.damage[peek.star - 1]} damage` : ability.heal ? `${ability.heal[peek.star - 1]} healing` : ability.shield ? `${ability.shield[peek.star - 1]} shield` : null;
  const width = 244;
  const left = Math.min(window.innerWidth - width / 2 - 10, Math.max(width / 2 + 10, peek.x));
  // Near the top of the screen there's no room above, so it hangs below instead.
  const below = peek.y < 190;

  return (
    <div className={below ? 'unit-bubble below' : 'unit-bubble'} role="tooltip" style={{ left, top: peek.y, width }}>
      <div className="bubble-head">
        <CreatureChip unitId={def.id} size={36} />
        <div>
          <strong>
            {def.name} {peek.star > 1 && <span className="stars">{'★'.repeat(peek.star)}</span>}
          </strong>
          <span className="bubble-traits">
            <TraitIcon trait={def.origin} size={13} />
            <TraitIcon trait={def.role} size={13} />
            <span className="coin" aria-hidden="true" />
            {def.cost}
          </span>
        </div>
      </div>
      <p className="bubble-ability">
        <b>{ability.name}</b> {ability.description}
        {amount && <span className="bubble-amount"> {amount}</span>}
      </p>
      <dl className="bubble-stats">
        <div>
          <dt>Health</dt>
          <dd>{scale(def.hp)}</dd>
        </div>
        <div>
          <dt>Damage</dt>
          <dd>{scale(def.damage)}</dd>
        </div>
        <div className="bubble-kind">
          <dt>{KIND_NAMES[def.kind]}</dt>
          <dd>
            <KindIcon kind={def.kind} size={22} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** Your team under your half, then replay speed and skip; the rival is above the board. */
export function FightBar() {
  const speed = useBoard((s) => s.speed);
  const setSpeed = useBoard((s) => s.setSpeed);
  const endReplay = useBoard((s) => s.endReplay);

  return (
    <section className="glass fight-bar">
      <TeamStrip side="mine" name="You" />
      <div className="fight-controls">
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
      </div>
    </section>
  );
}

/** A tapped creature in full. `canSell` is off where there's no shop to sell to. */
export function UnitSheet({ canSell = true }: { canSell?: boolean }) {
  const selected = useBoard((s) => s.selected);
  const run = useBoard((s) => s.run);
  const battle = useBoard((s) => s.battle);
  const act = useBoard((s) => s.act);
  const select = useBoard((s) => s.select);
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
              <KindIcon kind={def.kind} size={14} /> {KIND_NAMES[def.kind]}
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
          {canSell && (
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
          )}
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
  const act = useBoard((s) => s.act);
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

export function Notice() {
  const notice = useBoard((s) => s.notice);
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
