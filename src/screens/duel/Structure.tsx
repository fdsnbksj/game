import type { CSSProperties } from 'react';
import { cardOf } from '../../games/duel/cards';
import { CardEffect, CostIcons } from './CardIcons';
import { LAYOUTS } from '../../games/duel/setup';
import { accessible, visible, type DuelState } from '../../games/duel/state';

/** Card size and row spacing, in half-card-width units: overlapping rows show the top of the card behind. */
const W = 2;
const H = 2.5;
const STEP = 1.45;

/** The age's cards as laid out on the table: face-down ones show their back until uncovered. */
export function Structure({ state, mine, onPick }: { state: DuelState; mine: boolean; onPick: (slot: number) => void }) {
  const layout = LAYOUTS[state.age];
  const minX = Math.min(...layout.map((s) => s.x)) - 1;
  const maxX = Math.max(...layout.map((s) => s.x)) + 1;
  const rows = Math.max(...layout.map((s) => s.row)) + 1;
  const width = maxX - minX;
  const height = (rows - 1) * STEP + H;
  const open = accessible(state);

  return (
    <div className="structure" style={{ aspectRatio: `${width} / ${height}` } as CSSProperties} aria-label={`Age ${state.age} cards`}>
      {layout.map((slot, i) => {
        if (state.taken[i]) return null;
        const id = state.setup.ages[state.age][i];
        const shown = visible(state, i);
        const card = cardOf(id);
        const canTake = open.includes(i);
        const style = {
          left: `${((slot.x - 1 - minX) / width) * 100}%`,
          top: `${((slot.row * STEP) / height) * 100}%`,
          width: `${(W / width) * 100}%`,
          height: `${(H / height) * 100}%`,
          zIndex: slot.row + 1,
        } as CSSProperties;
        return (
          <button
            key={i}
            className={['dcard', shown ? `c-${card.color}` : 'back', canTake && 'open', canTake && mine && 'mine'].filter(Boolean).join(' ')}
            style={style}
            onClick={() => shown && onPick(i)}
            aria-label={shown ? card.name : 'Face-down card'}
          >
            {shown ? (
              <>
                <span className="dcard-band" />
                <span className="dcard-name">{card.name}</span>
                <span className="dcard-effect">
                  <CardEffect card={card} size={11} />
                </span>
                <span className="dcard-cost">
                  <CostIcons cost={card.cost} size={9} />
                </span>
              </>
            ) : (
              <span className="dcard-age">{['I', 'II', 'III'][state.age - 1]}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
