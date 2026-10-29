import type { PassState } from '../../games/pass/state';

// Pass or Pay's moves in motion, so a move made on another phone is easy to see: a paid coin
// flies from the payer onto the pot, and a taken card slides from the table into the taker's
// row with its coins following, while the next card turns up. Plain Web Animations on copies
// laid over the page (`.pass-fly`); the real elements are already in their new places.

export interface TableEls {
  /** The face-up card. */
  card: HTMLElement | null;
  /** The coin beside the pot. */
  pot: HTMLElement | null;
  /** The players list: rows carry `data-seat`, cards `data-card`. */
  players: HTMLElement | null;
  /** Your own coins. */
  mine: HTMLElement | null;
}

const FLY_MS = 420;
const EASE = 'cubic-bezier(0.3, 0.7, 0.3, 1)';

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A copy of `look` at `from`, sliding and scaling onto `to`, gone once there. */
function fly(look: HTMLElement, from: DOMRect, to: DOMRect, delay: number, onLand?: () => void) {
  const ghost = look.cloneNode(true) as HTMLElement;
  ghost.removeAttribute('data-card');
  ghost.classList.add('pass-fly');
  Object.assign(ghost.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
  document.body.append(ghost);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const scale = Math.min(to.width / from.width, to.height / from.height);
  const a = ghost.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 1 },
    ],
    { duration: FLY_MS, delay, easing: EASE, fill: 'both' },
  );
  const done = () => {
    ghost.remove();
    onLand?.();
  };
  a.onfinish = done;
  a.oncancel = done;
}

const bump = (el: Element | null, delay = 0) =>
  el?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 260, delay, easing: 'ease-out' });

/** Plays `state.last`, the move just applied, over the table as it now stands. */
export function playMove(state: PassState, me: number, els: TableEls) {
  const last = state.last;
  if (!last || !els.players || reducedMotion() || document.hidden) return;
  const row = els.players.querySelector<HTMLElement>(`[data-seat="${last.by}"]`);
  if (!row) return;

  if (last.type === 'pay') {
    if (!els.pot) return;
    const from = (last.by === me && els.mine ? els.mine : row.querySelector('strong') ?? row).getBoundingClientRect();
    const to = els.pot.getBoundingClientRect();
    const start = new DOMRect(from.left + from.width / 2 - to.width / 2, from.top + from.height / 2 - to.height / 2, to.width, to.height);
    fly(els.pot, start, to, 0, () => {
      if (els.pot) els.pot.style.visibility = '';
      bump(els.pot);
    });
    els.pot.style.visibility = 'hidden';
    return;
  }

  // A take: the card into its place in the taker's row, its coins after it, the next card turning up.
  const target = row.querySelector<HTMLElement>(`[data-card="${last.card}"]`);
  if (!els.card || !target) return;
  const from = els.card.getBoundingClientRect();
  const look = els.card.cloneNode(true) as HTMLElement;
  look.textContent = String(last.card);
  target.style.visibility = 'hidden';
  fly(look, from, target.getBoundingClientRect(), 0, () => {
    target.style.visibility = '';
    bump(target);
  });
  if (els.pot) {
    const coin = els.pot.getBoundingClientRect();
    const name = (row.querySelector('strong') ?? row).getBoundingClientRect();
    const to = new DOMRect(name.left + name.width / 2 - coin.width / 2, name.top + name.height / 2 - coin.height / 2, coin.width, coin.height);
    for (let i = 0; i < Math.min(last.pot, 6); i++) fly(els.pot, coin, to, 90 + i * 70);
  }
  if (state.card !== null)
    els.card.animate(
      [
        { transform: 'perspective(400px) rotateY(90deg) scale(0.8)', opacity: 0 },
        { transform: 'perspective(400px) rotateY(90deg) scale(0.8)', opacity: 0, offset: 0.4 },
        { transform: 'perspective(400px) rotateY(0) scale(1)', opacity: 1 },
      ],
      { duration: FLY_MS + 120, easing: 'ease-out' },
    );
}
