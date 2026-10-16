import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Count, Icon } from '../../components/GameIcons';
import { cardOf, type Card } from '../../games/wonders/cards';
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
          <CostIcons cost={card.cost} size={big ? 16 : 11} />
        </span>
      </span>
      <strong className="face-name">{card.name}</strong>
      <span className="face-art">
        <CardEffect card={card} size={big ? 30 : 15} />
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

/** Your hand, card-shaped: what each gives, and what it would cost you now. Tap one to look at it big. */
export function Hand({ state, me, onOpen }: { state: WondersState; me: number; onOpen: (index: number) => void }) {
  return (
    <div className="hand">
      {state.hands[me].map((card, i) => {
        const c = cardOf(baseId(card));
        const cost = buildCost(state, me, c.id);
        const owned = state.cities[me].cards.includes(c.id);
        return (
          <button key={card} className={`hand-card c-${c.color}${cost ? '' : ' unaffordable'}`} style={{ '--i': i } as React.CSSProperties} onClick={() => onOpen(i)}>
            <CardFace card={c} />
            <span className="hand-cost">
              {owned ? (
                'Built'
              ) : !cost ? (
                'Can’t build'
              ) : cost.chained ? (
                <span className="icons free">
                  <Icon name="chain" size={12} /> Free
                </span>
              ) : cost.total === 0 ? (
                <span className="free">Free</span>
              ) : (
                <Count name="coin" n={cost.total} size={12} />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

type Action = { key: string; label: string; detail?: string; move: Move | null };

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
    const parts = [...(p.coins ? [`${coins(p.coins)} to the bank`] : []), ...(p.left ? [`${coins(p.left)} to ${name(leftOf(state, me))}`] : []), ...(p.right ? [`${coins(p.right)} to ${name(rightOf(state, me))}`] : [])];
    return parts.length ? parts.join(', ') : 'free';
  };
  const actions: Action[] = [
    {
      key: 'build',
      label: owned ? 'You already have this' : cost ? (cost.chained ? 'Build: free through a chain' : `Build: ${payText(cost)}`) : 'Can’t afford to build',
      move: cost ? { ...at, as: 'build' } : null,
    },
    ...(free && !cost?.chained ? [{ key: 'free', label: 'Build free (once this age)', move: { ...at, as: 'build' as const, free: true } }] : []),
    ...(stage ? [{ key: 'wonder', label: `Wonder stage ${state.cities[me].stages + 1}: ${stagePay ? payText(stagePay) : 'can’t afford'}`, detail: stageText(stage), move: stagePay ? { ...at, as: 'wonder' as const } : null }] : []),
    { key: 'discard', label: 'Discard for 3 coins', move: { ...at, as: 'discard' } },
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
          className={`view-card c-${c.color} from-${from}`}
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
