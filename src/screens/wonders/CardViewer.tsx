import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Count, Icon } from '../../components/GameIcons';
import { cardOf, chainsTo, type Card } from '../../games/wonders/cards';
import { cardText, COLOR_NAMES, stageText } from '../../games/wonders/describe';
import { baseId } from '../../games/wonders/setup';
import { buildCost, canBuildFree, leftOf, rightOf, stageCost, stagesOf, type Move, type WondersState } from '../../games/wonders/state';
import { CardEffect, CostIcons } from './CardIcons';

const AGES = ['I', 'II', 'III'];

/** A card face: colour band with its cost, the name, what it gives drawn big, then its words. */
export function CardFace({ card, big }: { card: Card; big?: boolean }) {
  return (
    <>
      <span className="face-band">
        <span>{COLOR_NAMES[card.color]}</span>
        <span className="face-cost">
          <CostIcons cost={card.cost} size={big ? 16 : 13} />
        </span>
      </span>
      <strong className="face-name">{card.name}</strong>
      <span className="face-art">
        <CardEffect card={card} size={big ? 30 : 20} />
      </span>
      {big && (
        <span className="face-text">
          {cardText(card).map((line) => (
            <span key={line}>{line}</span>
          ))}
        </span>
      )}
      <span className="face-age">Age {AGES[card.age - 1]}</span>
    </>
  );
}

/** What a card would cost you now, in a word or an icon. */
function CostNow({ state, me, id }: { state: WondersState; me: number; id: string }) {
  const cost = buildCost(state, me, id);
  if (state.cities[me].cards.includes(id)) return <>Built</>;
  if (!cost) return <>Can’t build</>;
  if (cost.chained)
    return (
      <span className="icons free">
        <Icon name="chain" size={12} /> Free
      </span>
    );
  if (cost.total === 0) return <span className="free">Free</span>;
  return <Count name="coin" n={cost.total} size={14} />;
}

/**
 * The card's chains: which of your cards makes it free now, and which later cards it would
 * make free (left out once you have them).
 */
function ChainNote({ state, me, card }: { state: WondersState; me: number; card: Card }) {
  const city = state.cities[me];
  const owned = city.cards.includes(card.id);
  const from = owned ? undefined : card.chainFrom?.find((id) => city.cards.includes(id));
  const next = chainsTo(card.id).filter((c) => !city.cards.includes(c.id));
  if (!from && !next.length) return null;
  return (
    <>
      {from && (
        <span className="chain-note">
          <Icon name="chain" size={14} /> Free: you have {cardOf(from).name}
        </span>
      )}
      {next.length > 0 && (
        <span className="chain-note next">
          <Icon name="chain" size={14} /> Makes free later: {next.map((c) => `${c.name} (Age ${AGES[c.age - 1]})`).join(', ')}
        </span>
      )}
    </>
  );
}

const HOLD_MS = 220;

/**
 * Your hand, fanned out as you'd hold it. Press and hold a card and it comes up to read;
 * slide along the fan to read the others; let go and it goes back. A quick tap opens it to play.
 */
export function Hand({ state, me, onOpen }: { state: WondersState; me: number; onOpen: (index: number) => void }) {
  const hand = state.hands[me];
  const [held, setHeld] = useState<number | null>(null);
  const press = useRef<{ i: number; x: number; timer: number } | null>(null);
  const n = hand.length;
  const mid = (n - 1) / 2;

  const cardAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-card]');
    return el ? Number(el.dataset.card) : null;
  };
  const end = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    setHeld(null);
  };
  useEffect(() => end, []);

  const peek = held !== null && hand[held] ? cardOf(baseId(hand[held])) : null;

  return (
    <>
      <div className="fan-space" aria-hidden="true" />
      <div className="fan-dock">
        <p className="note center-note fan-hint">Hold a card to read it · tap to play it</p>
        <div
          className={held === null ? 'fan' : 'fan holding'}
          style={{ '--n': n } as React.CSSProperties}
          onPointerDown={(e) => {
            const i = cardAt(e.clientX, e.clientY);
            if (i === null) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            press.current = {
              i,
              x: e.clientX,
              timer: window.setTimeout(() => setHeld(press.current?.i ?? null), HOLD_MS),
            };
          }}
          onPointerMove={(e) => {
            if (!press.current) return;
            const i = cardAt(e.clientX, e.clientY);
            // Sliding along the fan is reading: pick the card up straight away.
            if (held === null && Math.abs(e.clientX - press.current.x) > 12) setHeld(i ?? press.current.i);
            else if (held !== null && i !== null && i !== held) setHeld(i);
            if (i !== null) press.current.i = i;
          }}
          onPointerUp={() => {
            const tapped = held === null && press.current ? press.current.i : null;
            end();
            if (tapped !== null) onOpen(tapped);
          }}
          onPointerCancel={end}
          onContextMenu={(e) => e.preventDefault()}
        >
          {hand.map((card, i) => {
            const c = cardOf(baseId(card));
            const cost = buildCost(state, me, c.id);
            const off = i - mid;
            return (
              <div
                key={card}
                data-card={i}
                className={`hand-card c-${c.color}${cost ? '' : ' unaffordable'}${cost?.chained ? ' chained' : ''}${held === i ? ' up' : ''}`}
                style={
                  {
                    '--i': i,
                    '--off': off,
                    '--abs': Math.abs(off),
                  } as React.CSSProperties
                }
              >
                <CardFace card={c} />
                <span className="hand-cost">
                  <CostNow state={state} me={me} id={c.id} />
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {peek &&
        createPortal(
          <div className="peek" aria-live="polite">
            <div key={peek.id} className={`view-card peek-card c-${peek.color}${buildCost(state, me, peek.id)?.chained ? ' chained' : ''}`}>
              <CardFace card={peek} big />
              <ChainNote state={state} me={me} card={peek} />
              <span className="peek-cost">
                Costs you now: <CostNow state={state} me={me} id={peek.id} />
              </span>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

type Action = {
  key: string;
  label: string;
  detail?: string;
  move: Move | null;
};

/** What you could do with a card now, the likeliest first: build, else a wonder stage, else discard. */
function actionsFor(state: WondersState, me: number, card: string, name: (s: number) => string): { actions: Action[]; best: string } {
  const c = cardOf(baseId(card));
  const at = { type: 'pick' as const, age: state.age, turn: state.turn, card };
  const cost = buildCost(state, me, c.id);
  const owned = state.cities[me].cards.includes(c.id);
  const free = canBuildFree(state, me) && !owned;
  const stage = stagesOf(state.cities[me])[state.cities[me].stages];
  const stagePay = stageCost(state, me);
  const coins = (n: number) => `${n} coin${n === 1 ? '' : 's'}`;
  const payText = (p: { coins: number; left: number; right: number }) => {
    const parts = [
      ...(p.coins ? [`${coins(p.coins)} to the bank`] : []),
      ...(p.left ? [`${coins(p.left)} to ${name(leftOf(state, me))}`] : []),
      ...(p.right ? [`${coins(p.right)} to ${name(rightOf(state, me))}`] : []),
    ];
    return parts.length ? parts.join(', ') : 'free';
  };
  const actions: Action[] = [
    {
      key: 'build',
      label: owned ? 'You already have this' : cost ? (cost.chained ? 'Build: free through a chain' : `Build: ${payText(cost)}`) : 'Can’t afford to build',
      move: cost ? { ...at, as: 'build' } : null,
    },
    ...(free && !cost?.chained
      ? [
          {
            key: 'free',
            label: 'Build free (once this age)',
            move: { ...at, as: 'build' as const, free: true },
          },
        ]
      : []),
    ...(stage
      ? [
          {
            key: 'wonder',
            label: `Wonder stage ${state.cities[me].stages + 1}: ${stagePay ? payText(stagePay) : 'can’t afford'}`,
            detail: stageText(stage),
            move: stagePay ? { ...at, as: 'wonder' as const } : null,
          },
        ]
      : []),
    {
      key: 'discard',
      label: 'Discard for 3 coins',
      move: { ...at, as: 'discard' },
    },
  ];
  const best = cost ? 'build' : stagePay && stage ? 'wonder' : 'discard';
  actions.sort((x, y) => Number(y.key === best) - Number(x.key === best));
  return { actions, best };
}

/**
 * Looking at a card the way a card game does: it grows out of the hand to fill the screen,
 * tilts under the finger, and a swipe goes to the next card in the hand. What to do with it
 * sits at the bottom, under the thumb.
 */
export function CardViewer({
  state,
  me,
  start,
  canPick,
  name,
  onMove,
  onClose,
}: {
  state: WondersState;
  me: number;
  start: number;
  canPick: boolean;
  name: (s: number) => string;
  onMove: (m: Move) => void;
  onClose: () => void;
}) {
  const hand = state.hands[me];
  const [index, setIndex] = useState(Math.min(start, hand.length - 1));
  const [from, setFrom] = useState<'zoom' | 'left' | 'right'>('zoom');
  const cardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const go = (by: number) => {
    if (hand.length < 2) return;
    setFrom(by > 0 ? 'right' : 'left');
    setIndex((i) => (i + by + hand.length) % hand.length);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // The hand changed under us (a new turn): look at what's there now.
  const card = hand[Math.min(index, hand.length - 1)];
  if (!card) return null;
  const c = cardOf(baseId(card));
  const { actions, best } = actionsFor(state, me, card, name);

  const tilt = (e: PointerEvent, dx: number) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--ry', `${(px - 0.5) * 18}deg`);
    el.style.setProperty('--rx', `${(0.5 - py) * 18}deg`);
    el.style.setProperty('--px', `${px * 100}%`);
    el.style.setProperty('--py', `${py * 100}%`);
    el.style.setProperty('--dx', `${dx}px`);
  };
  const settle = () => {
    const el = cardRef.current;
    if (!el) return;
    for (const v of ['--rx', '--ry', '--dx']) el.style.removeProperty(v);
    el.classList.remove('held');
  };

  return createPortal(
    <div className="viewer" role="dialog" aria-label={c.name} onClick={onClose}>
      <div className="viewer-stage">
        {hand.length > 1 && (
          <button className="viewer-nav prev" aria-label="Previous card" onClick={(e) => (e.stopPropagation(), go(-1))}>
            ‹
          </button>
        )}
        <div
          key={card}
          ref={cardRef}
          className={`view-card c-${c.color} from-${from}${buildCost(state, me, c.id)?.chained ? ' chained' : ''}`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, y: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
            e.currentTarget.classList.add('held');
            tilt(e, 0);
          }}
          onPointerMove={(e) => drag.current && tilt(e, e.clientX - drag.current.x)}
          onPointerUp={(e) => {
            const dx = drag.current ? e.clientX - drag.current.x : 0;
            drag.current = null;
            settle();
            if (dx < -50) go(1);
            else if (dx > 50) go(-1);
          }}
          onPointerCancel={() => {
            drag.current = null;
            settle();
          }}
        >
          <CardFace card={c} big />
          <ChainNote state={state} me={me} card={c} />
          <span className="view-sheen" />
        </div>
        {hand.length > 1 && (
          <button className="viewer-nav next" aria-label="Next card" onClick={(e) => (e.stopPropagation(), go(1))}>
            ›
          </button>
        )}
      </div>
      <div className="viewer-dots" aria-hidden="true">
        {hand.map((h) => (
          <span key={h} className={h === card ? 'on' : undefined} />
        ))}
      </div>
      <div className="viewer-actions" onClick={(e) => e.stopPropagation()}>
        {!canPick && <p className="note center-note">You can look, but it isn’t your pick yet.</p>}
        {actions.map(({ key, label, detail, move }) => (
          <button key={key} className={`button${key === best ? ' primary' : ''}${key === 'wonder' ? ' wonder-button' : ''}`} disabled={!move || !canPick} onClick={() => move && onMove(move)}>
            <span>{label}</span>
            {detail && <small>{detail}</small>}
          </button>
        ))}
        <button className="button ghost" onClick={onClose}>
          Back to your hand
        </button>
      </div>
    </div>,
    document.body,
  );
}
